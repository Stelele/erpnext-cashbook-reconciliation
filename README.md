# cashbook-erprenconciliation

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Script to extract expenses from a SQLite cashbook database and export them as JSON for reconciliation with the Njeremoto ERP.

## Prerequisites

- Node.js (v18+ recommended)
- SQLite database containing cashbook data

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

Create a `.env.local` file (or modify `.env`) with the following variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PATH` | Path to SQLite database | `./cashbookdb` |
| `BOOK_NAME` | Name of the cashbook to export from | (empty) |

## Usage

```bash
npm run main
# or
node main.js
```

## Output

Running the script creates:
- `expenses_export.json` - JSON array of expense entries
- `expenses_export_config.json` - Tracks last exported entry ID for incremental exports

### Output Format

```json
[
  {
    "date": "2026-01-04",
    "expenseType": "Sekuru",
    "amount": 10,
    "description": "Sekuru"
  }
]
```

## How It Works

1. Reads the last exported entry ID from config (or starts from 0 on first run)
2. Queries SQLite for entries where `id > lastExportedId` and category is valid
3. Filters to valid expense types: Sekuru, Canteen, Spoiled Meat, Utilities, Consumables, Staff, Other
4. Transforms dates from "DD MMM YYYY" to "YYYY-MM-DD" format
5. Exports to JSON and updates config with max ID from this batch

## License

MIT
