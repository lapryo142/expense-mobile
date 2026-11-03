Expense Mobile V8 CLEAN
This is a clean rebuild, not a patch over V7.
- Add transaction button wired with addEventListener.
- Summary/Edit button wired with addEventListener.
- Overlays have explicit close buttons.
- Persistent Supabase session.
- Luxury charcoal + champagne gold UI.
- Transactions first, summaries below.
- Income and expense quick presets.
- Requires the V5 send_wife migration already run.
- Bidirectional App <-> Supabase <-> Google Sheet sync lives in google-sheet-sync.gs.
- The sync stores transaction IDs in Google Sheet cell notes, so the visible
  PERSONAL EXPENSE 2026 layout does not need new columns.
- Run testExpenseSyncConnection(), then syncExpenseBidirectional() manually.
- After verifying both directions, run installExpenseSyncTrigger() once to sync
  every 5 minutes.
- No new SQL required.

Automatic balance tracking (2026-11-03)
- Apply supabase/migrations/20261103120533_automatic_balance_checkpoints.sql after the base schema/status-date migrations when setting up a new database.
- Keep balance-engine.js next to index.html. No build step is required.
- monthly_status bank/savings fields remain manual reconciliation snapshots for Sheet compatibility. balance_checkpoint stores their transaction basis; the app derives running balances and carryovers from actual transaction rows.
- Validate with node tests/balance-engine.cjs and CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node tests/tappy-flows.cjs. Browser tests use fixtures, never live financial writes.
