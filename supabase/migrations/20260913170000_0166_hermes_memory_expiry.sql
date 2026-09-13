ALTER TABLE public.hermes_memory_records ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE INDEX IF NOT EXISTS hermes_memory_records_expiry ON public.hermes_memory_records (organization_id, expires_at);
