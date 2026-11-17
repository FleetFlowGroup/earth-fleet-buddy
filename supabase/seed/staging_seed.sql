-- STAGING ONLY. FAKE DATA. Do not run against production.
-- NOT a migration. Nothing in this repository applies this file.
-- Company: Red Gum Civil. People: fake admin and operator at example.test.
-- Apply only after staging migrations, including proposed 0009 and 0010.

BEGIN;

INSERT INTO public.companies (id, name, abn)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Red Gum Civil', 'STAGING-RED-GUM')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, company_id, name, type, registration, make, model)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Staging excavator', 'excavator', 'STG-001', 'FakeMake', 'EX1'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Staging truck', 'truck', 'STG-002', 'FakeMake', 'TR1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.operators (id, company_id, full_name, email, employee_id, position)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'Pat Operator',
  'redgum.operator@example.test',
  'RG-OP-1',
  'Operator'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.prestart_checks (id, company_id, asset_id, operator_id, checklist, notes, status)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  '[{"label":"Lights","result":"pass"}]'::jsonb,
  'Fake staging prestart. Not a real inspection.',
  'pass'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.defect_reports (id, company_id, asset_id, operator_id, description, severity, status)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  'Fake staging defect: cracked step. Not a real machine.',
  'low',
  'open'
)
ON CONFLICT (id) DO NOTHING;

-- Link logins only if those fake auth users already exist in THIS staging project.
INSERT INTO public.profiles (id, email, full_name, company_id)
SELECT id, email, 'Riley Admin', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
FROM auth.users
WHERE lower(email) = 'redgum.admin@example.test'
ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, full_name = EXCLUDED.full_name;

INSERT INTO public.profiles (id, email, full_name, company_id)
SELECT id, email, 'Pat Operator', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
FROM auth.users
WHERE lower(email) = 'redgum.operator@example.test'
ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, full_name = EXCLUDED.full_name;

INSERT INTO public.user_roles (user_id, company_id, role)
SELECT id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'redgum.admin@example.test'
ON CONFLICT (user_id, company_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, company_id, role)
SELECT id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'operator'::public.app_role
FROM auth.users
WHERE lower(email) = 'redgum.operator@example.test'
ON CONFLICT (user_id, company_id, role) DO NOTHING;

UPDATE public.operators
SET user_id = (SELECT id FROM auth.users WHERE lower(email) = 'redgum.operator@example.test')
WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'
  AND EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = 'redgum.operator@example.test');

COMMIT;
