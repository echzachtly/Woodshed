-- Optional JSON practice prefs (loop mode, focus selection) for cross-device restore.
alter table public.woodshed_projects
  add column if not exists practice_state jsonb;

comment on column public.woodshed_projects.practice_state is
  'Woodshed client practice prefs v1: loop mode, activeSegmentId, lastPracticeSegmentIdByPhrase';
