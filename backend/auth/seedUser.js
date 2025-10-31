import sqlite3 from "sqlite3";
import bcrypt from "bcrypt";
import crypto from "crypto";

const db = new sqlite3.Database("./database.sqlite", (err) => {
  if (err) {
    console.error("❌ Database error:", err);
    process.exit(1);
  }
  console.log("✅ Connected to SQLite database");
});

const EXPIRY_DAYS = 10;
const expires_at = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

function generateUsers() {
  return Array.from({ length: 10 }, (_, i) => ({
    email: `crepid@user${i + 1}.com`,
    password: crypto.randomBytes(6).toString("base64url"),
  }));
}

db.serialize(() => {
  // 1️⃣ Ensure users table exists first
  db.run(
    `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password_hash TEXT,
      expires_at TEXT
    )
  `,
    (err) => {
      if (err) {
        console.error("❌ Error creating table:", err.message);
        return;
      }

      // 2️⃣ Fetch existing users
      db.all("SELECT email, expires_at FROM users", async (err, rows) => {
        if (err) {
          console.error("❌ Error checking users:", err);
          db.close();
          return;
        }

        const now = new Date();
        const allExpired = rows.length > 0 && rows.every((u) => new Date(u.expires_at) < now);

        // ✅ Reseed conditions:
        // - No users exist (first run)
        // - All users have expired (rotation time)
        if (rows.length === 0 || allExpired) {
          console.log(rows.length === 0 ? "⚙️ Initial seeding..." : "♻️ Users expired — rotating credentials...");
          const newUsers = generateUsers();
          const credentials = [];

          for (const user of newUsers) {
            const password_hash = await bcrypt.hash(user.password, 10);

            db.run(
              `
              INSERT INTO users (email, password_hash, expires_at)
              VALUES (?, ?, ?)
              ON CONFLICT(email) DO UPDATE SET
                password_hash = excluded.password_hash,
                expires_at = excluded.expires_at
            `,
              [user.email, password_hash, expires_at],
              (err) => {
                if (err)
                  console.error(`❌ Error adding ${user.email}:`, err.message);
                else console.log(`✅ Added/Updated ${user.email}`);
              }
            );

            credentials.push(`${user.email} : ${user.password}`);
          }

          setTimeout(() => {
            console.log("\n📋 User credentials:");
            console.log(credentials.join("\n"));
            console.log(`🕒 All users expire on ${expires_at}`);
            db.close();
          }, 1000);
        } else {
          console.log("✅ Users already exist and are still valid — skipping seeding.");
          db.close();
        }
      });
    }
  );
});
