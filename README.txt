Expense Mobile V3 — Supabase

Changes from V2:
- Shows monthly_status fields imported from Google Sheet:
  * Remaining
  * Bank balance
  * Food difference
  * Savings balance
  * Start-of-month balance
  * Total income
  * Total expense
- Transactions still read/write Supabase.
- No schema changes required if V2 schema was already run.
Replace only index.html in the GitHub repo and let Vercel redeploy.
