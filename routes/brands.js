const express = require("express");
const router = express.Router();
const { getDB } = require("../db");

// GET /api/brands — list all brands with avg rating
router.get("/", async (req, res) => {
  try {
    const db = getDB();

    const result = await db.query(`
      SELECT 
        b.id, b.name, b.slug, b.category,
        COUNT(r.id) AS review_count,
        ROUND(AVG(r.rating), 1) AS avg_rating
      FROM brands b
      LEFT JOIN reviews r ON r.brand_id = b.id
      GROUP BY b.id
      ORDER BY review_count DESC, b.name ASC
    `);

    const brands = result.rows.map(b => ({
      ...b,
      review_count: Number(b.review_count),
      avg_rating: b.avg_rating ? Number(b.avg_rating) : 0
    }));

    res.json({ success: true, data: brands });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch brands" });
  }
});


// GET /api/brands/:slug/stats
router.get("/:slug/stats", async (req, res) => {
  try {
    const db = getDB();

    const result = await db.query(
      `SELECT 
        b.id, b.name, b.slug, b.category, b.created_at,
        COUNT(r.id) AS review_count,
        ROUND(AVG(r.rating), 1) AS avg_rating,
        SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) AS five_star,
        SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) AS four_star,
        SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) AS three_star,
        SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) AS two_star,
        SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) AS one_star
      FROM brands b
      LEFT JOIN reviews r ON r.brand_id = b.id
      WHERE b.slug = $1
      GROUP BY b.id`,
      [req.params.slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Brand not found",
      });
    }

    const b = result.rows[0];

    const brand = {
      ...b,
      review_count: Number(b.review_count),
      avg_rating: b.avg_rating ? Number(b.avg_rating) : 0,
      five_star: Number(b.five_star) || 0,
      four_star: Number(b.four_star) || 0,
      three_star: Number(b.three_star) || 0,
      two_star: Number(b.two_star) || 0,
      one_star: Number(b.one_star) || 0,
    };

    res.json({ success: true, data: brand });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch brand" });
  }
});

module.exports = router;