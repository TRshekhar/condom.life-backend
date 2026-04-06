require("dotenv").config();
const { Pool } = require("pg");

let pool;

const connectToDB = async () => {
  try {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false, // required for Supabase
      },
    });

    // Test connection
    const client = await pool.connect();
    console.log("Connected to Supabase (PostgreSQL)");
    client.release();

  } catch (error) {
    console.error("DB Connection Failed:", error.message);
    process.exit(1);
  }
};

const getDB = () => pool;

module.exports = { connectToDB, getDB };