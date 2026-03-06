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
  tokenExpiry = expires_at * 1000 - 60_000; // refresh 1 minute early

  console.log(`[Auth] Got new access token, expires at ${new Date(tokenExpiry).toISOString()}`);
  return cachedToken;
}

/**
 * Exchanges an OAuth authorization code for tokens + athlete info.
 * Returns the full token response including athlete object.
 */
async function exchangeCode(code) {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } = process.env;
  const response = await axios.post("https://www.strava.com/oauth/token", {
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
  });
  return response.data; // { access_token, refresh_token, expires_at, athlete }
}

/**
 * Refreshes an individual athlete's access token using their stored refresh token.
 * Returns { access_token, refresh_token, expires_at }.
 */
async function refreshAthleteToken(refreshToken) {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } = process.env;
  const response = await axios.post("https://www.strava.com/oauth/token", {
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  return response.data;
}

/**
 * Builds the Strava OAuth authorization URL for member sign-in.
 */
function getAuthUrl() {
  const { STRAVA_CLIENT_ID, STRAVA_REDIRECT_URI } = process.env;
  const redirectUri = STRAVA_REDIRECT_URI || "http://localhost:3000/auth/callback";
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "read,activity:read",
    approval_prompt: "auto",
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

module.exports = { getAccessToken, exchangeCode, refreshAthleteToken, getAuthUrl };
