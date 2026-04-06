const express = require("express");
const router = express.Router();
const { getDB } = require("../db");

// GET /api/stats — global platform stats
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const totalReviewsRes = await db.query("SELECT COUNT(*) FROM reviews");
    const avgRatingRes = await db.query("SELECT ROUND(AVG(rating), 2) FROM reviews");
    const totalBrandsRes = await db.query(
      `SELECT COUNT(*) FROM brands 
       WHERE id IN (SELECT DISTINCT brand_id FROM reviews)`
    );
    const regionBreakdownRes = await db.query(
      `SELECT region, COUNT(*) 
       FROM reviews 
       GROUP BY region 
       ORDER BY COUNT(*) DESC`
    );
    const topBrandsRes = await db.query(
      `SELECT brand_name, 
              ROUND(AVG(rating), 1) AS avg_rating, 
              COUNT(*) AS reviews
       FROM reviews 
       GROUP BY brand_name 
       ORDER BY avg_rating DESC, reviews DESC 
       LIMIT 5`
    );
    const recentActivityRes = await db.query(
      `SELECT DATE(created_at) AS date, COUNT(*) 
       FROM reviews 
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at) 
       ORDER BY date ASC`
    );

    res.json({
      success: true,
      data: {
        totalReviews: Number(totalReviewsRes.rows[0].count),
        avgRating: Number(avgRatingRes.rows[0].avg) || 0,
        totalBrands: Number(totalBrandsRes.rows[0].count),
        regionBreakdown: regionBreakdownRes.rows,
        topBrands: topBrandsRes.rows,
        recentActivity: recentActivityRes.rows,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

module.exports = router;