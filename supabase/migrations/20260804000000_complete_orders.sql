begin;

create or replace function public.validate_completed_order_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'completed' and new is distinct from old then
    raise exception 'Pedidos finalizados não podem ser alterados.'
      using errcode = 'P0001';
  end if;

  if new.status = 'completed' and old.status <> 'confirmed' then
    raise exception 'Somente pedidos confirmados podem ser finalizados.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_completed_order_transition()
from public, anon, authenticated;

drop trigger if exists validate_completed_order_transition
on public.orders;

create trigger validate_completed_order_transition
before update on public.orders
for each row
execute function public.validate_completed_order_transition();

create or replace function public.complete_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_order_count integer;
begin
  if auth.uid() is distinct from
    'dcf88d88-cb5e-4378-89e1-ba1020cb20e8'::uuid then
    raise exception 'Acesso não autorizado.'
      using errcode = '42501';
  end if;

  update public.orders
  set status = 'completed'
  where id = p_order_id
    and status = 'confirmed';

  get diagnostics updated_order_count = row_count;

  return updated_order_count = 1;
end;
$$;

revoke all on function public.complete_order(uuid)
from public, anon;

grant execute on function public.complete_order(uuid)
to authenticated;

commit;
