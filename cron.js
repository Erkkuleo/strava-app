const cron = require("node-cron");
const { fetchClubActivities } = require("./stravaClub");
const { isActivitySeen, recordActivity } = require("./db");

function fingerprint(activity) {
  const first = activity.athlete?.firstname || "";
  const last = activity.athlete?.lastname || "";
  const dist = Math.round(activity.distance || 0);
  const elapsed = activity.elapsed_time || 0;
  const type = activity.sport_type || activity.type || "unknown";
  return `${first}_${last}_${dist}_${elapsed}_${type}`;
}

async function runFetch() {
  const clubId = process.env.STRAVA_CLUB_ID;
  if (!clubId) {
    console.error("[Cron] STRAVA_CLUB_ID not set.");
    return;
  }

  console.log("[Cron] Fetching club activities...");
  try {
    const activities = await fetchClubActivities(clubId);
    let newCount = 0;

    for (const activity of activities) {
      const fp = fingerprint(activity);
      if (!isActivitySeen(fp)) {
        const km = (activity.distance || 0) / 1000;
        const athleteName = `${activity.athlete?.firstname || "?"} ${activity.athlete?.lastname || "?"}`;
        recordActivity(fp, athleteName, km);
        newCount++;
      }
    }

    console.log(`[Cron] Done. ${newCount} new activities recorded (${activities.length} fetched).`);
  } catch (err) {
    console.error("[Cron] Failed:", err.message);
  }
}

function startCron() {
  // Run every 30 minutes so activities don't scroll off the 200-activity window
  cron.schedule("*/30 * * * *", runFetch);
  console.log("[Cron] Scheduled fetch every 30 minutes.");
  runFetch();
}

module.exports = { startCron, runFetch };
