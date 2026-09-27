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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
        'score', coalesce(s.score, 0)
      )
      order by t.game_key, coalesce(s.score, 0) desc, t.team_name
    ),
    '[]'::jsonb
  )
  from public.teams t
  left join public.team_scores s on s.team_id = t.id
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
        'title', m.title,
        'scheduled_at', m.scheduled_at,
        'status', m.status
      )
      order by m.scheduled_at
    ),
    '[]'::jsonb
  )
  from public.matches m;
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
          'score', coalesce(s.score, 0),
          'roster', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'role', r.role,
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
          'title', m.title,
          'scheduled_at', m.scheduled_at,
          'status', m.status
        )
        order by m.scheduled_at
      )
      from public.matches m
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

create or replace function public.save_match(
  p_match_id uuid,
  p_game_key text,
  p_title text,
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
  begin
    if not public.is_admin() then
      raise exception 'Admin access required';
    end if;
    if p_game_key not in ('freefire', 'bgmi', 'codm') then
      raise exception 'Unknown game';
    end if;
    if trim(coalesce(p_title, '')) = '' then
      raise exception 'Match title is required';
    end if;
    if p_status not in ('scheduled', 'live', 'completed', 'cancelled') then
      raise exception 'Unknown match status';
    end if;

    if p_match_id is null then
      insert into public.matches (game_key, title, scheduled_at, status)
      values (p_game_key, trim(p_title), p_scheduled_at, p_status)
      returning id into v_match_id;
    else
      update public.matches
      set game_key = p_game_key,
          title = trim(p_title),
          scheduled_at = p_scheduled_at,
          status = p_status,
          updated_at = now()
      where id = p_match_id
      returning id into v_match_id;
      if v_match_id is null then
        raise exception 'Match not found';
      end if;
    end if;

    return v_match_id;
  end;
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.get_leaderboard(text) to anon, authenticated;
grant execute on function public.get_match_schedule() to anon, authenticated;
grant execute on function public.get_admin_dashboard() to authenticated;
grant execute on function public.update_team_score(uuid, numeric) to authenticated;
grant execute on function public.save_match(uuid, text, text, timestamptz, text) to authenticated;
