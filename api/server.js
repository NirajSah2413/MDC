import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import { createAdminToken, requireAdmin } from "./auth.js";
import {
  changeAdminPassword,
  createDatabase,
  getAdminProfile,
  getSiteContent,
  saveAdminProfile,
  verifyAdminCredentials
} from "./database.js";
import { isStrongAdminPassword, validateAdminProfile, validateAppointment, validateDoctors } from "./validation.js";
import {
  addOffer,
  createOffer,
  getAppointmentMonth,
  getClinicDate,
  getPublicOffer,
  managedImageDir,
  migrateLegacyPromotion,
  readOffers,
  readDoctors,
  removeUnreferencedManagedImages,
  setOfferEnabled,
  syncAppointmentArchives,
  writeAppointmentMonth,
  writeDoctors
} from "./file-storage.js";

const app = express();
const here = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = managedImageDir;
const legacyUploadDir = path.resolve(here, "../uploads");
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(legacyUploadDir, { recursive: true });
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
const host = process.env.HOST || "127.0.0.1";
const appointmentAcknowledgement = "If you already have an open request for this number, our team will contact you soon. Otherwise, your appointment request has been received.";
const adminUsername = process.env.ADMIN_USERNAME || (isProduction ? "" : "admin");
const adminPassword = process.env.ADMIN_PASSWORD || (isProduction ? "" : "admin");
const jwtSecret = process.env.JWT_SECRET || (isProduction ? "" : crypto.randomBytes(48).toString("base64url"));
const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:4200";
const jwtSecretIsStrong = typeof jwtSecret === "string" && jwtSecret.length >= 43 &&
  /^[A-Za-z0-9_-]+$/.test(jwtSecret) && new Set(jwtSecret).size >= 20;

if (!adminUsername || !adminPassword || !jwtSecretIsStrong) {
  throw new Error("Production must define ADMIN_USERNAME, a strong ADMIN_PASSWORD, and a unique base64url JWT_SECRET generated from at least 32 random bytes.");
}
const isLoopbackHost = host === "localhost" || host === "::1" || /^127(?:\.\d{1,3}){3}$/.test(host);
if (isProduction && (!isStrongAdminPassword(adminPassword) || !process.env.JWT_SECRET || !jwtSecretIsStrong)) {
  throw new Error("Production must define a strong ADMIN_PASSWORD (12+ characters with lowercase, uppercase, number and symbol) and a unique base64url JWT_SECRET generated from at least 32 random bytes.");
}
if (!isProduction && !isLoopbackHost && adminUsername === "admin" && adminPassword === "admin") {
  throw new Error("The demo admin credentials are allowed only on a loopback host. Configure a strong admin account before exposing the API.");
}
process.env.JWT_SECRET = jwtSecret;

const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.resolve(here, "../data/clinic.sqlite");
const db = createDatabase(databasePath, { username: adminUsername, password: adminPassword });
if (isProduction && verifyAdminCredentials(db, "admin", "admin")) {
  throw new Error("The database still accepts the default admin/admin credentials. Sign in locally and change the admin password before production deployment.");
}
syncAppointmentArchives(db);
migrateLegacyPromotion(getSiteContent(db).promotion);
const appointments = db.prepare(`
  SELECT id, name, age, gender, phone, email, problem, status,
         requested_at AS requestedAt, status_updated_at AS statusUpdatedAt
  FROM appointments
  WHERE status = 'waiting' OR requested_at >= ?
  ORDER BY requested_at DESC
  LIMIT 1000
`);
const appointmentById = db.prepare("SELECT id FROM appointments WHERE id = ?");
const openAppointmentByPhone = db.prepare("SELECT id FROM appointments WHERE phone = ? AND status = 'waiting' LIMIT 1");
const insertAppointment = db.prepare(`
  INSERT INTO appointments (id, name, age, gender, phone, email, problem, status, requested_at)
  VALUES (@id, @name, @age, @gender, @phone, @email, @problem, 'waiting', @requestedAt)
`);
const updateStatus = db.prepare("UPDATE appointments SET status = ?, status_updated_at = ? WHERE id = ?");

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: allowedOrigin.split(",").map(origin => origin.trim()), methods: ["GET", "POST", "PUT", "PATCH"], allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(legacyUploadDir, { fallthrough: false, maxAge: "1d" }));
app.use("/assets/uploads", express.static(uploadDir, { fallthrough: false, maxAge: "1d" }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });
const bookingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });
const imageStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});
const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)) {
      return callback(new Error("Only JPG, PNG, WEBP, and GIF images are accepted."));
    }
    callback(null, true);
  }
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/public/site", (_req, res, next) => {
  try {
    const content = getSiteContent(db);
    const offer = getPublicOffer();
    content.promotion = offer
      ? {
          id: offer.id,
          enabled: true,
          title: offer.title,
          message: offer.message,
          image: offer.image,
          startsAt: offer.displayDate,
          endsAt: offer.displayDate
        }
      : { enabled: false, title: "", message: "", image: "", startsAt: "", endsAt: "" };
    res.json(content);
  } catch (error) {
    next(error);
  }
});
app.get("/api/public/doctors", (_req, res, next) => {
  try {
    res.json(readDoctors());
  } catch (error) {
    next(error);
  }
});
app.post("/api/public/appointments", bookingLimiter, (req, res, next) => {
  const data = validateAppointment(req.body || {});
  if (typeof data === "string") return res.status(400).json({ error: data });
  try {
    const existingAppointment = openAppointmentByPhone.get(data.phone);
    if (existingAppointment) {
      return res.json({
        message: appointmentAcknowledgement
      });
    }
    const appointment = {
      id: crypto.randomUUID(),
      ...data,
      status: "waiting",
      requestedAt: new Date().toISOString(),
      statusUpdatedAt: null
    };
    db.transaction(() => {
      insertAppointment.run({
        id: appointment.id,
        name: appointment.name,
        age: appointment.age,
        gender: appointment.gender,
        phone: appointment.phone,
        email: appointment.email,
        problem: appointment.problem,
        requestedAt: appointment.requestedAt
      });
      writeAppointmentMonth(db, appointment.requestedAt);
    })();
    res.json({
      message: appointmentAcknowledgement
    });
  } catch (error) {
    next(error);
  }
});
app.post("/api/admin/login", loginLimiter, (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!verifyAdminCredentials(db, username, password)) return res.status(401).json({ error: "Username or password is incorrect." });
  res.json({ token: createAdminToken(username), expiresIn: 28800 });
});

app.use("/api/admin", requireAdmin);
app.get("/api/admin/doctors", (_req, res, next) => {
  try {
    res.json(readDoctors());
  } catch (error) {
    next(error);
  }
});
app.put("/api/admin/doctors", (req, res, next) => {
  const doctors = validateDoctors(req.body);
  if (typeof doctors === "string") return res.status(400).json({ error: doctors });
  try {
    const previousDoctors = readDoctors();
    writeDoctors(doctors);
    const removedImages = previousDoctors
      .filter(doctor => {
        const nextDoctor = doctors.find(item => item.id === doctor.id);
        return !nextDoctor || nextDoctor.image !== doctor.image;
      })
      .map(doctor => doctor.image)
      .filter(Boolean);
    const profile = getAdminProfile(db);
    removeUnreferencedManagedImages(removedImages, getSiteContent(db), readOffers(), profile.imageUrl);
    res.json({ doctors, message: "Doctors list saved." });
  } catch (error) {
    next(error);
  }
});
app.get("/api/admin/profile", (_req, res) => res.json(getAdminProfile(db)));
app.put("/api/admin/profile", (req, res) => {
  const profile = validateAdminProfile(req.body || {});
  if (typeof profile === "string") return res.status(400).json({ error: profile });
  saveAdminProfile(db, profile);
  res.json({ message: "Admin profile saved." });
});
app.put("/api/admin/password", (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  if (!isStrongAdminPassword(newPassword)) {
    return res.status(400).json({
      error: "Your new password must be 12 to 128 characters and include lowercase and uppercase letters, a number, and a symbol."
    });
  }
  if (!changeAdminPassword(db, currentPassword, newPassword)) {
    return res.status(400).json({ error: "Your current password is incorrect." });
  }
  res.json({ message: "Password changed. Use your new password the next time you sign in." });
});
app.get("/api/admin/appointments", (_req, res) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  res.json(appointments.all(cutoff.toISOString()));
});
app.get("/api/admin/appointments/archive", (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  const archive = getAppointmentMonth(year, month);
  if (!archive) return res.status(400).json({ error: "Choose a year and month within the last 10 years." });
  res.json(archive);
});
app.patch("/api/admin/appointments/:id", (req, res) => {
  const status = req.body?.status;
  if (!["waiting", "done", "cancelled"].includes(status)) return res.status(400).json({ error: "Choose a valid appointment status." });
  if (!appointmentById.get(req.params.id)) return res.status(404).json({ error: "Appointment was not found." });
  const appointment = db.prepare("SELECT requested_at AS requestedAt FROM appointments WHERE id = ?").get(req.params.id);
  db.transaction(() => {
    updateStatus.run(status, new Date().toISOString(), req.params.id);
    writeAppointmentMonth(db, appointment.requestedAt);
  })();
  res.json({ message: "Appointment status updated." });
});
app.post("/api/admin/uploads", imageUpload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose an image to upload." });
  res.status(201).json({ url: `/assets/uploads/${req.file.filename}` });
});
app.get("/api/admin/offers", (_req, res) => res.json(readOffers()));
app.post("/api/admin/offers", (req, res) => {
  const offer = createOffer(req.body || {});
  if (typeof offer === "string") return res.status(400).json({ error: offer });
  const result = addOffer(offer);
  const content = getSiteContent(db);
  const profile = getAdminProfile(db);
  removeUnreferencedManagedImages(result.removedImages, content, result.offers, profile.imageUrl);
  res.status(201).json({ offers: result.offers, message: "Offer saved." });
});
app.patch("/api/admin/offers/:id", (req, res) => {
  if (typeof req.body?.enabled !== "boolean") {
    return res.status(400).json({ error: "Choose whether this offer should be active." });
  }
  const result = setOfferEnabled(req.params.id, req.body.enabled);
  if (!result) return res.status(404).json({ error: "Offer was not found." });
  res.json({ offer: result.offer, message: result.offer.enabled ? "Offer activated." : "Offer deactivated." });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError) {
    return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: error.code === "LIMIT_FILE_SIZE" ? "Image must be 5 MB or smaller." : "Image upload could not be completed." });
  }
  if (error.message?.startsWith("Only JPG")) return res.status(415).json({ error: error.message });
  const status = Number.isInteger(error.status) ? error.status : 500;
  res.status(status).json({ error: status === 500 ? "The server could not complete this request." : error.message });
});

app.listen(port, host, () => console.log(`Mahamaya clinic API listening on ${host}:${port}`));
