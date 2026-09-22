ALTER TABLE public.social_accounts
ADD COLUMN provider text,
ADD COLUMN provider_account_id text;

ALTER TABLE public.publish_jobs
ADD COLUMN provider text,
ADD COLUMN provider_publication_id text;

UPDATE public.social_accounts
SET provider = 'brightbean',
    provider_account_id = brightbean_account_id;

UPDATE public.publish_jobs
SET provider = 'brightbean',
    provider_publication_id = brightbean_publication_id;
