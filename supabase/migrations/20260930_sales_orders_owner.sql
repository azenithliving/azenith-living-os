-- An order has never been able to name its customer, and the code already expected one:
-- lib/dal/unified-supabase.ts reads `sales_orders … users(name, email, phone)` as if the
-- link existed, and the database answered with nothing. Measured on the live store: five
-- orders, three carrying a free-text name, and that name matches zero customer profiles —
-- so the money could not reach a human without guessing, and one buyer appeared on the
-- customers screen twice: once by his number, once as an order nobody owns.
--
-- This adds the missing handle and nothing else. It is nullable on purpose: an order from
-- before the link stays exactly where it was, and the customers roll reports it as money
-- with no owner rather than inventing a person to hold it. ON DELETE SET NULL keeps the
-- customers delete door from taking an order down with a profile.
--SPLIT--
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'sales_orders' and column_name = 'user_id'
  ) then
    alter table public.sales_orders add column user_id uuid;
  end if;
end $$;
--SPLIT--
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'sales_orders_user_id_fkey'
       and conrelid = 'public.sales_orders'::regclass
  ) then
    alter table public.sales_orders
      add constraint sales_orders_user_id_fkey
      foreign key (user_id)
      references public.users (id)
      on delete set null;
  end if;
end $$;
--SPLIT--
create index if not exists sales_orders_user_id_idx on public.sales_orders (user_id);
