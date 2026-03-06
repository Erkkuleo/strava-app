const axios = require("axios");
const { getAccessToken } = require("./stravaAuth");

const STRAVA_API = "https://www.strava.com/api/v3";

/**
 * Fetches all available activities for a club by paginating through pages.
 * Note: Strava caps club activities at 200 total regardless of pagination.
 * Activities have no date or activity ID (Strava API limitation).
 */
async function fetchClubActivities(clubId) {
  const token = await getAccessToken();
  const allActivities = [];
  let page = 1;
  const perPage = 200; // max per page

  while (true) {
    const response = await axios.get(`${STRAVA_API}/clubs/${clubId}/activities`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { per_page: perPage, page },
    });

    const activities = response.data;
    if (!activities || activities.length === 0) break;

    allActivities.push(...activities);
    console.log(`[Club] Page ${page}: fetched ${activities.length} activities`);

    // Strava stops returning results after page 1 for clubs (hard limit of 200)
    if (activities.length < perPage) break;
    page++;
  }

  return allActivities;
}

/**
 * Fetches basic club info (name, member count, sport type, etc.)
 */
async function fetchClubInfo(clubId) {
  const token = await getAccessToken();
  const response = await axios.get(`${STRAVA_API}/clubs/${clubId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

/**
 * Takes raw activities and aggregates running kilometers.
 * Groups by athlete (first name + last initial) and sport type.
 */
function aggregateActivities(activities) {
  const sportTotals = {};
  const athleteTotals = {};
  let grandTotalKm = 0;

  for (const activity of activities) {
    const distanceKm = (activity.distance || 0) / 1000;
    const sport = normalizeSportType(activity.sport_type || activity.type || "Unknown");
    const athleteKey = `${activity.athlete?.firstname || "?"} ${activity.athlete?.lastname || "?"}`;

    // Sport totals
    if (!sportTotals[sport]) {
      sportTotals[sport] = { count: 0, distanceKm: 0, movingTimeSec: 0 };
    }
    sportTotals[sport].count++;
    sportTotals[sport].distanceKm += distanceKm;
    sportTotals[sport].movingTimeSec += activity.moving_time || 0;

    // Athlete totals
    if (!athleteTotals[athleteKey]) {
      athleteTotals[athleteKey] = { activities: 0, distanceKm: 0, sports: {} };
    }
    athleteTotals[athleteKey].activities++;
    athleteTotals[athleteKey].distanceKm += distanceKm;
    if (!athleteTotals[athleteKey].sports[sport]) {
      athleteTotals[athleteKey].sports[sport] = 0;
    }
    athleteTotals[athleteKey].sports[sport] += distanceKm;

    grandTotalKm += distanceKm;
  }

  // Round all km values to 2 decimal places
  for (const s of Object.values(sportTotals)) {
    s.distanceKm = round2(s.distanceKm);
  }
  for (const a of Object.values(athleteTotals)) {
    a.distanceKm = round2(a.distanceKm);
    for (const sport of Object.keys(a.sports)) {
      a.sports[sport] = round2(a.sports[sport]);
    }
  }

  // Sort athlete leaderboard by total distance descending
  const athleteLeaderboard = Object.entries(athleteTotals)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.distanceKm - a.distanceKm);

  return {
    grandTotalKm: round2(grandTotalKm),
    totalActivities: activities.length,
    bySport: sportTotals,
    athleteLeaderboard,
  };
}

function normalizeSportType(type) {
  // Normalize newer sport_type values alongside legacy type values
  const map = {
    Run: "Run",
    VirtualRun: "Virtual Run",
    TrailRun: "Trail Run",
    Ride: "Ride",
    VirtualRide: "Virtual Ride",
    MountainBikeRide: "Mountain Bike",
    Walk: "Walk",
    Hike: "Hike",
    Swim: "Swim",
    Workout: "Workout",
  };
  return map[type] || type;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { fetchClubActivities, fetchClubInfo, aggregateActivities };
