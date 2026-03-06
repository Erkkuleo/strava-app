const express = require("express");
const { fetchClubActivities, fetchClubInfo, aggregateActivities } = require("./stravaClub");

const router = express.Router();

/**
 * GET /api/club
 * Returns basic Strava club info.
 */
router.get("/club", async (req, res) => {
  const clubId = req.query.clubId || process.env.STRAVA_CLUB_ID;
  if (!clubId) return res.status(400).json({ error: "clubId is required" });

  try {
    const info = await fetchClubInfo(clubId);
    res.json({ clubId, info });
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * GET /api/activities
 * Returns raw list of recent club activities (up to 200, Strava API limit).
 *
 * Query params:
 *   clubId  - Strava club ID (falls back to STRAVA_CLUB_ID env var)
 *   sport   - optional filter, e.g. "Run", "Ride"
 */
router.get("/activities", async (req, res) => {
  const clubId = req.query.clubId || process.env.STRAVA_CLUB_ID;
  if (!clubId) return res.status(400).json({ error: "clubId is required" });

  try {
    let activities = await fetchClubActivities(clubId);

    if (req.query.sport) {
      const filter = req.query.sport.toLowerCase();
      activities = activities.filter(
        (a) => (a.sport_type || a.type || "").toLowerCase().includes(filter)
      );
    }

    res.json({
      clubId,
      count: activities.length,
      note: "Strava limits club activities to the most recent 200.",
      activities,
    });
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * GET /api/kilometers
 * Returns aggregated kilometer stats for the club.
 * This is the main endpoint you probably want.
 *
 * Query params:
 *   clubId  - Strava club ID (falls back to STRAVA_CLUB_ID env var)
 *   sport   - optional filter, e.g. "Run" to show only running stats
 */
router.get("/kilometers", async (req, res) => {
  const clubId = req.query.clubId || process.env.STRAVA_CLUB_ID;
  if (!clubId) return res.status(400).json({ error: "clubId is required" });

  try {
    let activities = await fetchClubActivities(clubId);

    if (req.query.sport) {
      const filter = req.query.sport.toLowerCase();
      activities = activities.filter(
        (a) => (a.sport_type || a.type || "").toLowerCase().includes(filter)
      );
    }

    const stats = aggregateActivities(activities);

    res.json({
      clubId,
      note: "Strava limits club activities to the most recent 200. No date filtering is available via the Club API.",
      ...stats,
    });
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * GET /api/running
 * Shortcut — returns only Run activities with full breakdown.
 */
router.get("/running", async (req, res) => {
  const clubId = req.query.clubId || process.env.STRAVA_CLUB_ID;
  if (!clubId) return res.status(400).json({ error: "clubId is required" });

  try {
    const allActivities = await fetchClubActivities(clubId);
    const runActivities = allActivities.filter((a) =>
      ["Run", "VirtualRun", "TrailRun"].includes(a.sport_type || a.type)
    );

    const stats = aggregateActivities(runActivities);

    res.json({
      clubId,
      note: "Showing only Run / VirtualRun / TrailRun activities. Strava caps club data at the most recent 200 activities total.",
      totalRunningKm: stats.grandTotalKm,
      totalRuns: stats.totalActivities,
      bySport: stats.bySport,
      leaderboard: stats.athleteLeaderboard,
    });
  } catch (err) {
    handleError(err, res);
  }
});

function handleError(err, res) {
  console.error("[Error]", err.message);
  const status = err.response?.status || 500;
  const message = err.response?.data?.message || err.message;
  res.status(status).json({ error: message });
}

module.exports = router;
