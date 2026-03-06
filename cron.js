const cron = require("node-cron");
const { getAthletes, updateAthleteTokens } = require("./athleteStore");
const { refreshAthleteToken } = require("./stravaAuth");
const { fetchAthleteActivities } = require("./stravaClub");
const { upsertAthleteStats } = require("./db");

// Fetch all activities since March 6, 2026 (challenge start)
const START_TIMESTAMP = Math.floor(new Date("2026-03-06T00:00:00Z").getTime() / 1000);

async function runDailyFetch() {
  console.log("[Cron] Starting fetch...");
  const athletes = getAthletes();

  if (athletes.length === 0) {
    console.log("[Cron] No athletes connected yet. Share /api/auth/login with club members.");
    return;
  }

  for (const athlete of athletes) {
    try {
      let accessToken = athlete.access_token;
      if (!athlete.expires_at || Date.now() / 1000 > athlete.expires_at - 60) {
        const refreshed = await refreshAthleteToken(athlete.refresh_token);
        accessToken = refreshed.access_token;
        updateAthleteTokens(athlete.id, refreshed.access_token, refreshed.refresh_token, refreshed.expires_at);
      }

      const activities = await fetchAthleteActivities(accessToken, START_TIMESTAMP);
      const totalKm = activities.reduce((sum, a) => sum + (a.distance || 0) / 1000, 0);
      const name = `${athlete.firstname} ${athlete.lastname}`;

      upsertAthleteStats(athlete.id, name, totalKm, activities.length);
      console.log(`[Cron] ${name}: ${Math.round(totalKm * 100) / 100} km (${activities.length} activities)`);
    } catch (err) {
      console.error(`[Cron] Failed for athlete ${athlete.id}:`, err.message);
    }
  }

  console.log("[Cron] Fetch complete.");
}

function startCron() {
  // Run at 17:00 every day
  cron.schedule("0 17 * * *", runDailyFetch);
  console.log("[Cron] Scheduled daily fetch at 17:00.");
  runDailyFetch();
}

module.exports = { startCron, runDailyFetch };
