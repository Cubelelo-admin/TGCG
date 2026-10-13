-- Self-check for 0020_reuse_retired_bibs.sql. Safe to run on production:
-- it creates two throwaway registrations, exercises the BIB trigger, then
-- ALWAYS raises an exception at the end so every change it made is rolled
-- back. Read the result in the error message:
--   "BIB REUSE CHECK PASSED: ..."  -> working
--   anything else                  -> something is wrong, nothing was saved
--
-- registration_code is pre-filled on the test rows so the registration-code
-- sequence (which Postgres never rolls back) isn't consumed.

do $$
declare
  v_event uuid;
  v_cat42 uuid;
  v_cat21 uuid;
  v_a uuid;
  v_b uuid;
  v_bib_a1 text;
  v_bib_a2 text;
  v_bib_b text;
  v_lowest42 text;
begin
  select id into v_event from events where slug = 'tgcg-2026';
  select id into v_cat42 from ticket_categories where event_id = v_event and bib_prefix = '42' limit 1;
  select id into v_cat21 from ticket_categories
    where event_id = v_event and bib_prefix = '21'
      and "group" = (select "group" from ticket_categories where id = v_cat42)
    limit 1;
  if v_cat42 is null or v_cat21 is null then
    raise exception 'BIB REUSE CHECK FAILED: could not find 42K/21K categories';
  end if;

  -- Runner A pays for 42K.
  insert into registrations (event_id, ticket_category_id, amount_inr, full_name, registration_code)
  values (v_event, v_cat42, 0, 'BIB TEST A', 'TEST-BIB-A') returning id into v_a;
  update registrations set payment_status = 'paid' where id = v_a;
  select bib_number into v_bib_a1 from registrations where id = v_a;
  if v_bib_a1 is null or left(v_bib_a1, 2) <> '42' then
    raise exception 'BIB REUSE CHECK FAILED: 42K payment got BIB %', v_bib_a1;
  end if;

  -- Admin moves A to 21K (what the edit route does): old BIB must be released.
  update registrations set ticket_category_id = v_cat21, bib_number = null where id = v_a;
  select bib_number into v_bib_a2 from registrations where id = v_a;
  if v_bib_a2 is null or left(v_bib_a2, 2) <> '21' then
    raise exception 'BIB REUSE CHECK FAILED: after switch to 21K, A has BIB %', v_bib_a2;
  end if;
  if not exists (select 1 from bib_released where bib_number = v_bib_a1) then
    raise exception 'BIB REUSE CHECK FAILED: % was not put back in the pool', v_bib_a1;
  end if;

  -- Runner B pays for 42K: must get the lowest free retired 42K number.
  select min(bib_number) into v_lowest42 from bib_released b
    where prefix = '42' and not exists (select 1 from registrations r where r.bib_number = b.bib_number);
  insert into registrations (event_id, ticket_category_id, amount_inr, full_name, registration_code)
  values (v_event, v_cat42, 0, 'BIB TEST B', 'TEST-BIB-B') returning id into v_b;
  update registrations set payment_status = 'paid' where id = v_b;
  select bib_number into v_bib_b from registrations where id = v_b;
  if v_bib_b is distinct from v_lowest42 then
    raise exception 'BIB REUSE CHECK FAILED: B got %, expected retired %', v_bib_b, v_lowest42;
  end if;
  if exists (select 1 from bib_released where bib_number = v_bib_b) then
    raise exception 'BIB REUSE CHECK FAILED: % still in pool after reuse', v_bib_b;
  end if;

  raise exception 'BIB REUSE CHECK PASSED: A got % then % after switching to 21K; B reused retired % (rolled back, nothing saved)',
    v_bib_a1, v_bib_a2, v_bib_b;
end $$;
