begin;

revoke execute on function public.create_order(
  text,
  text,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.create_order(
  text,
  text,
  text,
  text,
  text,
  jsonb
) to service_role;

commit;
