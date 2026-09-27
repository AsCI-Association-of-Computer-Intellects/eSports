create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  game_key text not null check (game_key in ('freefire', 'bgmi', 'codm')),
  title text not null,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  winner_team_id uuid references public.teams (id) on delete set null,
  team_a_id uuid references public.teams (id) on delete set null,
  team_b_id uuid references public.teams (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.matches add column if not exists winner_team_id uuid references public.teams (id) on delete set null;
alter table public.matches add column if not exists team_a_id uuid references public.teams (id) on delete set null;
alter table public.matches add column if not exists team_b_id uuid references public.teams (id) on delete set null;
alter table public.matches drop column if exists group_a;
alter table public.matches drop column if exists group_b;
alter table public.teams add column if not exists eliminated_by_match_id uuid references public.matches (id) on delete set null;
alter table public.registrations add column if not exists display_name text;

create table if not exists public.team_scores (
  team_id uuid primary key references public.teams (id) on delete cascade,
  score numeric not null default 0 check (score >= 0),
  updated_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.matches enable row level security;
alter table public.team_scores enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users a
    join auth.users u on lower(u.email) = lower(a.email)
    where u.id = auth.uid()
  );
$$;

drop function if exists public.get_leaderboard(text);
drop function if exists public.get_leaderboard(text, text);

create or replace function public.get_leaderboard(p_game_key text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'team_id', t.id,
        'team_name', t.team_name,
        'game_key', t.game_key,
        'team_lead_name', coalesce(lead.display_name, leader_profile.display_name, lead.email, 'Team leader'),
        'score', coalesce(s.score, 0)
      )
      order by t.game_key, coalesce(s.score, 0) desc, t.team_name
    ),
    '[]'::jsonb
  )
  from public.teams t
  left join public.team_scores s on s.team_id = t.id
  left join public.registrations lead on lead.team_id = t.id and lead.role = 'leader'
  left join public.profiles leader_profile on leader_profile.id = lead.user_id
  where p_game_key is null or t.game_key = p_game_key;
$$;

create or replace function public.get_match_schedule()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'game_key', m.game_key,
        'title', coalesce(m.title, concat(a.team_name, ' vs ', b.team_name)),
        'scheduled_at', m.scheduled_at,
        'status', m.status,
        'winner_team_id', m.winner_team_id,
        'team_a_id', m.team_a_id,
        'team_b_id', m.team_b_id,
        'team_a_name', a.team_name,
        'team_b_name', b.team_name,
        'eliminated_team_id', case when m.winner_team_id = m.team_a_id then m.team_b_id when m.winner_team_id = m.team_b_id then m.team_a_id end
      )
      order by m.scheduled_at
    ),
    '[]'::jsonb
  )
  from public.matches m
  left join public.teams a on a.id = m.team_a_id
  left join public.teams b on b.id = m.team_b_id;
$$;

create or replace function public.get_admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return jsonb_build_object(
    'teams', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'team_id', t.id,
          'team_name', t.team_name,
          'game_key', t.game_key,
          'eliminated_by_match_id', t.eliminated_by_match_id,
          'score', coalesce(s.score, 0),
          'roster', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'role', r.role,
                'display_name', r.display_name,
                'email', r.email,
                'in_game_uid', r.in_game_uid,
                'branch', r.branch,
                'section', r.section,
                'year_of_study', r.year_of_study
              )
              order by case when r.role = 'leader' then 0 else 1 end, r.created_at
            )
            from public.registrations r
            where r.team_id = t.id
          ), '[]'::jsonb)
        )
        order by t.game_key, t.team_name
      )
      from public.teams t
      left join public.team_scores s on s.team_id = t.id
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'game_key', m.game_key,
          'title', coalesce(m.title, concat(a.team_name, ' vs ', b.team_name)),
          'scheduled_at', m.scheduled_at,
          'status', m.status,
          'winner_team_id', m.winner_team_id,
          'team_a_id', m.team_a_id,
          'team_b_id', m.team_b_id,
          'team_a_name', a.team_name,
          'team_b_name', b.team_name,
          'eliminated_team_id', case when m.winner_team_id = m.team_a_id then m.team_b_id when m.winner_team_id = m.team_b_id then m.team_a_id end
        )
        order by m.scheduled_at
      )
      from public.matches m
      left join public.teams a on a.id = m.team_a_id
      left join public.teams b on b.id = m.team_b_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.update_team_score(p_team_id uuid, p_score numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_score < 0 then
    raise exception 'Score cannot be negative';
  end if;

  insert into public.team_scores (team_id, score, updated_at)
  values (p_team_id, p_score, now())
  on conflict (team_id) do update
    set score = excluded.score, updated_at = now();
end;
$$;

create or replace function public.update_team_details(
  p_team_id uuid,
  p_team_name text,
  p_leader_email text,
  p_leader_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leader_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if trim(coalesce(p_team_name, '')) = '' or trim(coalesce(p_leader_email, '')) = '' or trim(coalesce(p_leader_name, '')) = '' then
    raise exception 'Team name, leader email, and leader name are required';
  end if;

  select user_id into v_leader_user_id
  from public.registrations
  where team_id = p_team_id and role = 'leader';
  if not found then
    raise exception 'Team leader not found';
  end if;

  update public.teams
  set team_name = trim(p_team_name)
  where id = p_team_id;
  if not found then
    raise exception 'Team not found';
  end if;

  update public.registrations
  set email = lower(trim(p_leader_email)), display_name = trim(p_leader_name)
  where team_id = p_team_id and role = 'leader';

  update public.profiles
  set display_name = trim(p_leader_name)
  where id = v_leader_user_id;
end;
$$;

drop function if exists public.save_match(uuid, text, text, timestamptz, text, uuid);

create or replace function public.save_match(
  p_match_id uuid,
  p_game_key text,
  p_team_a_id uuid,
  p_team_b_id uuid,
  p_scheduled_at timestamptz,
  p_status text,
  p_winner_team_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
  declare
    v_match_id uuid;
    v_previous_winner_id uuid;
    v_previous_status text;
  begin
    if not public.is_admin() then
      raise exception 'Admin access required';
    end if;
    if p_game_key not in ('freefire', 'bgmi', 'codm') then
      raise exception 'Unknown game';
    end if;
    if p_team_a_id is null or p_team_b_id is null or p_team_a_id = p_team_b_id then
      raise exception 'Select two different teams';
    end if;
    if p_status not in ('scheduled', 'live', 'completed', 'cancelled') then
      raise exception 'Unknown match status';
    end if;
    if p_status = 'completed' and p_winner_team_id is null then
      raise exception 'Choose the winning team before marking a match complete';
    end if;
    if not exists (
      select 1 from public.teams where id = p_team_a_id and game_key = p_game_key
    ) or not exists (
      select 1 from public.teams where id = p_team_b_id and game_key = p_game_key
    ) then
      raise exception 'Both teams must belong to the selected sport';
    end if;
    if exists (select 1 from public.teams where id in (p_team_a_id, p_team_b_id) and eliminated_by_match_id is not null and eliminated_by_match_id is distinct from p_match_id) then
      raise exception 'Eliminated teams cannot be scheduled again';
    end if;
    if p_winner_team_id is not null and p_winner_team_id not in (p_team_a_id, p_team_b_id) then
      raise exception 'Winner must be Team A or Team B';
    end if;
    if p_winner_team_id is not null and not exists (
      select 1 from public.teams where id = p_winner_team_id and game_key = p_game_key
    ) then
      raise exception 'Winner must be a team registered for this sport';
    end if;

    if p_match_id is null then
      insert into public.matches (game_key, title, scheduled_at, status, winner_team_id, team_a_id, team_b_id)
      values (p_game_key, (select concat(a.team_name, ' vs ', b.team_name) from public.teams a, public.teams b where a.id = p_team_a_id and b.id = p_team_b_id), p_scheduled_at, p_status, p_winner_team_id, p_team_a_id, p_team_b_id)
      returning id into v_match_id;
    else
      select winner_team_id, status into v_previous_winner_id, v_previous_status
      from public.matches
      where id = p_match_id;
      if not found then
        raise exception 'Match not found';
      end if;
      update public.matches
      set game_key = p_game_key,
          title = (select concat(a.team_name, ' vs ', b.team_name) from public.teams a, public.teams b where a.id = p_team_a_id and b.id = p_team_b_id),
          scheduled_at = p_scheduled_at,
          status = p_status,
          winner_team_id = p_winner_team_id,
          team_a_id = p_team_a_id,
          team_b_id = p_team_b_id,
          updated_at = now()
      where id = p_match_id
      returning id into v_match_id;
    end if;

    if v_previous_status = 'completed' and v_previous_winner_id is not null
       and (p_status <> 'completed' or v_previous_winner_id <> p_winner_team_id) then
      update public.team_scores
      set score = greatest(score - 1, 0), updated_at = now()
      where team_id = v_previous_winner_id;
    end if;
    if p_status = 'completed' and p_winner_team_id is not null
       and (v_previous_status <> 'completed' or v_previous_winner_id is distinct from p_winner_team_id) then
      insert into public.team_scores (team_id, score, updated_at)
      values (p_winner_team_id, 1, now())
      on conflict (team_id) do update
        set score = public.team_scores.score + 1, updated_at = now();
    end if;

    if v_previous_status = 'completed' and v_previous_winner_id is not null then
      update public.teams
      set eliminated_by_match_id = null
      where eliminated_by_match_id = v_match_id;
    end if;
    if p_status = 'completed' and p_winner_team_id is not null then
      update public.teams
      set eliminated_by_match_id = v_match_id
      where id = case when p_winner_team_id = p_team_a_id then p_team_b_id else p_team_a_id end;
    end if;

    return v_match_id;
  end;
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.get_leaderboard(text) to anon, authenticated;
grant execute on function public.get_match_schedule() to anon, authenticated;
grant execute on function public.get_admin_dashboard() to authenticated;
grant execute on function public.update_team_score(uuid, numeric) to authenticated;
grant execute on function public.update_team_details(uuid, text, text, text) to authenticated;
grant execute on function public.save_match(uuid, text, uuid, uuid, timestamptz, text, uuid) to authenticated;
