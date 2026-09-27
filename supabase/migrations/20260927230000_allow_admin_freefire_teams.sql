create or replace function public.prevent_closed_freefire_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.game_key = 'freefire'
     and not public.is_admin()
     and now() >= timestamptz '2026-09-27 19:00:00+05:30' then
    raise exception 'All The Slots are filled';
  end if;
  return new;
end;
$$;

drop trigger if exists block_closed_freefire_registration on public.teams;
create trigger block_closed_freefire_registration
  before insert on public.teams
  for each row execute function public.prevent_closed_freefire_registration();
