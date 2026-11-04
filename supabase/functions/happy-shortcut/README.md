# Happy Money Back Tap

Deploy with JWT gateway verification disabled; handler.mjs validates a 256-bit per-user capability before any access. Only its SHA-256 hash is stored. No service credentials belong in the client or Shortcut.

POST with Authorization: Bearer hm_<64 lowercase hex characters>. Actions: categories (returns active category labels only); expense (amount, category, note, request_id UUID). Expense writes are scoped to the token owner, bank payment, current Ho Chi Minh date, no income or history access. SQL RPC is service_role-only, rate limited to 120 new requests/hour, and idempotent by owner/request_id. Revoking/rotating the connection also blocks in-flight writes at the database check.

Signed-in users create/rotate or revoke their own connection in Settings. Cleartext token appears once and is removed when Settings closes. It expires after a year. API tests run with synthetic dependencies; SQL behavior and RLS tested in a rolled-back transaction. No production expense was created for verification.

Deploy from this folder as happy-shortcut with verify_jwt=false (custom bearer validation is mandatory). Apply supabase-shortcut.sql before serving. Setup steps for Apple Shortcuts are in the app; phone setup and a real iPhone run remain user actions. An importable, Apple-signed .shortcut is not included.
