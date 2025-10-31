import sqlite3 from "sqlite3";
import bcrypt from "bcrypt";

const db = new sqlite3.Database("./database.sqlite");

const addUser = async () => {
  const email = "test@crepid.com";
  const password = await bcrypt.hash("test123", 10);
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);

  db.run(
    "INSERT INTO users (email, password, expires_at) VALUES (?, ?, ?)",
    [email, password, expiry.toISOString()],
    (err) => {
      if (err) console.error("❌ Error:", err.message);
      else console.log("✅ User added successfully");
      db.close();
    }
  );
};

addUser();
