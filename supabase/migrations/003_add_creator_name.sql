-- Add creator name to projects for display in the home table
alter table if exists public.projects
  add column if not exists creator_name text;
