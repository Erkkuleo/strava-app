const axios = require("axios");

let cachedToken = null;
let tokenExpiry = null;

/**
 * Exchanges the refresh token for a new access token.
 * Caches it until it expires.
 */
async function getAccessToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = process.env;

  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
    throw new Error("Missing Strava credentials in environment variables.");
  }

  const response = await axios.post("https://www.strava.com/oauth/token", {
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    refresh_token: STRAVA_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });

  const { access_token, expires_at } = response.data;
  cachedToken = access_token;
  // expires_at is a unix timestamp in seconds
  tokenExpiry = expires_at * 1000 - 60_000; // refresh 1 minute early

  console.log(`[Auth] Got new access token, expires at ${new Date(tokenExpiry).toISOString()}`);
  return cachedToken;
}

module.exports = { getAccessToken };
