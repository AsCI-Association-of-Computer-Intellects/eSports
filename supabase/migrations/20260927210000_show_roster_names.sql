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
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  perform public.link_my_gmail_tickets();
  select lower(email) into v_email from auth.users where id = v_user_id;

  return coalesce((
    select jsonb_agg(ticket order by ticket->>'created_at' desc)
    from (
      select jsonb_build_object(
        'team_id', t.id, 'team_name', t.team_name, 'game_key', mine.game_key,
        'role', mine.role, 'in_game_uid', mine.in_game_uid, 'email', mine.email,
        'display_name', mine.display_name, 'branch', mine.branch, 'section', mine.section,
        'year_of_study', mine.year_of_study, 'created_at', mine.created_at,
        'roster', (
          select jsonb_agg(jsonb_build_object(
            'role', r.role, 'in_game_uid', r.in_game_uid, 'display_name', coalesce(rp.display_name, r.display_name, r.email),
            'email', r.email, 'branch', r.branch, 'section', r.section,
            'year_of_study', r.year_of_study, 'claimed', r.user_id is not null
          ) order by case when r.role = 'leader' then 0 else 1 end, r.created_at)
          from public.registrations r left join public.profiles rp on rp.id = r.user_id where r.team_id = t.id
        )
      ) as ticket
      from public.registrations mine
      join public.teams t on t.id = mine.team_id
      where mine.user_id = v_user_id or (v_email is not null and lower(mine.email) = v_email)
    ) tickets
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_my_tickets() to authenticated;
