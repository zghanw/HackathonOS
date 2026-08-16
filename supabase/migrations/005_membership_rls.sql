-- Phase 2: membership-scoped RLS. Closes pentest A1 (enumerate all teams/codes),
-- A2 (read foreign team data), A3 (exfiltrate all members/PII), A6 (list/delete
-- foreign files), A8 (write to arbitrary team), A9 (delete any team).
--
-- HARD DEPENDENCY: anonymous sign-ins must be ENABLED for the project
-- (Dashboard -> Authentication -> Sign In / Providers -> Anonymous sign-ins).
-- Every browser gets a real but password-less JWT, so auth.uid() is stable per
-- device and Realtime (postgres_changes) still delivers rows the member can SELECT.
-- Applying this migration BEFORE the client calls signInAnonymously() will deny
-- everything (auth.uid() is null) and brick the app. Ship client + toggle together.

-- ---------------------------------------------------------------------------
-- Identity on the member row.
-- ---------------------------------------------------------------------------
alter table hackos_members add column if not exists user_id uuid;

-- Membership predicate. SECURITY DEFINER so it reads hackos_members as the
-- (superuser) owner and does not recurse through the members SELECT policy.
create or replace function hackos_is_member(t uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from hackos_members m
    where m.team_id = t and m.user_id = auth.uid()
  );
$$;
-- Only signed-in sessions (anonymous auth still yields the `authenticated` role)
-- may run these. The bare `anon` role — a request with no JWT at all — gets nothing.
revoke all on function hackos_is_member(uuid) from public;
grant execute on function hackos_is_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Gated entry points. Creating and joining are the only ways to gain membership,
-- and both run as SECURITY DEFINER so the strict table policies can forbid direct
-- INSERTs. The join code is validated server-side and never leaves via SELECT.
-- ---------------------------------------------------------------------------
create or replace function hackos_create_team(
  p_name text, p_theme text, p_tracks text[], p_stack text,
  p_starts_at bigint, p_ends_at bigint, p_reqs jsonb,
  p_member_name text, p_milestones jsonb
) returns table(team_id uuid, member_id uuid, code text)
language plpgsql security definer set search_path = public as $$
declare
  v_team uuid; v_member uuid; v_code text;
  alpha text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if char_length(coalesce(p_member_name,'')) not between 1 and 40 then
    raise exception 'member name must be 1..40 chars';
  end if;
  loop
    v_code := (select string_agg(substr(alpha, 1 + floor(random()*length(alpha))::int, 1), '')
               from generate_series(1,6));
    -- qualify the column: the OUT param is also named `code`, bare `code` is ambiguous
    exit when not exists (select 1 from hackos_teams t where t.code = v_code);
  end loop;

  insert into hackos_teams(code,name,theme,tracks,stack,starts_at,ends_at,reqs)
  values (v_code, left(coalesce(p_name,''),120), left(coalesce(p_theme,''),2000),
          coalesce(p_tracks,'{}'), left(coalesce(p_stack,''),200),
          p_starts_at, p_ends_at, coalesce(p_reqs,'{}'::jsonb))
  returning id into v_team;

  insert into hackos_members(team_id,name,color,user_id,last_active)
  values (v_team, p_member_name, '#4ade80', auth.uid(), (extract(epoch from now())*1000)::bigint)
  returning id into v_member;

  if p_milestones is not null then
    insert into hackos_milestones(team_id,label,at,hard,updated_by)
    select v_team, left(e->>'label',300), (e->>'at')::bigint,
           coalesce((e->>'hard')::boolean,false), v_member
    from jsonb_array_elements(p_milestones) e
    where char_length(coalesce(e->>'label','')) between 1 and 300;
  end if;

  return query select v_team, v_member, v_code;
end $$;

create or replace function hackos_join_team(p_code text, p_member_name text)
returns table(team_id uuid, member_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_team uuid; v_member uuid; v_count int;
  colors text[] := array['#4ade80','#38bdf8','#c084fc','#fbbf24','#fb7185','#34d399','#f472b6','#a3e635'];
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if char_length(coalesce(p_member_name,'')) not between 1 and 40 then
    raise exception 'member name must be 1..40 chars';
  end if;

  select t.id into v_team from hackos_teams t where t.code = upper(trim(p_code));
  if v_team is null then raise exception 'no team found for that code'; end if;

  -- rejoin from the same device returns the existing membership (idempotent).
  -- qualify columns: the OUT params team_id/member_id shadow the table columns
  select m.id into v_member from hackos_members m
  where m.team_id = v_team and m.user_id = auth.uid() limit 1;

  if v_member is null then
    select count(*) into v_count from hackos_members m where m.team_id = v_team;
    insert into hackos_members(team_id,name,color,user_id,last_active)
    values (v_team, p_member_name, colors[1 + (v_count % 8)], auth.uid(),
            (extract(epoch from now())*1000)::bigint)
    returning id into v_member;
  end if;

  return query select v_team, v_member;
end $$;

revoke all on function hackos_create_team(text,text,text[],text,bigint,bigint,jsonb,text,jsonb) from public;
revoke all on function hackos_join_team(text,text) from public;
grant execute on function hackos_create_team(text,text,text[],text,bigint,bigint,jsonb,text,jsonb) to authenticated;
grant execute on function hackos_join_team(text,text) to authenticated;

-- Enumeration (A1) dies at the row level below: a non-member cannot SELECT any
-- team row, so codes are unreachable without first joining via the RPC. Members
-- still read their own team's code for the invite chip, so no column revoke.

-- ---------------------------------------------------------------------------
-- Swap wide-open policies for membership-scoped ones.
-- ---------------------------------------------------------------------------
drop policy if exists hackos_all on hackos_teams;
drop policy if exists hackos_all on hackos_members;
drop policy if exists hackos_all on hackos_milestones;
drop policy if exists hackos_all on hackos_tasks;
drop policy if exists hackos_all on hackos_notes;

-- teams: read + edit your own; creation via RPC only; no client deletes (retention
-- cron runs as postgres and bypasses RLS).
create policy hackos_teams_sel on hackos_teams for select to authenticated using (hackos_is_member(id));
create policy hackos_teams_upd on hackos_teams for update to authenticated using (hackos_is_member(id)) with check (hackos_is_member(id));

-- members: see co-members; edit/leave only your own row; joins add rows via RPC.
create policy hackos_members_sel on hackos_members for select to authenticated using (hackos_is_member(team_id));
create policy hackos_members_upd on hackos_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy hackos_members_del on hackos_members for delete to authenticated using (user_id = auth.uid());

-- shared surfaces: full CRUD, but only within a team you belong to.
create policy hackos_ms_all   on hackos_milestones for all to authenticated using (hackos_is_member(team_id)) with check (hackos_is_member(team_id));
create policy hackos_task_all on hackos_tasks      for all to authenticated using (hackos_is_member(team_id)) with check (hackos_is_member(team_id));
create policy hackos_note_all on hackos_notes      for all to authenticated using (hackos_is_member(team_id)) with check (hackos_is_member(team_id));

-- ---------------------------------------------------------------------------
-- Storage: private bucket, membership-scoped by the {team_id}/ path prefix (A6).
-- The regex guard runs before the uuid cast so a malformed key fails closed.
-- Downloads move to signed URLs (Files.jsx), since a private bucket has no public URL.
-- ---------------------------------------------------------------------------
update storage.buckets set public = false where id = 'hackos-files';

drop policy if exists hackos_files_read   on storage.objects;
drop policy if exists hackos_files_write  on storage.objects;
drop policy if exists hackos_files_delete on storage.objects;

create policy hackos_files_read on storage.objects for select to authenticated using (
  bucket_id = 'hackos-files'
  and name ~ '^[0-9a-fA-F-]{36}/'
  and hackos_is_member(split_part(name,'/',1)::uuid));
create policy hackos_files_write on storage.objects for insert to authenticated with check (
  bucket_id = 'hackos-files'
  and name ~ '^[0-9a-fA-F-]{36}/'
  and hackos_is_member(split_part(name,'/',1)::uuid));
create policy hackos_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'hackos-files'
  and name ~ '^[0-9a-fA-F-]{36}/'
  and hackos_is_member(split_part(name,'/',1)::uuid));

-- NOTE: retention-sweep.mjs must switch from the anon key to the SERVICE ROLE key.
-- Under these policies the anon role sees zero teams, so an anon sweeper would
-- treat every file as an orphan and wipe the bucket. Service role bypasses RLS.
