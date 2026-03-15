-- Migration 009: Version Drive (PDF file attachments per version)
create table version_files (
  id                uuid    primary key default gen_random_uuid(),
  version_id        uuid    not null references course_versions(id) on delete cascade,
  original_filename text    not null,
  display_name      text    not null,
  storage_path      text    not null unique,
  size_bytes        bigint  not null,
  created_at        timestamptz default now()
);

create index on version_files(version_id);
