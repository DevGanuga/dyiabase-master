-- Add optional receipt URL to jobs for receipt-upload reminders and record-keeping
ALTER TABLE dyia_jobs ADD COLUMN IF NOT EXISTS receipt_url TEXT;

COMMENT ON COLUMN dyia_jobs.receipt_url IS 'URL of uploaded receipt image or document for this job (e.g. from storage or external link).';
