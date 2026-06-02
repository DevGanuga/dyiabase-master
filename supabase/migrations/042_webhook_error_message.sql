-- Align dyia_webhook_events with the application's logger.
--
-- Migration 017 created the table with an `error` column, but logWebhookEvent()
-- (src/lib/admin.ts) and the admin stats route both write/read `error_message`.
-- As a result every webhook-event insert that included an error silently failed
-- (column does not exist), so the admin Webhooks log under-reported. Add the
-- column the code actually uses. The legacy `error` column is left in place for
-- any historical rows.
ALTER TABLE dyia_webhook_events
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Backfill the new column from the legacy one where present.
UPDATE dyia_webhook_events
SET error_message = error
WHERE error_message IS NULL AND error IS NOT NULL;
