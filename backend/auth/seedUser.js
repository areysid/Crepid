// import sqlite3 from "sqlite3";
// import bcrypt from "bcrypt";
// import crypto from "crypto";

// const db = new sqlite3.Database("./database.sqlite", (err) => {
//   if (err) {
//     console.error("❌ Database error:", err);
//     process.exit(1);
//   }
//   console.log("✅ Connected to SQLite database");
// });

// const EXPIRY_DAYS = 10;
// const expires_at = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

// function generateUsers() {
//   return Array.from({ length: 10 }, (_, i) => ({
//     email: `crepid@user${i + 1}.com`,
//     password: crypto.randomBytes(6).toString("base64url"),
//   }));
// }

// db.serialize(() => {
//   // 1️⃣ Ensure users table exists first
//   db.run(
//     `
//     CREATE TABLE IF NOT EXISTS users (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       email TEXT UNIQUE,
//       password_hash TEXT,
//       expires_at TEXT
//     )
//   `,
//     (err) => {
//       if (err) {
//         console.error("❌ Error creating table:", err.message);
//         return;
//       }

//       // 2️⃣ Fetch existing users
//       db.all("SELECT email, expires_at FROM users", async (err, rows) => {
//         if (err) {
//           console.error("❌ Error checking users:", err);
//           db.close();
//           return;
//         }

//         const now = new Date();
//         const allExpired = rows.length > 0 && rows.every((u) => new Date(u.expires_at) < now);

//         // ✅ Reseed conditions:
//         // - No users exist (first run)
//         // - All users have expired (rotation time)
//         if (rows.length === 0 || allExpired) {
//           console.log(rows.length === 0 ? "⚙️ Initial seeding..." : "♻️ Users expired — rotating credentials...");
//           const newUsers = generateUsers();
//           const credentials = [];

//           for (const user of newUsers) {
//             const password_hash = await bcrypt.hash(user.password, 10);

//             db.run(
//               `
//               INSERT INTO users (email, password_hash, expires_at)
//               VALUES (?, ?, ?)
//               ON CONFLICT(email) DO UPDATE SET
//                 password_hash = excluded.password_hash,
//                 expires_at = excluded.expires_at
//             `,
//               [user.email, password_hash, expires_at],
//               (err) => {
//                 if (err)
//                   console.error(`❌ Error adding ${user.email}:`, err.message);
//                 else console.log(`✅ Added/Updated ${user.email}`);
//               }
//             );

//             credentials.push(`${user.email} : ${user.password}`);
//           }

//           setTimeout(() => {
//             console.log("\n📋 User credentials:");
//             console.log(credentials.join("\n"));
//             console.log(`🕒 All users expire on ${expires_at}`);
//             db.close();
//           }, 1000);
//         } else {
//           console.log("✅ Users already exist and are still valid — skipping seeding.");
//           db.close();
//         }
//       });
//     }
//   );
// });

// backend/auth/seedUsers.js
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import bcrypt from "bcrypt";

const users = [
  { email: "crepid@user1.com", password: "FcOALqfc" },
  { email: "crepid@user2.com", password: "oCj8wHRD" },
  { email: "crepid@user3.com", password: "vVr-fsLo" },
  { email: "crepid@user4.com", password: "7zCfnpUY" },
  { email: "crepid@user5.com", password: "ruI-rMi5" },
  { email: "crepid@user6.com", password: "EuuWs9mQ" },
  { email: "crepid@user7.com", password: "2YcsI3js" },
  { email: "crepid@user8.com", password: "kx0EVDNF" },
  { email: "crepid@user9.com", password: "9tszCFV4" },
  { email: "crepid@user10.com", password: "HAQ3YWGQ" },
];

(async () => {
  const db = await open({
    filename: "./database.sqlite",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password_hash TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("⚙️ Seeding users if not present...");

  for (const { email, password } of users) {
    const hashed = await bcrypt.hash(password, 10);
    await db.run(
      "INSERT OR IGNORE INTO users (email, password_hash) VALUES (?, ?)",
      [email, hashed]
    );
  }

  console.log("\n✅ Users ensured in database!");
  console.log("📋 User credentials:");
  users.forEach(({ email, password }) => console.log(`${email} : ${password}`));

  await db.close();
})();
