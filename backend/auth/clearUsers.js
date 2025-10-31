// backend/auth/clearUsers.js
import sqlite3 from "sqlite3";

const db = new sqlite3.Database("./database.sqlite", (err) => {
  if (err) return console.error("Database error:", err);
  db.run("DELETE FROM users", (err) => {
    if (err) console.error("❌ Error clearing users:", err);
    else console.log("✅ All users deleted successfully");
    db.close();
  });
});
