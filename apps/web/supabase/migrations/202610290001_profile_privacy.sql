-- Profile privacy: other families see only your display name.
--
-- Before this migration two policies let a family read another family's whole profile row
-- (email, child_profile, location, social_links, consent columns…) through the Supabase API,
-- because RLS restricts rows, not columns:
--   profiles_select_chat_participants   (202607290003) — families in the same public playdate
--   profiles_select_chat_thread_members (202608210002) — members of the same chat thread
-- The app only ever used display_name from those rows (chat thread list).
--
-- Now a family can select only its own profile row, and chat_member_names() returns just
-- id + display_name for families the caller shares a chat or a joined public playdate with
-- (the same conditions the two policies used). Anything else is silently left out.
-- Same pattern as list_my_blocks() (202610270001_user_blocks.sql).

drop policy if exists profiles_select_chat_participants on public.profiles;
drop policy if exists profiles_select_chat_thread_members on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create or replace function public.chat_member_names(user_ids uuid[])
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, coalesce(nullif(p.display_name, ''), 'Parent')
  from public.profiles p
  where auth.uid() is not null
    and p.id = any(user_ids)
    and (
      p.id = auth.uid()
      -- shares a chat thread with the caller
      or exists (
        select 1
        from public.chat_thread_members member
        join public.chat_thread_members viewer on viewer.thread_id = member.thread_id
        where member.user_id = p.id
          and viewer.user_id = auth.uid()
      )
      -- both joined the same public playdate
      or exists (
        select 1
        from public.play_date_participants participant
        join public.play_dates play_date on play_date.id = participant.play_date_id
        join public.play_date_participants viewer on viewer.play_date_id = participant.play_date_id
        where participant.user_id = p.id
          and participant.status = 'joined'
          and play_date.visibility = 'public'
          and viewer.user_id = auth.uid()
          and viewer.status = 'joined'
      )
    )
$$;

revoke all on function public.chat_member_names(uuid[]) from public, anon;
grant execute on function public.chat_member_names(uuid[]) to authenticated;
