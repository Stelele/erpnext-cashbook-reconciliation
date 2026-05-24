require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const moment = require("moment");

const dbPath = process.env.DB_PATH || "./cashbook.db";
const bookName = process.env.BOOK_NAME || "";
const configPath = "expenses_export_config.json";

const validExpenseTypes = [
  "Sekuru",
  "Canteen",
  "Spoiled Meat",
  "Utilities",
  "Consumables",
  "Staff",
  "Other",
];

function stripEmojis(str) {
  return str.replace(/[^\x00-\x7F]/g, "").trim();
}

function readConfig() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
  return { lastExportedId: 0 };
}

function writeConfig(lastExportedId) {
  fs.writeFileSync(configPath, JSON.stringify({ lastExportedId }, null, 2));
}

const config = readConfig();

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
    AND c.categoryName != 'Orders'
    AND e.id > ?`;
db.all(sql, [bookName, config.lastExportedId], (err, rows) => {
  if (err) {
    throw err;
  }

  const expenses = rows
    .map((e) => ({
      ...e,
      categoryName: stripEmojis(e.categoryName),
    }))
    .filter((e) => validExpenseTypes.includes(e.categoryName))
    .map((e) => ({
      id: e.id,
      date: moment(e.date, "DD MMM YYYY").format("YYYY-MM-DD"),
      expenseType: e.categoryName,
      amount: parseFloat(e.enteramount),
      description: e.partyname,
    }))
    .sort((a, b) =>
      moment(a.date, "YYYY-MM-DD").diff(moment(b.date, "YYYY-MM-DD"), "days"),
    );

  if (expenses.length > 0) {
    const maxId = Math.max(...rows.map((e) => e.id));
    writeConfig(maxId);
    fs.writeFileSync(
      "expenses_export.json",
      JSON.stringify(expenses, null, 2),
      "utf8",
    );
    console.log(`Exported ${expenses.length} expenses to expenses_export.json`);
  } else {
    console.log("No new expenses to export");
  }
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log("Closed the database connection.");
});
