-- 20261003_a_customer_city.sql
-- Where the customer's home is, said in his own words.
--
-- Measured 2026-10-03: the store cannot answer «إنتوا فين؟» by area because no table holds a
-- city or district anywhere — the only free text in the whole roll is a note on a two-row
-- leads table. The council agreed the number is asked at the moment he wants his suggestions
-- sent to his own phone; the area is asked in the same breath, because a phone number without
-- a place to deliver to is half a lead.
--
-- Nullable by design: a paper that was never claimed keeps saying «من غير صاحب», and a
-- customer who gives only a number is still a customer.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_sketches' and column_name = 'customer_city'
  ) then
    alter table public.room_sketches add column customer_city text;
    comment on column public.room_sketches.customer_city is
      'المنطقة كما كتبها العميل بنفسه — حرف حر، مش قائمة مفروضة';
  end if;
end $$;
