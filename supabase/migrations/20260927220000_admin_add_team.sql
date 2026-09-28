alter table public.teams drop constraint if exists teams_game_key_leader_id_key;

create or replace function public.admin_create_team(
  p_game_key text,
  p_group_key text,
  p_team_name text,
  p_leader_name text,
  p_leader_email text,
  p_leader_uid text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_leader_id uuid;
  v_registration_user_id uuid;
  v_email text := lower(trim(p_leader_email));
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_game_key not in ('freefire', 'bgmi', 'codm') then raise exception 'Unknown sport'; end if;
  if p_group_key not in ('A', 'B', 'C', 'D') then raise exception 'Choose a valid group'; end if;
  if trim(coalesce(p_team_name, '')) = '' or trim(coalesce(p_leader_name, '')) = '' or v_email = '' or trim(coalesce(p_leader_uid, '')) = '' then
    raise exception 'Team name, leader name, email, and UID are required';
  end if;

  if exists (select 1 from public.teams where game_key = p_game_key and lower(team_name) = lower(trim(p_team_name))) then
    raise exception 'This team name is already registered for this sport';
  end if;
  if exists (select 1 from public.registrations where game_key = p_game_key and lower(email) = v_email) then
    raise exception 'This leader email is already registered for this sport';
  end if;
  if exists (select 1 from public.registrations where game_key = p_game_key and lower(in_game_uid) = lower(trim(p_leader_uid))) then
    raise exception 'This leader UID is already registered for this sport';
  end if;

  select id into v_leader_id from public.profiles where lower(email) = v_email;
  v_registration_user_id := v_leader_id;
  if v_leader_id is null then v_leader_id := auth.uid(); end if;

  insert into public.teams (game_key, team_name, leader_id, group_key)
  values (p_game_key, trim(p_team_name), v_leader_id, p_group_key)
  returning id into v_team_id;

  insert into public.registrations (team_id, game_key, user_id, in_game_uid, role, email, display_name)
  values (v_team_id, p_game_key, v_registration_user_id, trim(p_leader_uid), 'leader', v_email, trim(p_leader_name));

  update public.profiles set display_name = trim(p_leader_name) where id = v_registration_user_id;
  return v_team_id;
exception
  when unique_violation then
    raise exception 'A team name, email, or UID already exists for this sport';
end;
$$;

grant execute on function public.admin_create_team(text, text, text, text, text, text) to authenticated;
