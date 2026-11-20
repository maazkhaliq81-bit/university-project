
ALTER TABLE public.job_matches
  ADD COLUMN IF NOT EXISTS employment_type TEXT,
  ADD COLUMN IF NOT EXISTS experience TEXT,
  ADD COLUMN IF NOT EXISTS salary_range TEXT,
  ADD COLUMN IF NOT EXISTS apply_links JSONB NOT NULL DEFAULT '[]'::jsonb;
