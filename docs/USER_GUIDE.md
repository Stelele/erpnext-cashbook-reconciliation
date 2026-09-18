# cashbook-erprenconciliation — User Guide (Operator Walkthrough)

## Purpose

This script extracts expense transactions from a SQLite-based cashbook database and exports them as a JSON file suitable for reconciliation with ERPNext. The exported data can be posted as draft journal entries to ERPNext.

## Prerequisites (Operator Level)

- Node.js installed on the machine (v14+)
- Access to the SQLite cashbook database file (path configured via `DB_PATH`)
- The cashbook database must contain `entry` and `CashOutCategory` tables with the expected schema

## Setup

### 1. Verify the `.env` file

The script reads environment variables from `.env` (or `.env.local`). Ensure the file exists in the project root with at minimum:

```
DB_PATH=./cashbook.db
BOOK_NAME=Ecocash,Momo,AgentFloat
```

- `DB_PATH`: Full or relative path to the SQLite `.db` file (default: `./cashbook.db`).
- `BOOK_NAME`: Comma-separated list of cashbook column values to include in the export. Match these exactly against the `bookname` column in the `entry` table.

### 2. Place the SQLite database

If `DB_PATH` points to a relative path, ensure the `cashbook.db` (or whatever path is configured) file is present in the project directory.

### 3. Install dependencies (once)

```bash
npm install
```

This installs `dotenv`, `moment`, and `sqlite3` — required runtime dependencies.

## Running the Script

```bash
node main.js
```

or

```bash
npm run main
```

### What Happens During a Run

1. **Dotenv loads** — `.env.local` is loaded first, then `.env`. Environment variables `DB_PATH` and `BOOK_NAME` are set.
2. **Database connection** — The script opens the SQLite database in read-only mode using the path from `DB_PATH`.
3. **Config read** — It reads `expenses_export_config.json` (if it exists) to get the `lastExportedTimestamp`. Starts at `0` if the file is absent.
4. **SQL query** — A parameterized query fetches entries where:
   - `bookname` is in the `BOOK_NAME` list
   - `plusminus = 'false'` (expense entries, not income)
   - The joined `c.categoryName` is not `Orders`
   - `last_edit_time > lastExportedTimestamp` (only new/changed entries)
5. **Filtering** — Rows are filtered to keep only entries whose category name (after emoji stripping) matches one of the valid expense types:
   - Sekuru, Canteen, Spoiled Meat, Utilities, Consumables, Staff, Other, Transportation, Fuel, Maintainace, Maintainance
6. **Transformation** — Each kept entry is mapped to a simplified object:
   - `date`: `DD MMM YYYY` → `YYYY-MM-DD` (via `moment`)
   - `expenseType`: stripped category name
   - `amount`: parsed as float from `enteramount`
   - `description`: value from `partyname`
   - `bookname` and `id` are preserved
   - Results are sorted by date ascending.
7. **Config update** — If new expenses are found, the script writes `expenses_export_config.json` with the maximum `last_edit_time` from the current batch, enabling incremental exports on subsequent runs. Note: the watermark covers all queried rows including filter-excluded ones — if you change `validExpenseTypes`, delete `expenses_export_config.json` (or reset the timestamp) and re-run, otherwise previously excluded rows will never be picked up.
8. **Output files** — Two files are written to the project root:
   - `expenses_export.json` — The processed expense array.
   - `expenses_export_config.json` — The updated config (only written if new data was found).

### Output Files

| File | Description |
|---|---|
| `expenses_export.json` | JSON array of expense entries. Can be imported/processed by an external ERPNext integration. |
| `expenses_export_config.json` | `{ "lastExportedTimestamp": <number> }` — Used to avoid re-exporting the same rows. |

## Post-Export: Loading into ERPNext

The script does **not** directly post to ERPNext. After running the script, the operator should:

1. Open `expenses_export.json` and verify the data.
2. Use ERPNext's import tool, a custom script, or the API to post each entry as a draft **Journal Entry**.
3. Ensure the appropriate ERPNext accounts (Cash, Party, Category) are mapped correctly.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `Error: unable to open database file` | `DB_PATH` points to a nonexistent or inaccessible path. | Verify the path and ensure the `.db` file exists. |
| "No new expenses to export" | All entries up to `lastExportedTimestamp` have already been processed. | Reset `expenses_export_config.json` to `{ "lastExportedTimestamp": 0 }` if a fresh export is needed, or verify `BOOK_NAME`. |
| Export missing expected entries | `BOOK_NAME` values don't match `bookname` values in the database, or categories are not in the valid list. | Check the distinct `bookname` values in the `entry` table and update `BOOK_NAME`. |
| Dates appear as `Invalid Date` | SQLite date format is not `DD MMM YYYY`. | Verify the date format in the source database or adjust the `moment(e.date, "DD MMM YYYY")` parsing in `main.js`. |
| Entries with a category are missing from the export | The category (after emoji stripping) is not one of the valid expense types, or the `LEFT JOIN` with `CashOutCategory` did not match. | Unmatched categories are **omitted** from the export, not reported as an error. Ensure every entry has a valid `categoryId` that references an existing `CashOutCategory.id`, and that its `categoryName` is in the valid expense types list. |

## Summary

- **Input**: SQLite cashbook database (`DB_PATH`, `BOOK_NAME`)
- **Process**: Query → Filter → Transform → Sort → Export
- **Output**: `expenses_export.json` + `expenses_export_config.json`
- **Next step**: Import `expenses_export.json` into ERPNext as journal entries