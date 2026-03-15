-- Migration 008: Version ratings (1–5 stars)
create table version_ratings (
  user_id    uuid not null references users(id) on delete cascade,
  version_id uuid not null references course_versions(id) on delete cascade,
  rating     int  not null check (rating between 1 and 5),
  created_at timestamptz default now(),
  primary key (user_id, version_id)
);
