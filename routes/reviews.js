const express = require("express");
const router = express.Router();
const { getDB } = require("../db");

const VALID_REGIONS = [
  "Asia","America","Africa","Australia","Europe",
  "Russia","India","Middle East","Latin America","Global",
];

const VALID_SORT = ["newest", "top_rated", "most_liked"];

// GET /api/reviews
router.get("/", async (req, res) => {
  try {
    const db = getDB();

    const {region = "All", sort = "newest", brand, page = 1, limit = 10, search} = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = [];
    let params = [];
    let index = 1;

    if (region && region !== "All") {
      whereClauses.push(`r.region = $${index++}`);
      params.push(region);
    }

    if (brand) {
      whereClauses.push(`LOWER(r.brand_name) LIKE LOWER($${index++})`);
      params.push(`%${brand}%`);
    }

    if (search) {
      whereClauses.push(
        `(LOWER(r.title) LIKE LOWER($${index}) 
        OR LOWER(r.content) LIKE LOWER($${index + 1}) 
        OR LOWER(r.brand_name) LIKE LOWER($${index + 2}))`
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      index += 3;
    }

    const whereSQL =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const sortMap = {
      newest: "r.created_at DESC",
      top_rated: "r.rating DESC, r.created_at DESC",
      most_liked: "r.likes DESC, r.created_at DESC",
    };
    const orderSQL = sortMap[sort] || sortMap.newest;

    // COUNT
    const countQuery = `
      SELECT COUNT(*) AS total 
      FROM reviews r 
      ${whereSQL}
    `;
    const countRes = await db.query(countQuery, params);
    const total = Number(countRes.rows[0].total);

    // DATA
    const reviewsQuery = `
      SELECT 
        r.id, r.username, r.brand_name, r.title, r.content,
        r.rating, r.region, r.likes, r.created_at
      FROM reviews r
      ${whereSQL}
      ORDER BY ${orderSQL}
      LIMIT $${index++} OFFSET $${index++}
    `;

    const reviewsRes = await db.query(reviewsQuery, [
      ...params,
      limitNum,
      offset,
    ]);

    res.json({
      success: true,
      data: reviewsRes.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch reviews" });
  }
});


// GET /api/reviews/:id
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();

    const result = await db.query(
      `SELECT id, username, brand_name, title, content, rating, region, likes, created_at
       FROM reviews WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Review not found",
      });
    }

    res.json({ success: true, data: result.rows[0] });

  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch review" });
  }
});


// POST /api/reviews
router.post("/", async (req, res) => {
  try {
    const db = getDB();
    const { username, brand_name, title, content, rating, region } = req.body;

    // Validation
    const errors = [];
    if (!username || username.trim().length < 2)
      errors.push("Username must be at least 2 characters");
    if (!brand_name) errors.push("Brand name is required");
    if (!title || title.trim().length < 5)
      errors.push("Title must be at least 5 characters");
    if (!content || content.trim().length < 20)
      errors.push("Review must be at least 20 characters");
    if (!rating || isNaN(rating) || rating < 1 || rating > 5)
      errors.push("Rating must be between 1 and 5");
    if (!region || !VALID_REGIONS.includes(region))
      errors.push("Invalid region");

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // Find or create brand
    let brandRes = await db.query(
      "SELECT id FROM brands WHERE LOWER(name) = LOWER($1)",
      [brand_name.trim()]
    );

    let brandId;

    if (brandRes.rows.length === 0) {
      const insertBrand = await db.query(
        `INSERT INTO brands (name, slug, category) 
         VALUES ($1, $2, 'standard') 
         RETURNING id`,
        [
          brand_name.trim(),
          brand_name.trim().toLowerCase().replace(/\s+/g, "-"),
        ]
      );
      brandId = insertBrand.rows[0].id;
    } else {
      brandId = brandRes.rows[0].id;
    }

    // Insert review
    const insertReview = await db.query(
      `INSERT INTO reviews 
      (username, brand_id, brand_name, title, content, rating, region)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [
        username.trim(),
        brandId,
        brand_name.trim(),
        title.trim(),
        content.trim(),
        parseInt(rating),
        region,
      ]
    );

    res.status(201).json({
      success: true,
      data: insertReview.rows[0],
      message: "Review posted!",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to post review" });
  }
});


// POST /api/reviews/:id/like
router.post("/:id/like", async (req, res) => {
  try {
    const db = getDB();
    const reviewId = parseInt(req.params.id);
    const ip =
      req.ip || req.headers["x-forwarded-for"] || "unknown";

    const existing = await db.query(
      `SELECT id FROM review_likes 
       WHERE review_id = $1 AND ip_address = $2`,
      [reviewId, ip]
    );

    if (existing.rows.length > 0) {
      // Unlike
      await db.query(
        `DELETE FROM review_likes 
         WHERE review_id = $1 AND ip_address = $2`,
        [reviewId, ip]
      );

      await db.query(
        `UPDATE reviews 
         SET likes = GREATEST(0, likes - 1) 
         WHERE id = $1`,
        [reviewId]
      );

      const result = await db.query(
        "SELECT likes FROM reviews WHERE id = $1",
        [reviewId]
      );

      return res.json({
        success: true,
        liked: false,
        likes: Number(result.rows[0].likes),
      });
    }

    // Like
    await db.query(
      `INSERT INTO review_likes (review_id, ip_address) 
       VALUES ($1, $2)`,
      [reviewId, ip]
    );

    await db.query(
      `UPDATE reviews SET likes = likes + 1 WHERE id = $1`,
      [reviewId]
    );

    const result = await db.query(
      "SELECT likes FROM reviews WHERE id = $1",
      [reviewId]
    );

    res.json({
      success: true,
      liked: true,
      likes: Number(result.rows[0].likes),
    });

  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to like review" });
  }
});

module.exports = router;