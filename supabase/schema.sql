-- "Где ДПС?" schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";
-- Optional, enables geography types / spatial indexes. Safe to skip on plans
-- without PostGIS -- lat/lng are stored as plain double precision either way.
create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('telegram', 'vk', 'max', 'web')),
  platform_id text not null,                 -- telegram user id / vk id / max id
  display_name text,
  avatar_url text,
  phone text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (platform, platform_id)
);

create index if not exists app_users_role_idx on public.app_users (role);
create index if not exists app_users_last_seen_idx on public.app_users (last_seen_at);

-- ---------------------------------------------------------------------------
-- DPS markers
-- ---------------------------------------------------------------------------
create table if not exists public.dps_markers (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.app_users (id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  note text,
  created_at timestamptz not null default now(),
  -- Marker is auto-removed once now() > expires_at. Every confirmation
  -- ("still here") pushes this 3 hours into the future.
  expires_at timestamptz not null default (now() + interval '3 hours'),
  confirmations_count integer not null default 0
);

create index if not exists dps_markers_expires_idx on public.dps_markers (expires_at);
create index if not exists dps_markers_location_idx on public.dps_markers (lat, lng);

-- ---------------------------------------------------------------------------
-- Comments on a marker
-- ---------------------------------------------------------------------------
create table if not exists public.dps_marker_comments (
  id uuid primary key default gen_random_uuid(),
  marker_id uuid not null references public.dps_markers (id) on delete cascade,
  author_id uuid references public.app_users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists dps_marker_comments_marker_idx on public.dps_marker_comments (marker_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- API routes use the service-role key (bypasses RLS) for all writes, so the
-- policies below only need to allow anonymous read access for the public map.
-- ---------------------------------------------------------------------------
alter table public.app_users enable row level security;
alter table public.dps_markers enable row level security;
alter table public.dps_marker_comments enable row level security;

drop policy if exists "markers are publicly readable" on public.dps_markers;
create policy "markers are publicly readable"
  on public.dps_markers for select
  using (true);

drop policy if exists "comments are publicly readable" on public.dps_marker_comments;
create policy "comments are publicly readable"
  on public.dps_marker_comments for select
  using (true);

-- No public policy on app_users: profile data is only ever read/written
-- through server-side API routes using the service-role key.
