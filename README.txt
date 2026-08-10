EXPENSE MOBILE V2 — SUPABASE

1) Supabase Dashboard -> SQL Editor -> New query.
   Paste/run supabase-schema.sql.

2) Replace the current GitHub/Vercel index.html with this package's index.html.
   The Supabase Project URL and publishable key are already configured.

3) Open app -> Create account or Log in.
   If your Supabase Auth requires email confirmation, confirm it once.

4) After login, press "Import Google Sheet mới nhất" once.
   The seed in this build was generated from the latest PERSONAL EXPENSE 2026 file.

5) After the app is working, set up google-sheet-sync.gs as the second step
   for ongoing Sheet -> Supabase synchronization.
   NEVER put a service_role/secret key into GitHub or index.html.
