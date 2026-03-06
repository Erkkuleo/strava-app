const express = require("express");
const { fetchClubActivities, fetchClubInfo, aggregateActivities, fetchAthleteActivities } = require("./stravaClub");
const { exchangeCode, refreshAthleteToken, getAuthUrl } = require("./stravaAuth");
const { saveAthlete, updateAthleteTokens, getAthletes } = require("./athleteStore");
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

/**
 * GET /auth/login
 * Redirects the club member to Strava to authorize the app.
 * Send this link to each member so they can connect their account.
 */
router.get("/auth/login", (_req, res) => {
  res.redirect(getAuthUrl());
});

/**
 * GET /auth/callback
 * Strava redirects here after the member authorizes.
 * Exchanges the code for tokens and saves the athlete.
 */
router.get("/auth/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.status(400).json({ error: error || "No code returned from Strava" });
  }

  try {
    const data = await exchangeCode(code);
    const { access_token, refresh_token, expires_at, athlete } = data;

    saveAthlete({
      id: athlete.id,
      firstname: athlete.firstname,
      lastname: athlete.lastname,
      access_token,
      refresh_token,
      expires_at,
    });

    res.json({
      message: `Connected! Welcome ${athlete.firstname} ${athlete.lastname}. Your activities will now be tracked.`,
      athlete: { id: athlete.id, name: `${athlete.firstname} ${athlete.lastname}` },
    });
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * GET /auth/members
 * Lists all athletes who have connected their Strava account.
 */
router.get("/auth/members", (_req, res) => {
  const athletes = getAthletes().map((a) => ({
    id: a.id,
    name: `${a.firstname} ${a.lastname}`,
  }));
  res.json({ count: athletes.length, members: athletes });
});

/**
 * GET /api/km?after=YYYY-MM-DD
 * Fetches all activities after the given date for every connected member
 * and returns aggregated kilometer totals.
 *
 * Query params:
 *   after  - date string, e.g. "2025-03-01" (required)
 *   sport  - optional filter, e.g. "Run"
 */
router.get("/km", async (req, res) => {
  const { after, sport } = req.query;

  if (!after) {
    return res.status(400).json({ error: "after param is required, e.g. ?after=2025-03-01" });
  }

  const afterTimestamp = Math.floor(new Date(after).getTime() / 1000);
  if (isNaN(afterTimestamp)) {
    return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
  }

  const athletes = getAthletes();
  if (athletes.length === 0) {
    return res.status(404).json({ error: "No members connected yet. Share /auth/login with your club members." });
  }

  const results = [];
  let grandTotalKm = 0;

  for (const athlete of athletes) {
    try {
      // Refresh token if expired
      let accessToken = athlete.access_token;
      if (!athlete.expires_at || Date.now() / 1000 > athlete.expires_at - 60) {
        const refreshed = await refreshAthleteToken(athlete.refresh_token);
        accessToken = refreshed.access_token;
        updateAthleteTokens(athlete.id, refreshed.access_token, refreshed.refresh_token, refreshed.expires_at);
      }

      let activities = await fetchAthleteActivities(accessToken, afterTimestamp);

      if (sport) {
        const filter = sport.toLowerCase();
        activities = activities.filter((a) =>
          (a.sport_type || a.type || "").toLowerCase().includes(filter)
        );
      }

      const totalKm = activities.reduce((sum, a) => sum + (a.distance || 0) / 1000, 0);
      const rounded = Math.round(totalKm * 100) / 100;
      grandTotalKm += totalKm;

      results.push({
        athlete: `${athlete.firstname} ${athlete.lastname}`,
        activities: activities.length,
        totalKm: rounded,
      });
    } catch (err) {
      console.error(`[km] Failed for athlete ${athlete.id}:`, err.message);
      results.push({
        athlete: `${athlete.firstname} ${athlete.lastname}`,
        error: "Failed to fetch activities",
      });
    }
  }

  results.sort((a, b) => (b.totalKm || 0) - (a.totalKm || 0));

  res.json({
    after,
    sport: sport || "all",
    grandTotalKm: Math.round(grandTotalKm * 100) / 100,
    leaderboard: results,
  });
});

/**
 * GET /api/stats
 * Returns aggregated km totals from the database (populated by the daily cron job).
 * Used by the frontend.
 */
router.get("/stats", (_req, res) => {
  const stats = getStats();
  res.json({ since: "2026-03-01", ...stats });
});

function handleError(err, res) {
  console.error("[Error]", err.message);
  const status = err.response?.status || 500;
  const message = err.response?.data?.message || err.message;
  res.status(status).json({ error: message });
}

module.exports = router;
