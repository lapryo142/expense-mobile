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
