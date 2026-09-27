alter table public.teams add column if not exists group_key text;
alter table public.teams drop constraint if exists teams_group_key_check;
alter table public.teams add constraint teams_group_key_check check (group_key in ('A', 'B', 'C', 'D'));
alter table public.registrations add column if not exists display_name text;

alter table public.matches add column if not exists group_key text;
alter table public.matches drop constraint if exists matches_group_key_check;
alter table public.matches add constraint matches_group_key_check check (group_key in ('A', 'B', 'C', 'D'));

drop function if exists public.update_team_details(uuid, text, text, text);
create or replace function public.update_team_details(p_team_id uuid, p_team_name text, p_leader_email text, p_leader_name text, p_group_key text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_leader_user_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_group_key not in ('A', 'B', 'C', 'D') then raise exception 'Choose a valid group'; end if;
  select user_id into v_leader_user_id from public.registrations where team_id = p_team_id and role = 'leader';
  if not found then raise exception 'Team leader not found'; end if;
  update public.teams set team_name = trim(p_team_name), group_key = p_group_key where id = p_team_id;
  update public.registrations set email = lower(trim(p_leader_email)), display_name = trim(p_leader_name) where team_id = p_team_id and role = 'leader';
  update public.profiles set display_name = trim(p_leader_name) where id = v_leader_user_id;
end;
$$;

create table if not exists public.match_scores (
  match_id uuid not null references public.matches (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  kills integer not null default 0 check (kills >= 0),
  finish_position integer not null check (finish_position >= 1),
  points integer not null default 0 check (points >= 0),
  updated_at timestamptz not null default now(),
  primary key (match_id, team_id)
);

alter table public.match_scores enable row level security;

create or replace function public.placement_points(p_position integer)
returns integer
language sql
immutable
as $$
  select case p_position when 1 then 15 when 2 then 12 when 3 then 10 else 0 end;
$$;

create or replace function public.get_leaderboard(p_game_key text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with totals as (
    select
      t.id as team_id,
      t.team_name,
      t.game_key,
      t.group_key,
      coalesce(sum(ms.points), 0)::integer as score,
      coalesce(sum(ms.kills), 0)::integer as kills
    from public.teams t
    left join public.match_scores ms on ms.team_id = t.id
    where p_game_key is null or t.game_key = p_game_key
    group by t.id, t.team_name, t.game_key, t.group_key
  ), ranked as (
    select totals.*, row_number() over (partition by game_key, group_key order by score desc, kills desc, team_name) as group_rank
    from totals
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'team_id', r.team_id,
      'team_name', r.team_name,
      'game_key', r.game_key,
      'group_key', r.group_key,
      'team_lead_name', coalesce(leader_profile.display_name, lead.display_name, lead.email, 'Team leader'),
      'score', r.score,
      'kills', r.kills,
      'group_rank', r.group_rank,
      'qualified', r.group_rank <= 3
    ) order by r.game_key, r.group_key nulls last, r.group_rank
  ), '[]'::jsonb)
  from ranked r
  left join public.registrations lead on lead.team_id = r.team_id and lead.role = 'leader'
  left join public.profiles leader_profile on leader_profile.id = lead.user_id;
$$;

create or replace function public.get_match_schedule()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'game_key', m.game_key,
    'title', m.title,
    'scheduled_at', m.scheduled_at,
    'status', m.status,
    'group_key', m.group_key
  ) order by m.scheduled_at), '[]'::jsonb)
  from public.matches m;
$$;

drop function if exists public.save_match(uuid, text, uuid, uuid, timestamptz, text, uuid);
drop function if exists public.save_match(uuid, text, text, timestamptz, text);

create or replace function public.save_match(
  p_match_id uuid,
  p_game_key text,
  p_group_key text,
  p_scheduled_at timestamptz,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_title text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_game_key not in ('freefire', 'bgmi', 'codm') then raise exception 'Unknown game'; end if;
  if p_group_key not in ('A', 'B', 'C', 'D') then raise exception 'Unknown group'; end if;
  if p_status not in ('scheduled', 'live', 'completed', 'cancelled') then raise exception 'Unknown match status'; end if;
  select concat(initcap(p_game_key), ' Group ', p_group_key, ' Match') into v_title;

  if p_match_id is null then
    insert into public.matches (game_key, group_key, title, scheduled_at, status, team_a_id, team_b_id, winner_team_id)
    values (p_game_key, p_group_key, v_title, p_scheduled_at, p_status, null, null, null)
    returning id into v_match_id;
  else
    update public.matches
    set game_key = p_game_key, group_key = p_group_key, title = v_title,
        scheduled_at = p_scheduled_at, status = p_status, updated_at = now()
    where id = p_match_id
    returning id into v_match_id;
    if v_match_id is null then raise exception 'Match not found'; end if;
  end if;
  return v_match_id;
end;
$$;

create or replace function public.save_match_score(
  p_match_id uuid,
  p_team_id uuid,
  p_kills integer,
  p_finish_position integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group text;
  v_game text;
  v_points integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_kills < 0 or p_finish_position < 1 then raise exception 'Kills and position are invalid'; end if;
  select m.group_key, m.game_key into v_group, v_game from public.matches m where m.id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if not exists (select 1 from public.teams where id = p_team_id and game_key = v_game and group_key = v_group) then
    raise exception 'Team does not belong to this match group';
  end if;
  v_points := p_kills + public.placement_points(p_finish_position);
  insert into public.match_scores (match_id, team_id, kills, finish_position, points, updated_at)
  values (p_match_id, p_team_id, p_kills, p_finish_position, v_points, now())
  on conflict (match_id, team_id) do update set kills = excluded.kills, finish_position = excluded.finish_position, points = excluded.points, updated_at = now();
end;
$$;

create or replace function public.get_admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return jsonb_build_object(
    'teams', coalesce((select jsonb_agg(jsonb_build_object(
      'team_id', t.id, 'team_name', t.team_name, 'game_key', t.game_key,
      'group_key', t.group_key, 'eliminated_by_match_id', t.eliminated_by_match_id,
      'score', coalesce((select sum(ms.points) from public.match_scores ms where ms.team_id = t.id), 0),
      'roster', coalesce((select jsonb_agg(jsonb_build_object(
        'registration_id', r.id, 'role', r.role, 'display_name', coalesce(rp.display_name, r.display_name, r.email), 'email', r.email, 'in_game_uid', r.in_game_uid,
        'branch', r.branch, 'section', r.section, 'year_of_study', r.year_of_study
      ) order by case when r.role = 'leader' then 0 else 1 end, r.created_at) from public.registrations r left join public.profiles rp on rp.id = r.user_id where r.team_id = t.id), '[]'::jsonb)
    ) order by t.game_key, t.group_key, t.team_name) from public.teams t), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.id, 'game_key', m.game_key, 'group_key', m.group_key, 'title', m.title,
      'scheduled_at', m.scheduled_at, 'status', m.status,
      'scores', coalesce((select jsonb_agg(jsonb_build_object(
        'team_id', t.id, 'team_name', t.team_name, 'kills', coalesce(ms.kills, 0),
        'finish_position', coalesce(ms.finish_position, 1), 'points', coalesce(ms.points, 0)
      ) order by coalesce(ms.finish_position, 999), t.team_name)
      from public.teams t left join public.match_scores ms on ms.team_id = t.id and ms.match_id = m.id
      where t.game_key = m.game_key and t.group_key = m.group_key and t.eliminated_by_match_id is null), '[]'::jsonb)
    ) order by m.scheduled_at) from public.matches m), '[]'::jsonb)
  );
end;
$$;

drop function if exists public.update_registration_details(uuid, text, text);

create or replace function public.update_registration_details(
  p_registration_id uuid,
  p_display_name text,
  p_email text,
  p_in_game_uid text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if trim(coalesce(p_display_name, '')) = '' or trim(coalesce(p_email, '')) = '' or trim(coalesce(p_in_game_uid, '')) = '' then
    raise exception 'Member name, email, and UID are required';
  end if;
  update public.registrations
  set display_name = trim(p_display_name), email = lower(trim(p_email)), in_game_uid = trim(p_in_game_uid)
  where id = p_registration_id;
  if not found then raise exception 'Registration not found'; end if;
end;
$$;

grant execute on function public.placement_points(integer) to anon, authenticated;
grant execute on function public.get_leaderboard(text) to anon, authenticated;
grant execute on function public.get_match_schedule() to anon, authenticated;
grant execute on function public.save_match(uuid, text, text, timestamptz, text) to authenticated;
grant execute on function public.save_match_score(uuid, uuid, integer, integer) to authenticated;
grant execute on function public.get_admin_dashboard() to authenticated;
grant execute on function public.update_team_details(uuid, text, text, text, text) to authenticated;
grant execute on function public.update_registration_details(uuid, text, text, text) to authenticated;
