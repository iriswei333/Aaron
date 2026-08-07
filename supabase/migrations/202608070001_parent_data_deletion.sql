drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
for delete
to authenticated
using (id = (select auth.uid()));
