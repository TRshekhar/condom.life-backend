const express = require("express");
const cors = require("cors");
const { connectToDB } = require("./db");
const rateLimit = require("express-rate-limit");

const reviewsRouter = require("./routes/reviews");
const brandsRouter = require("./routes/brands");
const statsRouter = require("./routes/stats");

const startServer = async () => {
  await connectToDB();
};

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.ALLOWED_ORIGIN, // your custom domain
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (Postman, mobile apps)
      if (!origin) return callback(null, true);

      // allow your custom domain
      if (origin === "https://condom.life") {
        return callback(null, true);
      }

      // allow www version
      if (origin === "https://www.condom.life") {
        return callback(null, true);
      }

      // allow localhost (development)
      if (origin.includes("localhost")) {
        return callback(null, true);
      }

      // allow your main domain
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // allow all vercel preview domains
      if (origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10kb" }));
app.set("trust proxy", 1);

// Global rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please slow down." },
});
app.use(limiter);

// Strict limiter for write endpoints
const writeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { success: false, error: "Too many submissions, please wait." },
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "condom.life API is live 🌐", version: "1.0.0" });
});

app.use("/api/reviews", reviewsRouter);
app.use("/api/brands", brandsRouter);
app.use("/api/stats", statsRouter);

// POST rate limiting applied specifically to write routes
app.use("/api/reviews", (req, res, next) => {
  if (req.method === "POST" && !req.path.includes("/like")) {
    return writeLimiter(req, res, next);
  }
  next();
});

// ── 404 & Error Handlers ─────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🟢 condom.life API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});

startServer();