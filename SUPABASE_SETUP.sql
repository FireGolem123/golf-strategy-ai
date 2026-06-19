-- Golf Strategy AI — Supabase Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New query

-- ─────────────────────────────────────────────
-- 1. player_profile
-- ─────────────────────────────────────────────
create table if not exists player_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  ball_flight text,
  general_tendency text,
  handicap integer,
  home_course text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table player_profile enable row level security;

create policy "Users manage own profile"
  on player_profile for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 2. club_profiles
-- ─────────────────────────────────────────────
create table if not exists club_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  club_name text not null,
  carry_distance integer,
  miss_tendency text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table club_profiles enable row level security;

create policy "Users manage own clubs"
  on club_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 3. rounds
-- ─────────────────────────────────────────────
create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_name text,
  date date,
  score integer,
  notes text,
  created_at timestamptz default now()
);

alter table rounds enable row level security;

create policy "Users manage own rounds"
  on rounds for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 4. shot_history
-- ─────────────────────────────────────────────
create table if not exists shot_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  round_id uuid references rounds(id) on delete set null,
  hole_number integer,
  distance_to_pin integer,
  club_suggested text,
  club_used text,
  suggestion_rating integer check (suggestion_rating between 1 and 5),
  outcome text,
  conditions_noted text,
  created_at timestamptz default now()
);

alter table shot_history enable row level security;

create policy "Users manage own shot history"
  on shot_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 5. course_holes
-- ─────────────────────────────────────────────
create table if not exists course_holes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_name text not null,
  hole_number integer not null check (hole_number between 1 and 18),
  par integer check (par between 3 and 5),
  yardage_black integer,
  yardage_blue integer,
  yardage_white integer,
  hazards text,
  green_notes text,
  personal_notes text,
  created_at timestamptz default now(),
  unique (user_id, course_name, hole_number)
);

alter table course_holes enable row level security;

create policy "Users manage own course holes"
  on course_holes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Helpful indexes
-- ─────────────────────────────────────────────
create index if not exists idx_club_profiles_user_id on club_profiles(user_id);
create index if not exists idx_rounds_user_id_date on rounds(user_id, date desc);
create index if not exists idx_shot_history_round_id on shot_history(round_id);
create index if not exists idx_course_holes_lookup on course_holes(user_id, course_name, hole_number);
