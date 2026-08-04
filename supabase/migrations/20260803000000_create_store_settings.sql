begin;

create table public.store_settings (
  id smallint primary key default 1,
  is_paused boolean not null default false,
  return_time timestamptz,
  pause_message text,
  updated_at timestamptz not null default now(),
  constraint store_settings_single_row check (id = 1)
);

insert into public.store_settings (id)
values (1);

create or replace function public.set_store_settings_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_store_settings_updated_at
before update on public.store_settings
for each row
execute function public.set_store_settings_updated_at();

alter table public.store_settings enable row level security;

revoke all on table public.store_settings from public, anon, authenticated;
grant select on table public.store_settings to anon, authenticated;
grant update (is_paused, return_time, pause_message)
  on table public.store_settings to authenticated;

create policy "Public can read store settings"
on public.store_settings
for select
to anon, authenticated
using (true);

create policy "Administrator can update store settings"
on public.store_settings
for update
to authenticated
using (auth.uid() = 'dcf88d88-cb5e-4378-89e1-ba1020cb20e8'::uuid)
with check (
  auth.uid() = 'dcf88d88-cb5e-4378-89e1-ba1020cb20e8'::uuid
  and id = 1
);

commit;
