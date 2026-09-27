-- Run this in the Supabase SQL editor (Dashboard → SQL).
-- Auth is Google-only in the app. Tickets are tied to Gmail.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  game_key text not null check (game_key in ('freefire', 'bgmi', 'codm')),
  team_name text not null,
  leader_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (game_key, leader_id)
);

create unique index if not exists teams_game_name_unique
  on public.teams (game_key, lower(team_name));

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  game_key text not null check (game_key in ('freefire', 'bgmi', 'codm')),
  user_id uuid references public.profiles (id) on delete set null,
  in_game_uid text not null,
  role text not null check (role in ('leader', 'member')),
  email text,
  branch text,
  section text,
  year_of_study text,
  created_at timestamptz not null default now()
);

alter table public.registrations add column if not exists branch text;
alter table public.registrations add column if not exists section text;
alter table public.registrations add column if not exists year_of_study text;

create unique index if not exists registrations_game_uid_unique
  on public.registrations (game_key, lower(in_game_uid));

create unique index if not exists registrations_game_user_unique
  on public.registrations (game_key, user_id)
  where user_id is not null;

create unique index if not exists registrations_game_email_unique
  on public.registrations (game_key, lower(email))
  where email is not null;

create unique index if not exists registrations_one_leader_per_team
  on public.registrations (team_id)
  where role = 'leader';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.profiles.display_name);

  update public.registrations r
  set user_id = new.id
  where r.user_id is null
    and new.email is not null
    and lower(r.email) = lower(new.email)
    and not exists (
      select 1 from public.registrations x
      where x.game_key = r.game_key and x.user_id = new.id
    );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.my_team_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.team_id
  from public.registrations r
  left join auth.users u on u.id = auth.uid()
  where r.user_id = auth.uid()
     or (u.email is not null and lower(r.email) = lower(u.email));
$$;

drop function if exists public.register_team(text, text, text, jsonb);

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
      and (
        user_id = v_user_id
        or lower(email) = v_leader_email
      )
  ) then
    raise exception 'This Gmail is already registered for this game. One team per game.';
  end if;

  if exists (
    select 1 from public.registrations
    where game_key = p_game_key
      and lower(in_game_uid) = v_leader_uid
  ) then
    raise exception 'UID is already associated with another team for this game.';
  end if;

  insert into public.teams (game_key, team_name, leader_id)
  values (p_game_key, trim(p_team_name), v_user_id)
  returning id into v_team_id;

  insert into public.registrations (
    team_id, game_key, user_id, in_game_uid, role, email, branch, section, year_of_study
  )
  values (
    v_team_id,
    p_game_key,
    v_user_id,
    trim(p_leader->>'in_game_uid'),
    'leader',
    v_leader_email,
    trim(p_leader->>'branch'),
    trim(p_leader->>'section'),
    trim(p_leader->>'year_of_study')
  );

  for v_member in select * from jsonb_array_elements(coalesce(p_members, '[]'::jsonb))
  loop
    v_uid := lower(trim(coalesce(v_member->>'in_game_uid', '')));
    v_email := nullif(lower(trim(coalesce(v_member->>'email', ''))), '');

    if v_uid = '' and v_email is null then
      continue;
    end if;

    if v_uid = '' or v_email is null then
      raise exception 'Each teammate needs both a Gmail and an in-game UID';
    end if;

    if trim(coalesce(v_member->>'branch', '')) = ''
       or trim(coalesce(v_member->>'section', '')) = ''
       or trim(coalesce(v_member->>'year_of_study', '')) = '' then
      raise exception 'Each teammate needs branch, section, and year of study';
    end if;

    if v_uid = any (v_seen_uid) then
      raise exception 'Each in-game UID can only appear once on a roster';
    end if;
    v_seen_uid := array_append(v_seen_uid, v_uid);

    if exists (
      select 1 from public.registrations
      where game_key = p_game_key
        and lower(in_game_uid) = v_uid
    ) then
      raise exception 'UID is already associated with another team for this game.';
    end if;

    if v_email = any (v_seen_email) then
      raise exception 'Each Gmail can only appear once on a roster';
    end if;
    v_seen_email := array_append(v_seen_email, v_email);

    v_member_user := null;
    select id into v_member_user
    from public.profiles
    where lower(email) = v_email;

    if v_member_user = v_user_id then
      raise exception 'The team leader cannot also be listed as a member';
    end if;

    if exists (
      select 1 from public.registrations
      where game_key = p_game_key
        and (
          lower(email) = v_email
          or (v_member_user is not null and user_id = v_member_user)
        )
    ) then
      raise exception 'A listed Gmail is already registered for this game';
    end if;

    insert into public.registrations (
      team_id, game_key, user_id, in_game_uid, role, email, branch, section, year_of_study
    )
    values (
      v_team_id,
      p_game_key,
      v_member_user,
      trim(v_member->>'in_game_uid'),
      'member',
      v_email,
      trim(v_member->>'branch'),
      trim(v_member->>'section'),
      trim(v_member->>'year_of_study')
    );
  end loop;

  return v_team_id;
exception
  when unique_violation then
    raise exception 'This team name, Gmail, or in-game UID is already registered for this game';
end;
$$;

create or replace function public.link_my_gmail_tickets()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
begin
  if v_user_id is null then
    return;
  end if;

  select lower(email) into v_email from auth.users where id = v_user_id;
  if v_email is null then
    return;
  end if;

  update public.registrations r
  set user_id = v_user_id
  where r.user_id is null
    and lower(r.email) = v_email
    and not exists (
      select 1 from public.registrations x
      where x.game_key = r.game_key and x.user_id = v_user_id
    );
end;
$$;

drop function if exists public.claim_roster_spot(text, text);

drop function if exists public.get_my_tickets();

create or replace function public.get_my_tickets()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.link_my_gmail_tickets();
  select lower(email) into v_email from auth.users where id = v_user_id;

  return coalesce(
    (
      select jsonb_agg(ticket order by ticket->>'created_at' desc)
      from (
        select jsonb_build_object(
          'team_id', t.id,
          'team_name', t.team_name,
          'game_key', mine.game_key,
          'role', mine.role,
          'in_game_uid', mine.in_game_uid,
          'email', mine.email,
          'branch', mine.branch,
          'section', mine.section,
          'year_of_study', mine.year_of_study,
          'created_at', mine.created_at,
          'roster', (
            select jsonb_agg(
              jsonb_build_object(
                'role', r.role,
                'in_game_uid', r.in_game_uid,
                'email', r.email,
                'branch', r.branch,
                'section', r.section,
                'year_of_study', r.year_of_study,
                'claimed', r.user_id is not null
              )
              order by case when r.role = 'leader' then 0 else 1 end, r.created_at
            )
            from public.registrations r
            where r.team_id = t.id
          )
        ) as ticket
        from public.registrations mine
        join public.teams t on t.id = mine.team_id
        where mine.user_id = v_user_id
           or (v_email is not null and lower(mine.email) = v_email)
      ) tickets
    ),
    '[]'::jsonb
  );
end;
$$;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.registrations enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  using (id = auth.uid());

drop policy if exists "read own teams" on public.teams;
create policy "read own teams"
  on public.teams for select
  using (id in (select public.my_team_ids()));

drop policy if exists "read own registrations" on public.registrations;
create policy "read own registrations"
  on public.registrations for select
  using (team_id in (select public.my_team_ids()));

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.teams to authenticated;
grant select on public.registrations to authenticated;
grant execute on function public.register_team(text, text, jsonb, jsonb) to authenticated;
grant execute on function public.get_my_tickets() to authenticated;
grant execute on function public.link_my_gmail_tickets() to authenticated;
grant execute on function public.my_team_ids() to authenticated;

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

  update public.teams set team_name = trim(p_team_name) where id = p_team_id;
  if not found then
    raise exception 'Team not found';
  end if;
  update public.registrations
  set email = lower(trim(p_leader_email)), display_name = trim(p_leader_name)
  where team_id = p_team_id and role = 'leader';
  update public.profiles set display_name = trim(p_leader_name) where id = v_leader_user_id;
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
  if not exists (select 1 from public.teams where id = p_team_a_id and game_key = p_game_key)
     or not exists (select 1 from public.teams where id = p_team_b_id and game_key = p_game_key) then
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
  if p_status = 'completed' and p_winner_team_id is not null
     and (v_previous_status <> 'completed' or v_previous_winner_id is distinct from p_winner_team_id) then
    insert into public.team_scores (team_id, score, updated_at)
    values (p_winner_team_id, 1, now())
    on conflict (team_id) do update
      set score = public.team_scores.score + 1, updated_at = now();
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

create or replace function public.prevent_closed_freefire_registration()
returns trigger
language plpgsql
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
grant execute on function public.save_match(uuid, text, uuid, uuid, text, text, timestamptz, text, uuid) to authenticated;
