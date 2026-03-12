require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

const dbPath = process.env.DB_PATH || "./cashbookdb";
const bookName = process.env.BOOK_NAME || "";

const validExpenseTypes = [
  "Sekuru",
  "Canteen",
  "Spoiled Meat",
  "Utilities",
  "Consumables",
  "Staff",
  "Other",
];

function parseDate(dateStr) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

  const expenses = rows
    .filter((e) => validExpenseTypes.includes(e.categoryName))
    .map((e) => ({
      date: parseDate(e.date),
      expenseType: e.categoryName,
      amount: parseFloat(e.enteramount),
      description: e.partyname,
    }));

  fs.writeFileSync(
    "expenses_export.json",
    JSON.stringify(expenses, null, 2),
    "utf8"
  );
  console.log(`Exported ${expenses.length} expenses to expenses_export.json`);
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log("Closed the database connection.");
});
