begin;

alter table public.store_settings
add column store_mode text generated always as (
  case
    when is_paused then 'paused'
    else 'open'
  end
) stored;

alter table public.store_settings
alter column store_mode drop expression,
alter column store_mode set default 'open',
alter column store_mode set not null;

alter table public.store_settings
add constraint store_settings_store_mode_check
check (store_mode in ('open', 'paused', 'closed_today'));

grant update (store_mode)
  on table public.store_settings to authenticated;

commit;
