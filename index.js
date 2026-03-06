require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const routes = require("./routes");
const { startCron } = require("./cron");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Health check
app.get("/", (req, res) => {
  res.json({
    name: "Strava Club Kilometers API",
    endpoints: [
      "GET /api/club?clubId=<id>          — Club info",
      "GET /api/activities?clubId=<id>    — Raw activities (max 200)",
      "GET /api/kilometers?clubId=<id>    — Aggregated km by sport + athlete",
      "GET /api/running?clubId=<id>       — Running km only + leaderboard",
    ],
  });
});

app.use("/api", routes);

// Global error handler
app.use((err, req, res, next) => {
  console.error("[Unhandled]", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Strava Club API running on http://localhost:${PORT}`);
  console.log(`Club ID from env: ${process.env.STRAVA_CLUB_ID || "(not set)"}`);
  startCron();
});
