import sqlite3 from "sqlite3";

const db = new sqlite3.Database("./database.sqlite");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);

  console.log("✅ Users table created (if it didn't already exist).");
});

db.close();
