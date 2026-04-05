-- Track first login per user (null = never logged in via the app yet)
alter table users add column if not exists first_login_at timestamptz;
