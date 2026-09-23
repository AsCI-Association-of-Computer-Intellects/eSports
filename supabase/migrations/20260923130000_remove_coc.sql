-- Stop accepting new COC registrations. Existing COC rows are preserved.

do $$
begin
  alter table public.teams drop constraint if exists teams_game_key_check;
  alter table public.teams add constraint teams_game_key_check
    check (game_key in ('freefire', 'bgmi', 'codm')) not valid;

  alter table public.registrations drop constraint if exists registrations_game_key_check;
  alter table public.registrations add constraint registrations_game_key_check
    check (game_key in ('freefire', 'bgmi', 'codm')) not valid;
end;
$$;

create or replace function public.register_team(
  p_game_key text,
  p_team_name text,
  p_leader jsonb,
  p_members jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_leader_email text;
  v_team_id uuid;
  v_member jsonb;
  v_uid text;
  v_email text;
  v_member_user uuid;
  v_leader_uid text := lower(trim(coalesce(p_leader->>'in_game_uid', '')));
  v_seen_uid text[] := array[v_leader_uid];
  v_seen_email text[] := '{}';
begin
  if v_user_id is null then
    raise exception 'You must be signed in with Google to register a team';
  end if;

  select lower(email) into v_leader_email from auth.users where id = v_user_id;
  if v_leader_email is null or v_leader_email = '' then
    raise exception 'Your Google account has no email';
  end if;
  v_seen_email := array_append(v_seen_email, v_leader_email);

  if p_game_key not in ('freefire', 'bgmi', 'codm') then
    raise exception 'Unknown game';
  end if;

  if trim(coalesce(p_team_name, '')) = '' or v_leader_uid = '' then
    raise exception 'Team name and leader in-game UID are required';
  end if;

  if trim(coalesce(p_leader->>'branch', '')) = ''
     or trim(coalesce(p_leader->>'section', '')) = ''
     or trim(coalesce(p_leader->>'year_of_study', '')) = '' then
    raise exception 'Leader branch, section, and year of study are required';
  end if;

  if exists (
    select 1 from public.registrations
    where game_key = p_game_key
      and (user_id = v_user_id or lower(email) = v_leader_email)
  ) then
    raise exception 'This Gmail is already registered for this game. One team per game.';
  end if;

  insert into public.teams (game_key, team_name, leader_id)
  values (p_game_key, trim(p_team_name), v_user_id)
  returning id into v_team_id;

  insert into public.registrations (
    team_id, game_key, user_id, in_game_uid, role, email, branch, section, year_of_study
  ) values (
    v_team_id, p_game_key, v_user_id, trim(p_leader->>'in_game_uid'), 'leader',
    v_leader_email, trim(p_leader->>'branch'), trim(p_leader->>'section'),
    trim(p_leader->>'year_of_study')
  );

  for v_member in select * from jsonb_array_elements(coalesce(p_members, '[]'::jsonb))
  loop
    v_uid := lower(trim(coalesce(v_member->>'in_game_uid', '')));
    v_email := nullif(lower(trim(coalesce(v_member->>'email', ''))), '');

    if v_uid = '' and v_email is null then continue; end if;
    if v_uid = '' or v_email is null then
      raise exception 'Each teammate needs both a Gmail and an in-game UID';
    end if;
    if trim(coalesce(v_member->>'branch', '')) = ''
       or trim(coalesce(v_member->>'section', '')) = ''
       or trim(coalesce(v_member->>'year_of_study', '')) = '' then
      raise exception 'Each teammate needs branch, section, and year of study';
    end if;
    if v_uid = any (v_seen_uid) then raise exception 'Each in-game UID can only appear once on a roster'; end if;
    v_seen_uid := array_append(v_seen_uid, v_uid);
    if v_email = any (v_seen_email) then raise exception 'Each Gmail can only appear once on a roster'; end if;
    v_seen_email := array_append(v_seen_email, v_email);

    v_member_user := null;
    select id into v_member_user from public.profiles where lower(email) = v_email;
    if v_member_user = v_user_id then raise exception 'The team leader cannot also be listed as a member'; end if;
    if exists (
      select 1 from public.registrations
      where game_key = p_game_key
        and (lower(email) = v_email or (v_member_user is not null and user_id = v_member_user))
    ) then raise exception 'A listed Gmail is already registered for this game'; end if;

    insert into public.registrations (
      team_id, game_key, user_id, in_game_uid, role, email, branch, section, year_of_study
    ) values (
      v_team_id, p_game_key, v_member_user, trim(v_member->>'in_game_uid'), 'member',
      v_email, trim(v_member->>'branch'), trim(v_member->>'section'), trim(v_member->>'year_of_study')
    );
  end loop;

  return v_team_id;
exception
  when unique_violation then
    raise exception 'This team name, Gmail, or in-game UID is already registered for this game';
end;
$$;
