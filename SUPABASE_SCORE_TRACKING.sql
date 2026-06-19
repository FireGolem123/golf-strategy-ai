-- Golf Strategy AI — Score Tracking Schema
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Run AFTER SUPABASE_SETUP.sql is already applied to the live DB.

-- 1. Extend the existing rounds table
alter table rounds
  add column if not exists tee_name text,
  add column if not exists course_rating numeric(4,1),
  add column if not exists slope_rating integer,
  add column if not exists total_par integer,
  add column if not exists holes_played integer default 18,
  add column if not exists source text default 'manual';

-- 2. New hole_scores table
create table if not exists hole_scores (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  round_id       uuid references rounds(id) on delete cascade not null,
  hole_number    integer not null check (hole_number between 1 and 18),
  par            integer check (par between 3 and 5),
  score          integer,
  putts          integer,
  fairway_result text check (fairway_result in ('hit', 'left', 'right')),
  gir            boolean,
  bunker_shots   integer default 0,
  chip_shots     integer default 0,
  penalties      integer default 0,
  created_at     timestamptz default now(),
  unique (round_id, hole_number)
);

alter table hole_scores enable row level security;

create policy "Users manage own hole scores"
  on hole_scores for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_hole_scores_round_id on hole_scores(round_id);
