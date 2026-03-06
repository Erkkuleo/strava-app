const fs = require("fs");
const path = require("path");

const STORE_PATH = path.join(__dirname, "athletes.json");

function load() {
  if (!fs.existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function save(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

function saveAthlete(athlete) {
  const store = load();
  store[athlete.id] = athlete;
  save(store);
  console.log(`[Store] Saved athlete: ${athlete.firstname} ${athlete.lastname} (${athlete.id})`);
}

function updateAthleteTokens(id, accessToken, refreshToken, expiresAt) {
  const store = load();
  if (!store[id]) throw new Error(`Athlete ${id} not found in store`);
  store[id].access_token = accessToken;
  store[id].refresh_token = refreshToken;
  store[id].expires_at = expiresAt;
  save(store);
}

function getAthletes() {
  return Object.values(load());
}

module.exports = { saveAthlete, updateAthleteTokens, getAthletes };
