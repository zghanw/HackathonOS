-- milestones become team-managed rows (label/time/hard editable, synced live).
-- A row carries its own check-off state, which makes hackos_gates redundant.
-- Existing teams keep an empty timeline after this migration (the old gate_id ints
-- can't map to edited schedules); new teams seed the classic plan at creation.
create table hackos_milestones (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references hackos_teams(id) on delete cascade,
  label text not null,
  at bigint not null,
  hard boolean not null default false,
  done_by uuid references hackos_members(id) on delete set null,
  done_at bigint not null default 0,
  updated_by uuid references hackos_members(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table hackos_milestones enable row level security;
create policy hackos_all on hackos_milestones for all using (true) with check (true);
alter publication supabase_realtime add table hackos_milestones;
-- note: with RLS enabled, realtime strips `old` payloads to the pk regardless of
-- replica identity, so clients detect edits against local state and attribute
-- deletes via a broadcast message. Kept full for parity with the other tables.
alter table hackos_milestones replica identity full;

drop table if exists hackos_gates;
