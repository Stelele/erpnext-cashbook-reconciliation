# cashbook-erprenconciliation

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Value Prop

Enter transactions in a cashbook app and post as draft journal entries to ERPNext.

## Features (Observed)

- **SQLite-to-JSON export**: Reads expenses from a SQLite cashbook database and exports them as a JSON array
- **Config-driven incremental exports**: Tracks the last exported `last_edit_time` timestamp in `expenses_export_config.json` for batch-friendly incremental exports
- **Cashbook name filtering**: Supports multiple cashbook names (Ecocash, Momo, AgentFloat) via `BOOK_NAME` env var
- **Valid expense type filtering**: Filters entries to a whitelist of categories: Sekuru, Canteen, Spoiled Meat, Utilities, Consumables, Staff, Other, Transportation, Fuel, Maintainace, Maintainance
- **Emoji stripping**: Strips non-ASCII characters from category names via `stripEmojis()`
- **Date transformation**: Converts dates from `DD MMM YYYY` format to `YYYY-MM-DD`
- **Sorted output**: Expenses are sorted by date in ascending order

## Requirements

- **Node.js** v14+ (compatible with dependencies: `dotenv@^17.4.2`, `moment@^2.30.1`, `sqlite3@^6.0.1`)
- **SQLite database** containing cashbook entries with the expected schema (table `entry` joined with `CashOutCategory`)
- **ERPNext API access** — for posting exported journal entries (script currently exports JSON; ERPNext posting is external)

## Installation

```bash
git clone git@github.com:Stelele/erpnext-cashbook-reconciliation.git
cd erpnext-cashbook-reconciliation
npm install
```

### `.env` setup

Create a `.env` file (or modify existing) with the following variable names only:

| Variable | Purpose |
|---|---|
| `DB_PATH` | Path to the SQLite database file (default: `./cashbook.db`) |
| `BOOK_NAME` | Comma-separated list of cashbook names to export from (e.g. `Ecocash,Momo,AgentFloat`) |

> Note: `.env.local` is also supported by the script (dotenv loads it first, then `.env`).

## Configuration

| Env Var | Purpose | Default |
|---|---|---|
| `DB_PATH` | Path to SQLite database | `./cashbook.db` |
| `BOOK_NAME` | Cashbook names to filter on (comma-separated) | _(empty)_ |

> Note: The shipped `.env` sets `DB_PATH` to a value that differs from the code default (`./cashbook.db`) — verify `.env` points at the real SQLite file, since a `DB_PATH` set in `.env` overrides the code default.

The script also reads `expenses_export_config.json` to track `lastExportedTimestamp` for incremental export control. The stored timestamp is the maximum `last_edit_time` across **all** rows the query returns — including rows later excluded by the valid-category filter — so excluded rows still advance the watermark. If you change the valid expense types, delete `expenses_export_config.json` (or set `lastExportedTimestamp` to an earlier value) and re-run to re-include previously excluded entries.

## Usage

```bash
node main.js
# or
npm run main
```

On first run, the script will:
1. Read the last exported timestamp from `expenses_export_config.json` (or start at 0)
2. Query the SQLite database for entries created or updated since that timestamp (`last_edit_time > lastExportedTimestamp`)
3. Filter by valid expense types and cashbook names
4. Transform and sort the data
5. Write `expenses_export.json` and update the config file

## Output

- `expenses_export.json` — JSON array of expense entries with fields: `id`, `bookname`, `date`, `expenseType`, `amount`, `description`
- `expenses_export_config.json` — Tracks `lastExportedTimestamp` for incremental exports

### Output Format

```json
[
  {
    "id": 1,
    "bookname": "Ecocash",
    "date": "2026-01-04",
    "expenseType": "Sekuru",
    "amount": 10,
    "description": "Sekuru"
  }
]
```

## Troubleshooting/FAQ

| Issue | Resolution |
|---|---|
| "No new expenses to export" | The script has processed all entries up to the last tracked edit timestamp (`last_edit_time`), not an entry ID. Verify `BOOK_NAME` and `DB_PATH` are correct. |
| Script throws `err.message` on DB open | Ensure the SQLite database file exists at the path specified by `DB_PATH` and contains the expected `entry` and `CashOutCategory` tables. |
| Export includes unwanted categories | Check that `BOOK_NAME` matches your cashbook names and that categories are in the valid expense types list. |
| Date format unexpected | Ensure entries in the SQLite database have dates in `DD MMM YYYY` format (e.g., `04 Jan 2026`). |

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/foo`
3. Commit your changes: `git commit -m "Add foo feature"`
4. Push to the branch: `git push origin feature/foo`
5. Open a Pull Request

Follow the existing code style and ensure `npm install` and `node main.js` run without errors after changes.

## License

MIT

Copyright (c) 2026 Gift Mugweni

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.