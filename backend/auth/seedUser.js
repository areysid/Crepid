// backend/auth/seedUsers.js
import sqlite3 from "sqlite3";
import bcrypt from "bcrypt";
import fs from "fs";
import crypto from "crypto";

const db = new sqlite3.Database("./database.sqlite", (err) => {
  if (err) {
    console.error("Database error:", err);
    process.exit(1);
  }
  console.log("✅ Connected to SQLite database");
});

const EXPIRY_DAYS = 10;
const expires_at = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

const users = Array.from({ length: 10 }, (_, i) => ({
  email: `crepid@user${i + 1}.com`,
  password: crypto.randomBytes(6).toString("base64url"), // random 8–10 char safe password
}));

(async () => {
  const credentials = [];

  try {
    for (const user of users) {
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
          if (err) console.error(`❌ Error adding ${user.email}:`, err.message);
          else console.log(`✅ Added/Updated ${user.email}`);
        }
      );

      credentials.push(`${user.email} : ${user.password}`);
    }

    setTimeout(() => {
      fs.writeFileSync("seeded_credentials.txt", credentials.join("\n"));
      console.log("\n📄 Credentials saved to seeded_credentials.txt");
      console.log(`🕒 All users expire on ${expires_at}`);
      db.close();
    }, 1000);
  } catch (err) {
    console.error("Seeding error:", err);
    db.close();
  }
})();
