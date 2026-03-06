const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "stats.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS athlete_stats (
    athlete_id INTEGER PRIMARY KEY,
    athlete_name TEXT NOT NULL,
    total_km REAL DEFAULT 0,
    activities_count INTEGER DEFAULT 0,
    last_updated TEXT
  );

  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id INTEGER,
    athlete_name TEXT,
    snapshot_date TEXT,
    total_km REAL,
    activities_count INTEGER,
    UNIQUE(athlete_id, snapshot_date)
  );
`);

function upsertAthleteStats(athleteId, athleteName, totalKm, activitiesCount) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO athlete_stats (athlete_id, athlete_name, total_km, activities_count, last_updated)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(athlete_id) DO UPDATE SET
      athlete_name = excluded.athlete_name,
      total_km = excluded.total_km,
      activities_count = excluded.activities_count,
      last_updated = excluded.last_updated
  `).run(athleteId, athleteName, totalKm, activitiesCount, now);
}

function saveSnapshot(athleteId, athleteName, totalKm, activitiesCount) {
  const date = new Date().toISOString().split("T")[0];
  db.prepare(`
    INSERT INTO snapshots (athlete_id, athlete_name, snapshot_date, total_km, activities_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(athlete_id, snapshot_date) DO UPDATE SET
      total_km = excluded.total_km,
      activities_count = excluded.activities_count
  `).run(athleteId, athleteName, date, totalKm, activitiesCount);
}

function getStats() {
  const athletes = db.prepare("SELECT * FROM athlete_stats ORDER BY total_km DESC").all();
  const grandTotal = athletes.reduce((sum, a) => sum + a.total_km, 0);
  const lastUpdated = athletes.length > 0
    ? athletes.reduce((latest, a) => (!latest || a.last_updated > latest ? a.last_updated : latest), null)
    : null;

  return {
    grandTotalKm: Math.round(grandTotal * 100) / 100,
    lastUpdated,
    athletes: athletes.map((a) => ({
      id: a.athlete_id,
      name: a.athlete_name,
      totalKm: Math.round(a.total_km * 100) / 100,
      activities: a.activities_count,
    })),
  };
}

module.exports = { upsertAthleteStats, saveSnapshot, getStats };
