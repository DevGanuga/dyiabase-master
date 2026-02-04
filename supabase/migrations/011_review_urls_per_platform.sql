-- Per-platform review page links (Google, Yelp, Facebook) for review request templates
ALTER TABLE dyia_settings ADD COLUMN IF NOT EXISTS review_url_google TEXT;
ALTER TABLE dyia_settings ADD COLUMN IF NOT EXISTS review_url_yelp TEXT;
ALTER TABLE dyia_settings ADD COLUMN IF NOT EXISTS review_url_facebook TEXT;
