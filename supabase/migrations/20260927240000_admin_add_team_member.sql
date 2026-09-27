create or replace function public.admin_add_team_member(
  p_team_id uuid,
  p_display_name text,
  p_email text,
  p_in_game_uid text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration_id uuid;
  v_game_key text;
  v_user_id uuid;
  v_email text := lower(trim(p_email));
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if trim(coalesce(p_display_name, '')) = '' or v_email = '' or trim(coalesce(p_in_game_uid, '')) = '' then
    raise exception 'Member name, email, and UID are required';
  end if;

  select game_key into v_game_key from public.teams where id = p_team_id;
  if v_game_key is null then raise exception 'Team not found'; end if;
  select id into v_user_id from public.profiles where lower(email) = v_email;

  insert into public.registrations (team_id, game_key, user_id, in_game_uid, role, email, display_name)
  values (p_team_id, v_game_key, v_user_id, trim(p_in_game_uid), 'member', v_email, trim(p_display_name))
  returning id into v_registration_id;

  return v_registration_id;
exception
  when unique_violation then
    raise exception 'This member email or UID is already registered for this sport';
end;
$$;

grant execute on function public.admin_add_team_member(uuid, text, text, text) to authenticated;
