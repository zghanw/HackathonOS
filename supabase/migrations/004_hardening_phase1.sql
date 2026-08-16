-- Phase 1 security hardening: fixes independent of the identity model.
-- Closes pentest findings A4 (retention log readable by anon), A5 (orphan view
-- exposed storage internals), the mutable-search_path lint, and A7 (unbounded
-- writes) via data-layer input caps. Verified with the anon key post-apply.

alter table hackos_retention_log enable row level security;
revoke all on hackos_retention_log from anon, authenticated;

alter view hackos_orphan_files set (security_invoker = on);
revoke all on hackos_orphan_files from anon, authenticated;

alter function hackos_purge_expired(int, boolean) set search_path = public, pg_temp;

alter table hackos_teams
  add constraint hackos_teams_code_fmt   check (char_length(code) between 6 and 12),
  add constraint hackos_teams_name_len   check (char_length(name)  <= 120),
  add constraint hackos_teams_theme_len  check (char_length(theme) <= 2000),
  add constraint hackos_teams_stack_len  check (char_length(stack) <= 200),
  add constraint hackos_teams_tracks_len check (coalesce(array_length(tracks, 1), 0) <= 30);

alter table hackos_members
  add constraint hackos_members_name_len   check (char_length(name) between 1 and 40),
  add constraint hackos_members_status_len check (char_length(status_text) <= 120),
  add constraint hackos_members_color_fmt  check (color ~ '^#[0-9a-fA-F]{6}$');

alter table hackos_milestones
  add constraint hackos_milestones_label_len check (char_length(label) between 1 and 300);

alter table hackos_tasks
  add constraint hackos_tasks_title_len check (char_length(title) between 1 and 280);

alter table hackos_notes
  add constraint hackos_notes_len check (char_length(content) <= 100000);
