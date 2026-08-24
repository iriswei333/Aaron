alter table public.chat_thread_members add column if not exists last_read_at timestamptz;

create or replace function public.mark_chat_thread_read(target_thread_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_thread_members
  set last_read_at = now()
  where thread_id = target_thread_id and user_id = auth.uid();
  return found;
end;
$$;
