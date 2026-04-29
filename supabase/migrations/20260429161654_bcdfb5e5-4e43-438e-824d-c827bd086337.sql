-- Remove any duplicate profile rows, keeping the earliest one per user
DELETE FROM public.profiles a
USING public.profiles b
WHERE a.user_id = b.user_id
  AND a.created_at > b.created_at;

-- Add UNIQUE constraint on user_id
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);