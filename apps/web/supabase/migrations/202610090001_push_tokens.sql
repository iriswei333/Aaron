-- Expo push tokens for the native app (apps/mobile). One row per device token.
-- The backend sends to every token a family has registered when an AI creation
-- finishes, through Expo's push service (which forwards to APNs and FCM).

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  device_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_profile_idx on public.push_tokens (profile_id);

drop trigger if exists push_tokens_set_updated_at on public.push_tokens;
create trigger push_tokens_set_updated_at before update on public.push_tokens
for each row execute function public.set_updated_at();

alter table public.push_tokens enable row level security;

create policy "family reads own push tokens" on public.push_tokens for select to authenticated
using (profile_id = (select auth.uid()));
create policy "family deletes own push tokens" on public.push_tokens for delete to authenticated
using (profile_id = (select auth.uid()));

-- A phone keeps the same token when a different parent signs in on it, so the
-- token has to move to the new profile. Row-level security would block updating
-- another profile's row, hence this narrow security-definer function.
create or replace function public.register_push_token(
  requested_token text,
  requested_platform text,
  requested_device_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  if requested_token is null or requested_token !~ '^Expo(nent)?PushToken\[.+\]$' then raise exception 'Invalid Expo push token'; end if;
  if requested_platform not in ('ios', 'android') then raise exception 'Unsupported platform'; end if;

  insert into public.push_tokens (profile_id, token, platform, device_name)
  values (caller_id, requested_token, requested_platform, left(requested_device_name, 120))
  on conflict (token) do update
    set profile_id = excluded.profile_id,
        platform = excluded.platform,
        device_name = excluded.device_name,
        updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text, text) from public;
grant execute on function public.register_push_token(text, text, text) to authenticated;
