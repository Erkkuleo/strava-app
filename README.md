# Strava Club Kilometers API

A Node.js/Express backend that fetches activity data from a Strava Club and aggregates running (and other sport) kilometers.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `STRAVA_CLIENT_ID` | From your Strava API app at developers.strava.com |
| `STRAVA_CLIENT_SECRET` | From your Strava API app |
| `STRAVA_REFRESH_TOKEN` | OAuth refresh token (see below) |
| `STRAVA_CLUB_ID` | Your club's numeric ID (visible in the club URL on Strava) |
| `PORT` | Server port (default: 3000) |

### 3. Get your Refresh Token

You need to authorize your app once to get a refresh token with `activity:read` scope:

1. Go to `https://www.strava.com/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost&response_type=code&scope=activity:read,read`
2. Authorize the app — you'll be redirected to `http://localhost?code=XXXXX`
3. Exchange the code for tokens:

```bash
curl -X POST https://www.strava.com/oauth/token \
  -d client_id=YOUR_CLIENT_ID \
  -d client_secret=YOUR_CLIENT_SECRET \
  -d code=XXXXX \
  -d grant_type=authorization_code
```

4. Copy the `refresh_token` from the response into your `.env`.

### 4. Run the server

```bash
npm start        # production
npm run dev      # with auto-reload (requires nodemon)
```

---

## API Endpoints

### `GET /`
Health check — lists all available endpoints.

---

### `GET /api/club?clubId=<id>`
Returns club info (name, sport type, member count, etc.).

---

### `GET /api/activities?clubId=<id>&sport=Run`
Returns raw club activities (max 200 — Strava API hard limit).

**Query params:**
- `clubId` — overrides the env var
- `sport` — optional filter (e.g. `Run`, `Ride`)

---

### `GET /api/kilometers?clubId=<id>&sport=Run`
**Main endpoint.** Returns aggregated km stats:
- Grand total km
- Breakdown by sport
- Per-athlete leaderboard

**Example response:**
```json
{
  "clubId": "123456",
  "grandTotalKm": 842.5,
  "totalActivities": 87,
  "bySport": {
    "Run": { "count": 54, "distanceKm": 620.3, "movingTimeSec": 198000 },
    "Ride": { "count": 33, "distanceKm": 222.2, "movingTimeSec": 36000 }
  },
  "athleteLeaderboard": [
    { "name": "Erkka V.", "activities": 12, "distanceKm": 145.2, "sports": { "Run": 145.2 } }
  ]
}
```

---

### `GET /api/running?clubId=<id>`
Shortcut — filters to only Run/VirtualRun/TrailRun activities and returns a running-specific leaderboard.

---

## Known Strava API Limitations

- **Max 200 activities** returned from the Club endpoint — no way around this.
- **No timestamps** on club activities — you can't filter by date range via this API.
- **No activity IDs** — deduplication is not possible with certainty.
- **Athlete ID is not exposed** — only first name + last initial.

The only way to get full historical data with dates is to have each club member individually authorize your app via OAuth.
