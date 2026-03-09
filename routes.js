const express = require("express");
const { getStats, clearActivities, saveOffset, clearOffset } = require("./db");
const { runFetch } = require("./cron");

const router = express.Router();

/**
 * GET /api/stats
 * Returns cumulative km totals from the database (updated every 30 minutes).
 * Used by the frontend.
 */
router.get("/stats", (_req, res) => {
  const stats = getStats();
  res.json({ since: "2026-03-06", ...stats });
});

/**
 * POST /api/admin/reset
 * Saves the current total as an offset, clears activity data, then re-baselines.
 * The counter resumes from the saved total so it never drops to 0.
 * Requires ADMIN_SECRET env var passed as X-Admin-Secret header.
 */
router.post("/admin/reset", (req, res) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers["x-admin-secret"] !== secret) {
    return res.status(401).json({ error: "Unauthorized. Set ADMIN_SECRET env var and pass it as X-Admin-Secret header." });
  }

  const { grandTotalKm } = getStats();
  saveOffset(grandTotalKm);
  clearActivities();
  runFetch(true);

  res.json({
    message: "Database cleared and re-baselined.",
    savedTotal: grandTotalKm,
    note: "Counter resumes from saved total. New activities will be added on top.",
  });
});

/**
 * POST /api/admin/reset-all
 * Wipes everything including the km offset — counter goes back to absolute 0.
 * Requires ADMIN_SECRET env var passed as X-Admin-Secret header.
 */
router.post("/admin/reset-all", (req, res) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers["x-admin-secret"] !== secret) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  clearOffset();
  clearActivities();
  runFetch(true);

  res.json({ message: "Full reset done. Counter is back to 0." });
});

module.exports = router;
