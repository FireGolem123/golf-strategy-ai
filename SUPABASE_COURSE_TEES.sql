-- Golf Strategy AI — Course Tees Schema
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Run AFTER SUPABASE_SETUP.sql and SUPABASE_SCORE_TRACKING.sql

create table if not exists course_tees (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  course_name    text not null,
  tee_name       text not null,
  gender         text not null default 'male',
  course_rating  numeric(4,1),
  slope_rating   integer,
  par_total      integer,
  holes_played   integer default 18,
  created_at     timestamptz default now(),
  unique (user_id, course_name, tee_name, gender)
);

alter table course_tees enable row level security;

create policy "Users manage own course tees"
  on course_tees for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_course_tees_lookup on course_tees(user_id, course_name);
