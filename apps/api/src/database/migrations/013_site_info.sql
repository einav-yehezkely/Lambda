-- Site info: single-row table for editable about/info content shown in the navbar info card
create table if not exists site_info (
  id int primary key default 1 check (id = 1),
  content text not null default '',
  updated_at timestamptz default now()
);

insert into site_info (id, content)
values (1, 'Welcome to Lambda!')
on conflict (id) do nothing;
