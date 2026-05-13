-- Woodshed cloud persistence: tables, RLS, private Storage bucket, and storage RLS.
-- Safe to run in Supabase SQL Editor. Re-running updates policies via DROP IF EXISTS.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.woodshed_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Untitled session',
  audio_storage_path text not null,
  audio_mime text not null default 'application/octet-stream',
  active_loop_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists woodshed_projects_user_updated_idx
  on public.woodshed_projects (user_id, updated_at desc);

create table if not exists public.woodshed_project_loops (
  project_id uuid not null references public.woodshed_projects (id) on delete cascade,
  loop_id text not null,
  name text not null,
  start_sec double precision not null,
  end_sec double precision not null,
  tempo double precision not null default 1,
  sort_index integer not null default 0,
  primary key (project_id, loop_id)
);

create index if not exists woodshed_project_loops_project_idx
  on public.woodshed_project_loops (project_id);

-- ---------------------------------------------------------------------------
-- Row level security: public tables
-- ---------------------------------------------------------------------------

alter table public.woodshed_projects enable row level security;
alter table public.woodshed_project_loops enable row level security;

drop policy if exists "woodshed_projects_select_own" on public.woodshed_projects;
drop policy if exists "woodshed_projects_insert_own" on public.woodshed_projects;
drop policy if exists "woodshed_projects_update_own" on public.woodshed_projects;
drop policy if exists "woodshed_projects_delete_own" on public.woodshed_projects;

create policy "woodshed_projects_select_own"
  on public.woodshed_projects
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "woodshed_projects_insert_own"
  on public.woodshed_projects
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "woodshed_projects_update_own"
  on public.woodshed_projects
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "woodshed_projects_delete_own"
  on public.woodshed_projects
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "woodshed_loops_select_own" on public.woodshed_project_loops;
drop policy if exists "woodshed_loops_insert_own" on public.woodshed_project_loops;
drop policy if exists "woodshed_loops_update_own" on public.woodshed_project_loops;
drop policy if exists "woodshed_loops_delete_own" on public.woodshed_project_loops;

create policy "woodshed_loops_select_own"
  on public.woodshed_project_loops
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.woodshed_projects p
      where p.id = woodshed_project_loops.project_id
        and p.user_id = (select auth.uid())
    )
  );

create policy "woodshed_loops_insert_own"
  on public.woodshed_project_loops
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.woodshed_projects p
      where p.id = woodshed_project_loops.project_id
        and p.user_id = (select auth.uid())
    )
  );

create policy "woodshed_loops_update_own"
  on public.woodshed_project_loops
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.woodshed_projects p
      where p.id = woodshed_project_loops.project_id
        and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.woodshed_projects p
      where p.id = woodshed_project_loops.project_id
        and p.user_id = (select auth.uid())
    )
  );

create policy "woodshed_loops_delete_own"
  on public.woodshed_project_loops
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.woodshed_projects p
      where p.id = woodshed_project_loops.project_id
        and p.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: private bucket woodshed-audio
-- Object path layout: {user_id}/{project_id}/audio
-- First path segment must equal auth.uid()::text for all object policies.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('woodshed-audio', 'woodshed-audio', false)
on conflict (id) do nothing;

drop policy if exists "woodshed_audio_select_own" on storage.objects;
drop policy if exists "woodshed_audio_insert_own" on storage.objects;
drop policy if exists "woodshed_audio_update_own" on storage.objects;
drop policy if exists "woodshed_audio_delete_own" on storage.objects;

create policy "woodshed_audio_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'woodshed-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "woodshed_audio_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'woodshed-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "woodshed_audio_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'woodshed-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'woodshed-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "woodshed_audio_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'woodshed-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
