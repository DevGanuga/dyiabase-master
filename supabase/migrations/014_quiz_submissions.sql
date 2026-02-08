-- Lead funnel: profit leak calculator submissions
CREATE TABLE IF NOT EXISTS dyia_quiz_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  first_name text NOT NULL,
  email text NOT NULL,
  phone text,
  answers jsonb NOT NULL DEFAULT '{}',
  calculated_loss integer NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '{}',
  viewed_results boolean NOT NULL DEFAULT false,
  started_trial boolean NOT NULL DEFAULT false,
  utm_source text,
  utm_medium text,
  utm_campaign text
);

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_email ON dyia_quiz_submissions (email);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_created_at ON dyia_quiz_submissions (created_at);

COMMENT ON TABLE dyia_quiz_submissions IS 'Profit leak calculator lead funnel submissions';
