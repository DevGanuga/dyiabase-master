-- Track when the free Intel report email has actually been delivered so
-- /api/intel/scan/status can retry if a prior attempt was cut short
-- (e.g. Vercel serverless terminating a fire-and-forget send).
ALTER TABLE dyia_intel_scans
ADD COLUMN IF NOT EXISTS report_email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_intel_scans_report_email_pending
  ON dyia_intel_scans(id)
  WHERE scan_data IS NOT NULL AND report_email_sent_at IS NULL;
