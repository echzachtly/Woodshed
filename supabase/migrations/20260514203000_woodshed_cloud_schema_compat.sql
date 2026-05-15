-- Woodshed cloud schema compatibility patch.
-- Ensures the live database has all columns the current app payload/select paths expect.
-- Safe to run repeatedly.

-- ---------------------------------------------------------------------------
-- woodshed_projects: fields used by cloud save/load
-- ---------------------------------------------------------------------------
alter table public.woodshed_projects
  add column if not exists audio_storage_path text;

alter table public.woodshed_projects
  add column if not exists audio_mime text default 'application/octet-stream';

alter table public.woodshed_projects
  add column if not exists active_loop_id text;

alter table public.woodshed_projects
  add column if not exists practice_state jsonb;

-- Normalize nulls for compatibility when the column exists but older rows are null.
update public.woodshed_projects
set audio_mime = 'application/octet-stream'
where audio_mime is null;

-- ---------------------------------------------------------------------------
-- woodshed_project_loops: fields used by cloud save/load
-- ---------------------------------------------------------------------------
alter table public.woodshed_project_loops
  add column if not exists notes text;

alter table public.woodshed_project_loops
  add column if not exists segments_json jsonb default '[]'::jsonb;

-- Normalize nulls for compatibility when the column exists but older rows are null.
update public.woodshed_project_loops
set segments_json = '[]'::jsonb
where segments_json is null;

comment on column public.woodshed_project_loops.notes is
  'Phrase-level notes persisted by Woodshed cloud save/load.';

comment on column public.woodshed_project_loops.segments_json is
  'Serialized focus regions (PhraseSegment[]) persisted by Woodshed cloud save/load.';

comment on column public.woodshed_projects.practice_state is
  'Woodshed client practice prefs v1: loop mode, activeSegmentId, lastPracticeSegmentIdByPhrase.';
