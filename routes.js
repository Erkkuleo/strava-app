const express = require("express");
const { exchangeCode, getAuthUrl } = require("./stravaAuth");
const { saveAthlete, getAthletes } = require("./athleteStore");
const { getStats } = require("./db");

const router = express.Router();

/**
 * GET /api/auth/login
 * Redirect the club member to Strava to authorize the app.
 * Share this URL with all club members — they only need to do it once.
 */
router.get("/auth/login", (_req, res) => {
  res.redirect(getAuthUrl());
});

/**
 * GET /api/auth/callback
 * Strava redirects here after the member authorizes.
 */
router.get("/auth/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.status(400).send(`<h2>Authorization failed: ${error || "no code returned"}</h2>`);
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

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Connected!</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            background: #fc4c02;
            color: white;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            text-align: center;
            padding: 24px;
          }
          h1 { font-size: 2.5rem; font-weight: 800; }
          p { font-size: 1.1rem; opacity: 0.85; }
          .check { font-size: 4rem; }
        </style>
      </head>
      <body>
        <div class="check">✓</div>
        <h1>You're connected!</h1>
        <p>Welcome, ${athlete.firstname}! Your Strava activities will now be tracked for the challenge.</p>
        <p>You can close this page.</p>
      </body>
      </html>
    `);
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * GET /api/auth/members
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
 * GET /api/stats
 * Returns cumulative km totals from the database (updated daily at 17:00).
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
