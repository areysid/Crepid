// backend/auth/server.js
import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();


const app = express();
const PORT = process.env.PORT || 4000;
const SECRET = process.env.JWT_SECRET;
const EXPIRY_DAYS = 10;

app.use(cors());
app.use(express.json());

// -----------------------------
// Database Setup
// -----------------------------
const db = new sqlite3.Database("./database.sqlite", (err) => {
  if (err) console.error("Database error:", err);
  else console.log("✅ Connected to SQLite database");
});

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT,
    expires_at TEXT
  )
`);

// -----------------------------
// Helper: Create new user with 10-day expiry
// -----------------------------
app.post("/add-user", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  const password_hash = await bcrypt.hash(password, 10);
  const expires_at = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.run(
    "INSERT INTO users (email, password_hash, expires_at) VALUES (?, ?, ?)",
    [email, password_hash, expires_at],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE"))
          return res.status(409).json({ error: "User already exists" });
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ id: this.lastID, email, expires_at });
    }
  );
});

// -----------------------------
// Login Route
// -----------------------------
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    // Check expiry
    if (new Date(user.expires_at) < new Date())
      return res.status(403).json({ error: "Account expired" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { email: user.email, id: user.id },
      SECRET,
      { expiresIn: "10d" }
    );

    res.json({ token });
  });
});

// -----------------------------
// Root Route
// -----------------------------
app.get("/", (req, res) => {
  res.send("Auth server running 🚀");
});

// -----------------------------
app.listen(PORT, () =>
  console.log(`✅ Auth server running on port ${PORT}`)
);
