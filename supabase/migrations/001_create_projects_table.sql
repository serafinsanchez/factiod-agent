-- Create the projects table to store pipeline snapshots and asset paths
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  topic text not null,
  model text not null,
  title text,
  description text,

  project_slug text not null,
  script_path text,
  audio_path text,
  thumbnail_path text,

  pipeline jsonb not null
);

-- Create an index on created_at for faster ordering
create index if not exists idx_projects_created_at on public.projects(created_at desc);

-- Create an index on project_slug for faster lookups
create index if not exists idx_projects_project_slug on public.projects(project_slug);

-- Add a comment to the table
comment on table public.projects is 'Stores project pipeline snapshots and asset paths for the factoid agent';

