# cashbook-erprenconciliation — Developer Guide

## Overview

This is a standalone Node.js script (not a Frappe app) that extracts expense transactions from a SQLite cashbook database and exports them as JSON for reconciliation with ERPNext. The script does not call ERPNext APIs directly; it produces `expenses_export.json` which an external process or custom script can import into ERPNext as draft journal entries.

## ERPNext Integration

- **Endpoints called**: The script itself does **not** call any ERPNext endpoints. It exports data to `expenses_export.json`. ERPNext posting is performed externally (e.g., via ERPNext's API, import tool, or a separate integration script).
- **Auth method**: No ERPNext authentication is embedded in this script. The `.env` file contains only `DB_PATH` and `BOOK_NAME`. Any ERPNext integration would require its own auth (e.g., API key/secret, session cookie) in the consuming code.
- **Data mapping**: See the "Data Mapping" section below for the SQLite → JSON field transformation.

## Data Mapping (SQLite → JSON)

The script reads from the `entry` table, LEFT JOINs `CashOutCategory`, and maps columns as follows:

| SQLite Column | JSON Output Field | Transformation |
|---|---|---|
| `e.id` | `id` | Pass-through (integer) |
| `e.bookname` | `bookname` | Pass-through (string) |
| `e.date` | `date` | `moment(e.date, "DD MMM YYYY").format("YYYY-MM-DD")` |
| `e.partyname` | `description` | Pass-through (raw string, no `stripEmojis()` — only `categoryName` is stripped) |
| `e.enteramount` | `amount` | `parseFloat(e.enteramount)` |
| `c.categoryName` | `expenseType` | `stripEmojis(e.categoryName)` — filtered against valid types |
| `e.last_edit_time` | (internal) | Used for `lastExportedTimestamp` config tracking |
| `e.time` | (unused) | Selected in the SQL query but not mapped to the JSON output |

### Valid Expense Types (whitelist)

The script only includes rows where `stripEmojis(e.categoryName)` matches one of:
- Sekuru, Canteen, Spoiled Meat, Utilities, Consumables, Staff, Other, Transportation, Fuel, Maintainace, Maintainance

Entries with other categories (e.g., `Orders`) are excluded.

### Filtering Logic

The SQL `WHERE` clause enforces:

```sql
WHERE e.bookname IN (${placeholders})
  AND e.plusminus = 'false'
  AND c.categoryName != 'Orders'
  AND e.last_edit_time > ?
```

Parameters: `[...bookNames, config.lastExportedTimestamp]`

## Development Setup

### 1. Clone and install

```bash
git clone git@github.com:Stelele/erpnext-cashbook-reconciliation.git
cd erpnext-cashbook-reconciliation
npm install
```

### 2. Environment configuration

Copy the `.env` template and set the required variables:

- `DB_PATH` — Path to the SQLite database file (default: `./cashbook.db`)
- `BOOK_NAME` — Comma-separated cashbook names (e.g. `Ecocash,Momo,AgentFloat`)

The script loads dotenv in this order: `.env.local` first, then `.env`.

### 3. Run the script

```bash
node main.js
# or
npm run main
```

### 4. Output files

Two files are written to the project root upon successful execution:

- `expenses_export.json` — Array of expense objects (see output format below).
- `expenses_export_config.json` — `{ "lastExportedTimestamp": <number> }` for incremental export control.

### 5. Debugging tips

- Run `node main.js` and inspect console output for SQL errors. The script does **not** log filter exclusions — the console only reports the exported count. To see which rows were excluded by the `validExpenseTypes` whitelist, query the database directly and compare `categoryName` against `validExpenseTypes` in `main.js`:
  ```sql
  SELECT e.id, e.bookname, e.last_edit_time, c.categoryName
  FROM entry e
  LEFT JOIN CashOutCategory c ON e.categoryId = c.id
  WHERE e.bookname IN ('Ecocash','Momo','AgentFloat')
    AND e.plusminus = 'false';
  ```
- If you change `validExpenseTypes`, previously excluded rows are still skipped because `lastExportedTimestamp` is the max `last_edit_time` of **all** rows the query returns — including rows later excluded by the filter. Delete `expenses_export_config.json` (or set `lastExportedTimestamp` to an earlier value) and re-run to re-include them.
- If `expenses_export_config.json` exists, the script will only export entries with `last_edit_time >` the stored timestamp.
- To start fresh, delete `expenses_export_config.json` (or set `lastExportedTimestamp` to `0`).
- Valid expense types are defined in the `validExpenseTypes` array in `main.js`; add/remove entries there to adjust filtering.

## Project Structure

```
/cashbook-recon
├── main.js          # Core script — SQLite query, filtering, transformation, export
├── package.json     # Node.js dependencies (dotenv, moment, sqlite3)
├── package-lock.json
├── .env             # Environment variables (DB_PATH, BOOK_NAME) — committed repo file
├── .env.local       # Optional local override (loaded first by dotenv) — gitignored, user-provided
├── LICENSE
├── README.md        # Project overview
├── docs/
│   ├── DEVELOPER.md # This guide
│   └── USER_GUIDE.md
├── expenses_export.json         # Generated output — do not edit manually
└── expenses_export_config.json  # Generated config — do not edit manually
```

`expenses_export.json` and `expenses_export_config.json` are the only files generated at runtime. All other files (`main.js`, `package.json`, `package-lock.json`, `.env`, `.env.local`, `README.md`, `docs/`, `LICENSE`, `.gitignore`) are repo files, not runtime outputs.

## Notes

- The script is intentionally **self-contained**: it reads SQLite, writes JSON. It does not connect to ERPNext, nor does it require network access.
- Adding a new valid expense type: edit the `validExpenseTypes` array in `main.js`.
- Changing the date format: modify the `moment(e.date, "DD MMM YYYY")` pattern and the SQL `SELECT` date column source.
- The `expenses_export_config.json` enables incremental exports: each run only exports new/updated entries since the last run.
- **`validExpenseTypes` changes vs. the watermark**: `lastExportedTimestamp` is written as the max `last_edit_time` across **all** rows the query returns — not just the rows that survive the whitelist filter. Excluded rows therefore still advance the watermark. After adding/removing valid expense types, reset `expenses_export_config.json` (delete it or set `lastExportedTimestamp` to an earlier value) and re-run to pick up previously excluded entries.