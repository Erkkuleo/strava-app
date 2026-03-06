const express = require("express");
const { fetchClubActivities, fetchClubInfo, aggregateActivities } = require("./stravaClub");
const { getStats } = require("./db");

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

    res.json({ clubId, count: activities.length, activities });
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * GET /api/kilometers
 * Returns aggregated kilometer stats for the club (live, from most recent 200 activities).
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

    res.json({ clubId, ...aggregateActivities(activities) });
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * GET /api/stats
 * Returns cumulative km totals from the database (populated every 30 minutes by cron).
 * Used by the frontend.
 */
router.get("/stats", (_req, res) => {
  const stats = getStats();
  res.json({ since: "2026-03-06", ...stats });
});

function handleError(err, res) {
  console.error("[Error]", err.message);
  const status = err.response?.status || 500;
  const message = err.response?.data?.message || err.message;
  res.status(status).json({ error: message });
}

module.exports = router;
