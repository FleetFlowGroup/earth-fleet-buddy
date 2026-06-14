
-- 1. platform_admins table
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform admins can read self" ON public.platform_admins;
CREATE POLICY "platform admins can read self"
  ON public.platform_admins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2. Seed existing platform admin from auth.users by email
INSERT INTO public.platform_admins (user_id)
SELECT id FROM auth.users WHERE lower(email) = 'fleetflow.group@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- 3. Replace is_platform_admin to use the table (no email-based check)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- 4. Remove overly permissive company_invites SELECT policy.
-- Admins still see their own company's invites via "company admins manage invites".
-- New joiners read via SECURITY DEFINER RPCs (preview_company_invite / accept_company_invite).
DROP POLICY IF EXISTS "authenticated can read invites by code" ON public.company_invites;
