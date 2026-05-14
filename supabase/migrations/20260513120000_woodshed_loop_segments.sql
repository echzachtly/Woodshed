-- Phrase notes + lightweight segments (JSON array) per loop row.
alter table public.woodshed_project_loops
  add column if not exists notes text;

alter table public.woodshed_project_loops
  add column if not exists segments_json jsonb not null default '[]'::jsonb;
