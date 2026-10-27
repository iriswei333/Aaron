-- Terms of Use acceptance (Apple Guideline 1.2: users agree to terms with zero
-- tolerance for objectionable content before using chat).
--
-- Every sign-in screen (web, iOS, Android) says "By continuing, you agree to the
-- Terms of Use". The profile row is created on the first signed-in request right
-- after that screen, so the column defaults record the acceptance at that moment,
-- with no app code involved: deploying the app before or after this migration is safe.
--
-- Profiles created before this migration keep NULL (they never saw the line).
-- When the terms change, add a migration that sets a new default version, and
-- keep TERMS_VERSION in packages/shared/src/terms.js in step.

alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists terms_version text;

alter table public.profiles alter column terms_accepted_at set default now();
alter table public.profiles alter column terms_version set default '2026-10-27';
