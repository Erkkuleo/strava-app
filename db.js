const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "stats.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS seen_activities (
    fingerprint TEXT PRIMARY KEY,
    athlete_name TEXT,
    km REAL,
    first_seen TEXT
  );
`);

function isActivitySeen(fingerprint) {
  return !!db.prepare("SELECT 1 FROM seen_activities WHERE fingerprint = ?").get(fingerprint);
}

function recordActivity(fingerprint, athleteName, km) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO seen_activities (fingerprint, athlete_name, km, first_seen)
    VALUES (?, ?, ?, ?)
  `).run(fingerprint, athleteName, km, now);
}

function getStats() {
  const rows = db.prepare(
    "SELECT athlete_name, SUM(km) as total_km, COUNT(*) as activities FROM seen_activities GROUP BY athlete_name ORDER BY total_km DESC"
  ).all();
  const grandTotal = rows.reduce((sum, r) => sum + r.total_km, 0);
  const lastUpdatedRow = db.prepare("SELECT MAX(first_seen) as last_updated FROM seen_activities").get();

  return {
    grandTotalKm: Math.round(grandTotal * 100) / 100,
    lastUpdated: lastUpdatedRow?.last_updated || null,
    athletes: rows.map((r) => ({
      name: r.athlete_name,
      totalKm: Math.round(r.total_km * 100) / 100,
      activities: r.activities,
    })),
  };
}

module.exports = { isActivitySeen, recordActivity, getStats };
