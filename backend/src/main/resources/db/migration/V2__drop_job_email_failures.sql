-- The jobs now hand their emails to a background sender after each claim (MailEventListener), so a run
-- can no longer count failed sends. A failed email is logged by MailService instead.
ALTER TABLE job_runs DROP COLUMN email_failures;
