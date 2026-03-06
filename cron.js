const cron = require("node-cron");
const { fetchClubActivities } = require("./stravaClub");
const { isActivitySeen, recordActivity, hasAnyActivities } = require("./db");

function fingerprint(activity) {
  const first = activity.athlete?.firstname || "";
  const last = activity.athlete?.lastname || "";
  const dist = Math.round(activity.distance || 0);
  const elapsed = activity.elapsed_time || 0;
  const type = activity.sport_type || activity.type || "unknown";
  return `${first}_${last}_${dist}_${elapsed}_${type}`;
}

// baseline=true: marks activities as seen with 0 km (used on first run / reset)
async function runFetch(baseline = false) {
  const clubId = process.env.STRAVA_CLUB_ID;
  if (!clubId) {
    console.error("[Cron] STRAVA_CLUB_ID not set.");
    return;
  }

  console.log(`[Cron] Fetching club activities${baseline ? " (baseline)" : ""}...`);
  try {
    const activities = await fetchClubActivities(clubId);
    let newCount = 0;

    for (const activity of activities) {
      const fp = fingerprint(activity);
      if (!isActivitySeen(fp)) {
        const km = baseline ? 0 : (activity.distance || 0) / 1000;
        const athleteName = `${activity.athlete?.firstname || "?"} ${activity.athlete?.lastname || "?"}`;
        recordActivity(fp, athleteName, km);
        newCount++;
      }
    }

    console.log(`[Cron] Done. ${newCount} activities ${baseline ? "baselined at 0 km" : "recorded"} out of ${activities.length} fetched.`);
  } catch (err) {
    console.error("[Cron] Failed:", err.message);
  }
}

async function runCycle() {
  // 1. Count any new activities from existing members
  await runFetch(false);
  // 2. Baseline anything still unseen — zeros out old activities from members who just joined
  await runFetch(true);
}

function startCron() {
  // Run full cycle every 30 minutes
  cron.schedule("*/30 * * * *", runCycle);
  console.log("[Cron] Scheduled fetch+baseline cycle every 30 minutes.");

  if (!hasAnyActivities()) {
    console.log("[Cron] Fresh database — baselining existing activities at 0 km...");
    runFetch(true);
  } else {
    runCycle();
  }
}

module.exports = { startCron, runFetch };
