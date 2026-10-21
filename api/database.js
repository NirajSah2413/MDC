import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultSeedPath = path.join(here, "seed-data.json");
const localImages = new Map([
  ["photo-1606811971618-4486d14f3f99", "/assets/images/dental-care.jpg"],
  ["photo-1629909613654-28e377c37b09", "/assets/images/clinic-interior.jpg"],
  ["photo-1609840114035-3c981b782dfe", "/assets/images/teeth-exam.jpg"],
  ["photo-1606811841689-23dfddce3e95", "/assets/images/child-dentistry.jpg"],
  ["photo-1606265752439-1f18756aa5fc", "/assets/images/orthodontics.jpg"],
  ["photo-1629909615184-74f495363b67", "/assets/images/clinic-team.jpg"]
]);

function makePasswordHash(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function useLocalImage(image) {
  if (typeof image !== "string" || !/^https?:\/\//i.test(image)) return image || "";
  const photoId = image.match(/photo-[\w-]+/)?.[0];
  return localImages.get(photoId) || "/assets/images/dental-care.jpg";
}

function localizeImages(content) {
  let migrated = false;
  const replaceImage = item => {
    if (!item || typeof item.image !== "string") return;
    const localImage = useLocalImage(item.image);
    if (item.image !== localImage) {
      item.image = localImage;
      migrated = true;
    }
  };
  content.gallery?.forEach(replaceImage);
  content.specialties?.forEach(replaceImage);
  if (content.promotion?.image) {
    const localImage = useLocalImage(content.promotion.image);
    if (content.promotion.image !== localImage) {
      content.promotion.image = localImage;
      migrated = true;
    }
  }
  return migrated;
}

export function createDatabase(databasePath = path.resolve(here, "../data/clinic.sqlite"), credentials) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_content (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      content_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER NOT NULL CHECK (age BETWEEN 1 AND 120),
      gender TEXT NOT NULL CHECK (gender IN ('Female', 'Male', 'Other')),
      phone TEXT NOT NULL CHECK (length(phone) = 10),
      email TEXT NOT NULL DEFAULT '',
      problem TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'done', 'cancelled')),
      requested_at TEXT NOT NULL,
      status_updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS appointments_status_requested
      ON appointments(status, requested_at DESC);
    CREATE INDEX IF NOT EXISTS appointments_phone_status
      ON appointments(phone, status);
    CREATE TABLE IF NOT EXISTS admin_account (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      username TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL DEFAULT 'Clinic Administrator',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT ''
    );
  `);
  const appointmentColumns = db.prepare("PRAGMA table_info(appointments)").all();
  if (!appointmentColumns.some(column => column.name === "problem")) {
    db.exec("ALTER TABLE appointments ADD COLUMN problem TEXT NOT NULL DEFAULT ''");
  }

  if (credentials) {
    const admin = db.prepare("SELECT id FROM admin_account WHERE id = 1").get();
    if (!admin) {
      const salt = crypto.randomBytes(16).toString("hex");
      db.prepare("INSERT INTO admin_account (id, username, password_salt, password_hash) VALUES (1, ?, ?, ?)")
        .run(credentials.username, salt, makePasswordHash(credentials.password, salt));
    }
  }

  const initialContent = JSON.parse(fs.readFileSync(defaultSeedPath, "utf8"));
  const seeded = db.prepare("SELECT content_json FROM site_content WHERE id = 1").get();
  if (!seeded) {
    db.prepare("INSERT INTO site_content (id, content_json, updated_at) VALUES (1, ?, ?)")
      .run(JSON.stringify(initialContent), new Date().toISOString());
  } else {
    const existingContent = JSON.parse(seeded.content_json);
    let migrated = false;
    if (!Array.isArray(existingContent.reviews)) {
      existingContent.reviews = initialContent.reviews;
      migrated = true;
    }
    if (!Array.isArray(existingContent.specialties)) {
      existingContent.specialties = [];
      migrated = true;
    }
    for (const specialty of initialContent.specialties) {
      const existingSpecialty = existingContent.specialties.find(item => item.slug === specialty.slug);
      if (!existingSpecialty) {
        existingContent.specialties.push({ ...specialty });
        migrated = true;
      } else {
        for (const field of ["descriptionEn", "descriptionHi"]) {
          if (typeof existingSpecialty[field] !== "string" || !existingSpecialty[field].trim()) {
            existingSpecialty[field] = specialty[field];
            migrated = true;
          }
        }
      }
    }
    const imageCounts = new Map();
    for (const specialty of existingContent.specialties) {
      const key = typeof specialty.image === "string" ? specialty.image.toLowerCase() : "";
      if (key) imageCounts.set(key, (imageCounts.get(key) || 0) + 1);
    }
    const duplicatedImages = new Set(
      [...imageCounts].filter(([, count]) => count > 1).map(([image]) => image)
    );
    if (duplicatedImages.size) {
      const seededBySlug = new Map(initialContent.specialties.map(item => [item.slug, item]));
      for (const specialty of existingContent.specialties) {
        if (duplicatedImages.has(String(specialty.image || "").toLowerCase())) {
          const seededSpecialty = seededBySlug.get(specialty.slug);
          if (seededSpecialty && specialty.image !== seededSpecialty.image) {
            specialty.image = seededSpecialty.image;
            migrated = true;
          }
        }
      }
    }
    if (existingContent.clinic && !existingContent.clinic.phones?.length) {
      existingContent.clinic.phones = initialContent.clinic.phones;
      migrated = true;
    }
    if (existingContent.clinic && !existingContent.clinic.address) {
      existingContent.clinic.address = initialContent.clinic.address;
      migrated = true;
    }
    if (existingContent.clinic && !existingContent.clinic.email) {
      existingContent.clinic.email = initialContent.clinic.email;
      migrated = true;
    }
    migrated = localizeImages(existingContent) || migrated;
    if (migrated) {
      db.prepare("UPDATE site_content SET content_json = ?, updated_at = ? WHERE id = 1")
        .run(JSON.stringify(existingContent), new Date().toISOString());
    }
  }
  return db;
}

export function getSiteContent(db) {
  const row = db.prepare("SELECT content_json FROM site_content WHERE id = 1").get();
  if (!row) throw new Error("Clinic website content has not been initialized.");
  return JSON.parse(row.content_json);
}

export function verifyAdminCredentials(db, username, password) {
  const admin = db.prepare("SELECT username, password_salt, password_hash FROM admin_account WHERE id = 1").get();
  if (!admin || admin.username !== username) return false;
  const actual = Buffer.from(makePasswordHash(password, admin.password_salt), "hex");
  const expected = Buffer.from(admin.password_hash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function getAdminProfile(db) {
  return db.prepare(`
    SELECT username, full_name AS fullName, phone, email, image_url AS imageUrl
    FROM admin_account WHERE id = 1
  `).get();
}

export function saveAdminProfile(db, profile) {
  db.prepare("UPDATE admin_account SET full_name = ?, phone = ?, email = ?, image_url = ? WHERE id = 1")
    .run(profile.fullName, profile.phone, profile.email, profile.imageUrl);
}

export function changeAdminPassword(db, currentPassword, newPassword) {
  if (!verifyAdminCredentials(db, getAdminProfile(db).username, currentPassword)) return false;
  const salt = crypto.randomBytes(16).toString("hex");
  db.prepare("UPDATE admin_account SET password_salt = ?, password_hash = ? WHERE id = 1")
    .run(salt, makePasswordHash(newPassword, salt));
  return true;
}
