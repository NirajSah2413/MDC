import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const dataDir = process.env.CLINIC_DATA_DIR
  ? path.resolve(process.env.CLINIC_DATA_DIR)
  : path.resolve(here, "../data");
export const managedImageDir = path.resolve(here, "../src/assets/uploads");
const offersFile = path.join(dataDir, "offers.json");
const archiveDir = path.join(dataDir, "appointments");
const MAX_OFFERS = 30;

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    throw error;
  }
}

function monthFile(year, month) {
  return path.join(archiveDir, String(year), `${String(month).padStart(2, "0")}.json`);
}

function clinicDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function clinicYear() {
  return Number(clinicDateParts(new Date()).year);
}

function monthBoundaryUtc(year, month) {
  return new Date(Date.UTC(year, month - 1, 1) - 330 * 60 * 1000).toISOString();
}

function isValidMonth(year, month) {
  const currentYear = clinicYear();
  return Number.isInteger(year) && year >= currentYear - 9 && year <= currentYear &&
    Number.isInteger(month) && month >= 1 && month <= 12;
}

export function getClinicDate(date = new Date()) {
  const values = clinicDateParts(date);
  return `${values.year}-${values.month}-${values.day}`;
}

export function readOffers() {
  if (!fs.existsSync(offersFile)) return [];
  const offers = JSON.parse(fs.readFileSync(offersFile, "utf8"));
  if (!Array.isArray(offers)) throw new Error("Offer storage has an invalid format.");
  return offers;
}

export function migrateLegacyPromotion(promotion) {
  if (!promotion || !promotion.title || !promotion.message || readOffers().length) return;
  const displayDate = typeof promotion.startsAt === "string" && /^\d{4}-\d{2}-\d{2}/.test(promotion.startsAt)
    ? promotion.startsAt.slice(0, 10)
    : typeof promotion.endsAt === "string" && /^\d{4}-\d{2}-\d{2}/.test(promotion.endsAt)
      ? promotion.endsAt.slice(0, 10)
      : getClinicDate();
  const migratedOffer = {
    id: crypto.randomUUID(),
    title: promotion.title,
    message: promotion.message,
    image: promotion.image || "",
    displayDate,
    enabled: Boolean(promotion.enabled),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  writeJson(offersFile, [migratedOffer]);
}

function removeManagedImage(url) {
  if (typeof url !== "string") return;
  const match = url.match(/^\/assets\/uploads\/([0-9a-f-]+\.(?:jpe?g|png|webp|gif))$/i);
  if (!match) return;
  const imagePath = path.resolve(managedImageDir, match[1]);
  if (path.dirname(imagePath) !== managedImageDir) return;
  if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
}

export function removeUnreferencedManagedImages(candidates, content, offers, profileImage = "") {
  const referenced = new Set([
    ...(content.gallery || []).map(item => item.image),
    ...(content.specialties || []).map(item => item.image),
    content.promotion?.image,
    ...offers.map(offer => offer.image),
    profileImage
  ].filter(Boolean));
  for (const image of new Set(candidates)) {
    if (!referenced.has(image)) removeManagedImage(image);
  }
}

export function createOffer(body) {
  const date = typeof body.displayDate === "string" ? body.displayDate : "";
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date || date < getClinicDate()) {
    return "Choose one valid offer display date.";
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const image = typeof body.image === "string" ? body.image.trim() : "";
  if (!title || title.length > 120) return "Enter an offer title of up to 120 characters.";
  if (!message || message.length > 2000) return "Enter an offer message of up to 2,000 characters.";
  if (image && !/^\/assets\/uploads\/[0-9a-f-]+\.(?:jpe?g|png|webp|gif)$/i.test(image)) {
    return "Upload the offer image to the clinic website.";
  }
  return {
    id: crypto.randomUUID(),
    title,
    message,
    image,
    displayDate: date,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function addOffer(offer) {
  const offers = [offer, ...readOffers()];
  const retained = offers.slice(0, MAX_OFFERS);
  writeJson(offersFile, retained);
  return {
    offers: retained,
    removedImages: offers.slice(MAX_OFFERS).map(item => item.image).filter(Boolean)
  };
}

export function setOfferEnabled(id, enabled) {
  const offers = readOffers();
  const offer = offers.find(item => item.id === id);
  if (!offer) return null;
  offer.enabled = enabled;
  offer.updatedAt = new Date().toISOString();
  writeJson(offersFile, offers);
  return { offer, offers };
}

export function getPublicOffer() {
  const today = getClinicDate();
  return readOffers().find(offer => offer.enabled && offer.displayDate === today) || null;
}

export function writeAppointmentMonth(db, dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) throw new Error("Appointment has an invalid booking date.");
  const parts = clinicDateParts(date);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const rows = db.prepare(`
    SELECT id, name, age, gender, phone, email, problem, status,
           requested_at AS requestedAt, status_updated_at AS statusUpdatedAt
    FROM appointments
    WHERE requested_at >= ? AND requested_at < ?
    ORDER BY requested_at DESC
  `).all(monthBoundaryUtc(year, month), month === 12
    ? monthBoundaryUtc(year + 1, 1)
    : monthBoundaryUtc(year, month + 1));
  writeJson(monthFile(year, month), { year, month, appointments: rows });
}

export function getAppointmentMonth(year, month) {
  if (!isValidMonth(year, month)) return null;
  const filePath = monthFile(year, month);
  if (!fs.existsSync(filePath)) return { year, month, appointments: [] };
  const archive = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (archive.year !== year || archive.month !== month || !Array.isArray(archive.appointments)) {
    throw new Error("Appointment archive has an invalid format.");
  }
  return archive;
}

export function syncAppointmentArchives(db) {
  const currentYear = clinicYear();
  const firstYear = currentYear - 9;
  const start = monthBoundaryUtc(firstYear, 1);
  const rows = db.prepare(`
    SELECT id, name, age, gender, phone, email, problem, status,
           requested_at AS requestedAt, status_updated_at AS statusUpdatedAt
    FROM appointments WHERE requested_at >= ? ORDER BY requested_at DESC
  `).all(start);
  const months = new Map();
  for (const row of rows) {
    const date = new Date(row.requestedAt);
    if (Number.isNaN(date.getTime())) continue;
    const parts = clinicDateParts(date);
    const year = Number(parts.year);
    const month = Number(parts.month);
    const key = `${year}-${month}`;
    const archive = months.get(key) || { year, month, appointments: [] };
    archive.appointments.push(row);
    months.set(key, archive);
  }
  for (const archive of months.values()) {
    writeJson(monthFile(archive.year, archive.month), archive);
  }
  fs.mkdirSync(archiveDir, { recursive: true });
  for (const entry of fs.readdirSync(archiveDir, { withFileTypes: true })) {
    if (entry.isDirectory() && /^\d{4}$/.test(entry.name) && Number(entry.name) < firstYear) {
      fs.rmSync(path.join(archiveDir, entry.name), { recursive: true, force: false });
    }
  }
}
