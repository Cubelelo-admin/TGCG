-- TGCG Raigarh — February 2027. Second event, embedded via iframe at
--   https://tgcg.vercel.app/register/raigarh-2027
-- Requires 0021_poc_and_multi_event.sql.
--
-- Categories (confirmed 2026-11-03): every TGCG 2026 entry EXCEPT the 42 KM
-- Marathon (competitive and non-competitive) — i.e. 21K/10K competitive,
-- 21K/10K/6K non-competitive, plus Child Runner. Prices are copied from
-- TGCG 2026 as they stand when this runs.
--
-- ⚠ PLACEHOLDERS. The date, venue and start time below are NOT confirmed
-- yet. The event is seeded INACTIVE (is_active = false), so
-- /register/raigarh-2027 shows "Registration is not open yet" and no one
-- can pay until:
--   1. the real values are filled in (edit this file before running it, or
--      update the rows afterwards in the Supabase table editor), and
--   2. `update events set is_active = true where slug = 'raigarh-2027';`
-- The display copy (ticket page, emails) lives in src/lib/event-profiles.ts
-- and has matching placeholders to replace.

insert into events (slug, name, description, venue, event_date, starts_at_text, is_active, code_prefix)
values (
  'raigarh-2027',
  'LetsRun TGCG Raigarh 2027',
  'TBD — event description for the Raigarh edition.',
  'TBD — venue, Raigarh, Chhattisgarh',
  '2027-02-14', -- TBD: placeholder date (event_date is required)
  'TBD',
  false,
  'RGH'
)
on conflict (slug) do nothing;

-- Copied from TGCG 2026's current list (names, prices, age limits, KYC rule,
-- BIB prefix, child runner), minus the 42 KM categories. BIB counters for
-- this event start from xx001 automatically (0021).
insert into ticket_categories
  (event_id, "group", name, description, price_inr, min_age, max_age, capacity,
   requires_kyc, is_active, hidden_from_picker, sort_order, bib_prefix, bib_fixed_label)
select
  (select id from events where slug = 'raigarh-2027'),
  c."group", c.name, c.description, c.price_inr, c.min_age, c.max_age, null,
  c.requires_kyc, c.is_active, c.hidden_from_picker, c.sort_order, c.bib_prefix, c.bib_fixed_label
from ticket_categories c
where c.event_id = (select id from events where slug = 'tgcg-2026')
  and c.is_active
  and c.bib_prefix is distinct from '42' -- no full marathon in Raigarh
on conflict (event_id, name) do nothing;
