import sqlite3 from "sqlite3";
const db = new sqlite3.Database("./database.sqlite");

db.serialize(() => {
  db.run(`ALTER TABLE users RENAME COLUMN password TO password_hash;`, (err) => {
    if (err) console.error(err);
    else console.log("✅ Renamed column to password_hash");
  });
});

db.close();

