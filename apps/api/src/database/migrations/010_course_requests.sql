-- Migration 010: course_requests + is_admin

alter table users add column if not exists is_admin boolean not null default false;

create table course_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references users(id) on delete cascade,
  course_name text not null,
  subject text,
  description text,
  institution text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'fulfilled')),
  course_template_id uuid references course_templates(id) on delete set null,
  created_at timestamptz default now(),
  fulfilled_at timestamptz
);