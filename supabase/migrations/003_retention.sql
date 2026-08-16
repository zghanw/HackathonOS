-- Retention / TTL for finished hackathon rooms.
--
-- Anchor: hackos_teams.ends_at is the hackathon's hard end. Unlike most apps we do
-- not need last-activity heuristics to decide a room is dead, the room told us when
-- it would die at creation time. Retention is measured from ends_at, not created_at
-- and not last_active.
--
-- Split of responsibilities, forced by a platform constraint:
--   rows  -> deleted here in SQL. FK cascades from hackos_teams clear members,
--            milestones, tasks and notes in one statement.
--   files -> CANNOT be deleted from SQL. storage.objects carries a
--            protect_objects_delete trigger (storage.protect_delete) that rejects
--            direct DELETE. Files must go through the Storage API, so a sweeper
--            does that pass. See hackos_orphan_files below and scripts/retention-sweep.mjs.

-- ---------------------------------------------------------------------------
-- Ledger. Outlives the rows it describes, so "where did our team space go" has
-- an answer after the data is gone. One row per purged team, a few dozen bytes.
-- ---------------------------------------------------------------------------
create table if not exists hackos_retention_log (
  id          bigserial primary key,
  team_id     uuid        not null,
  code        text,
  name        text,
  ended_at    timestamptz not null,
  members     bigint      not null default 0,
  milestones  bigint      not null default 0,
  tasks       bigint      not null default 0,
  purged_at   timestamptz not null default now()
);

comment on table hackos_retention_log is
  'Audit trail of TTL purges. Storage cleanup is reconciled separately by the orphan sweeper.';

-- ---------------------------------------------------------------------------
-- Purge. Idempotent, and dry_run by default so the destructive path is opt-in.
-- Returns the same shape in both modes, so a dry run is an honest preview of a
-- real run rather than a different code path.
-- ---------------------------------------------------------------------------
create or replace function hackos_purge_expired(
  grace_days int     default 30,
  dry_run    boolean default true
)
returns table (
  team_id    uuid,
  code       text,
  name       text,
  dead_days  numeric,
  members    bigint,
  milestones bigint,
  tasks      bigint,
  purged     boolean
)
language plpgsql
as $$
declare
  cutoff timestamptz;
  r      record;
begin
  -- Guard rail. A room whose event ended yesterday is still being written up,
  -- screenshotted and argued about. Refuse the fat-finger that would delete it.
  if grace_days is null or grace_days < 7 then
    raise exception
      'grace_days must be >= 7 (got %). Rooms stay readable for at least a week after the event.',
      grace_days;
  end if;

  cutoff := now() - make_interval(days => grace_days);

  for r in
    select t.id,
           t.code,
           t.name,
           to_timestamp(t.ends_at / 1000.0) as ended,
           (select count(*) from hackos_members    m where m.team_id = t.id) as members,
           (select count(*) from hackos_milestones s where s.team_id = t.id) as milestones,
           (select count(*) from hackos_tasks      k where k.team_id = t.id) as tasks
    from hackos_teams t
    where to_timestamp(t.ends_at / 1000.0) < cutoff
    order by t.ends_at
  loop
    if not dry_run then
      insert into hackos_retention_log (team_id, code, name, ended_at, members, milestones, tasks)
      values (r.id, r.code, r.name, r.ended, r.members, r.milestones, r.tasks);

      -- cascades to members, milestones, tasks, notes
      delete from hackos_teams where id = r.id;
    end if;

    team_id    := r.id;
    code       := r.code;
    name       := r.name;
    dead_days  := round(extract(epoch from (now() - r.ended)) / 86400.0, 1);
    members    := r.members;
    milestones := r.milestones;
    tasks      := r.tasks;
    purged     := not dry_run;
    return next;
  end loop;
end;
$$;

comment on function hackos_purge_expired is
  'TTL purge of rooms whose hackathon ended more than grace_days ago. Dry run by default.';

-- ---------------------------------------------------------------------------
-- Storage reconciliation. Files live at hackos-files/{team_id}/{filename}, so a
-- file whose team row is gone is garbage. Deriving orphans from current state
-- (rather than from a delete queue) makes the sweeper self-healing: a half-failed
-- purge, a manual row delete, or a missed cron run all converge on the next pass.
-- ---------------------------------------------------------------------------
create or replace view hackos_orphan_files as
select o.name                              as path,
       split_part(o.name, '/', 1)::uuid    as team_id,
       coalesce((o.metadata->>'size')::bigint, 0) as size_bytes,
       o.created_at
from storage.objects o
where o.bucket_id = 'hackos-files'
  and o.name like '%/%'
  and not exists (
    select 1 from hackos_teams t
    where t.id::text = split_part(o.name, '/', 1)
  );

comment on view hackos_orphan_files is
  'Files in hackos-files with no surviving team. Deleted by scripts/retention-sweep.mjs (Storage API; SQL DELETE is blocked by storage.protect_delete).';

-- ---------------------------------------------------------------------------
-- Schedule. Daily at 03:17 UTC, deliberately off the hour to avoid the
-- everyone-schedules-at-00:00 stampede on shared infrastructure.
--
-- NOTE: pg_cron only fires while the project is running. A paused free-tier
-- project runs nothing, so treat this as best-effort hygiene, not a guarantee.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule(
  'hackos-retention',
  '17 3 * * *',
  $$select hackos_purge_expired(30, false)$$
);
