-- HackathonOS team space. All tables prefixed hackos_ so the schema can live in a
-- shared Supabase project without colliding with anything else.
-- Times are ms-epoch bigints to match the deterministic engine in core.js (no TZ math).
-- Apply with: supabase MCP apply_migration, `supabase db push`, or paste into the SQL editor.

create table hackos_teams (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null default '',
  theme text not null default '',
  tracks text[] not null default '{}',
  stack text not null default '',
  starts_at bigint not null,
  ends_at bigint not null,
  reqs jsonb not null default '{"devpost":true,"video":true,"repo":true}'::jsonb,
  created_at timestamptz not null default now()
);

create table hackos_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references hackos_teams(id) on delete cascade,
  name text not null,
  color text not null default '#4ade80',
  status_text text not null default '',
  -- idle/editing live here (not in presence meta): presence-channel meta UPDATES
  -- don't propagate reliably, only join/leave — postgres_changes does both
  idle boolean not null default false,
  editing boolean not null default false,
  last_active bigint not null default 0,
  created_at timestamptz not null default now()
);

-- one row = one checked-off gate; milestones themselves are derived
-- deterministically client-side from the team window (core.js genMilestones)
create table hackos_gates (
  team_id uuid not null references hackos_teams(id) on delete cascade,
  gate_id int not null,
  done_by uuid references hackos_members(id) on delete set null,
  done_at bigint not null default 0,
  primary key (team_id, gate_id)
);

create table hackos_tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references hackos_teams(id) on delete cascade,
  title text not null,
  assignee uuid references hackos_members(id) on delete set null,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  created_at timestamptz not null default now()
);

create table hackos_notes (
  team_id uuid primary key references hackos_teams(id) on delete cascade,
  content text not null default '',
  updated_by uuid references hackos_members(id) on delete set null,
  updated_at bigint not null default 0
);

-- ponytail: permissive RLS — the join code is the only secret. Anyone with the
-- publishable key can read/write hackos_* rows. Fine for a weekend tool;
-- upgrade path: Supabase Auth + membership-scoped policies.
alter table hackos_teams enable row level security;
alter table hackos_members enable row level security;
alter table hackos_gates enable row level security;
alter table hackos_tasks enable row level security;
alter table hackos_notes enable row level security;
create policy hackos_all on hackos_teams for all using (true) with check (true);
create policy hackos_all on hackos_members for all using (true) with check (true);
create policy hackos_all on hackos_gates for all using (true) with check (true);
create policy hackos_all on hackos_tasks for all using (true) with check (true);
create policy hackos_all on hackos_notes for all using (true) with check (true);

-- realtime: postgres_changes for every shared surface
alter publication supabase_realtime add table hackos_teams, hackos_members, hackos_gates, hackos_tasks, hackos_notes;

-- DELETE payloads must carry team_id so clients can scope them
-- (realtime filters don't apply to DELETE events; pk-only replica identity omits team_id)
alter table hackos_tasks replica identity full;
alter table hackos_members replica identity full;

-- shared files bucket (public: downloads are plain URLs), 10 MB cap per file
insert into storage.buckets (id, name, public, file_size_limit)
values ('hackos-files', 'hackos-files', true, 10485760)
on conflict (id) do nothing;
create policy hackos_files_read on storage.objects for select using (bucket_id = 'hackos-files');
create policy hackos_files_write on storage.objects for insert with check (bucket_id = 'hackos-files');
create policy hackos_files_delete on storage.objects for delete using (bucket_id = 'hackos-files');
