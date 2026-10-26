-- One-time admin grant, requested directly: promotes alfred@algorhythmlab.com
-- to admin so SSO testing (and everything else admin-only) is easier to
-- drive from that account. Safe no-op if that account hasn't signed up yet
-- — in that case, sign up at /signup with this email first, then ask an
-- existing admin to promote it via Settings → Team Management, or re-run
-- this exact statement once the account exists.
UPDATE "loadforge_user" SET "role" = 'admin' WHERE "email" = 'alfred@algorhythmlab.com';
