require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

const dbPath = process.env.DB_PATH || "./cashbookdb";
const bookName = process.env.BOOK_NAME || "";

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log("Connected to the SQLite database.");
});

const sql = `
  SELECT
    e.id,
    e.bookname,
    e.enteramount,
    e.partyname,
    e.date,
    e.time,
    c.categoryName
  FROM entry e
  LEFT JOIN CashOutCategory c
    ON e.categoryId = c.id
  WHERE
    e.bookname = ?
    AND e.plusminus = 'false'
    AND c.categoryName != 'Orders'`;
db.all(sql, [bookName], (err, rows) => {
  if (err) {
    throw err;
  }
  fs.writeFileSync("output.json", JSON.stringify(rows, null, 2));
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log("Closed the database connection.");
});
