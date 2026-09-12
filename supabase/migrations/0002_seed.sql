-- Seed data for LetsRun TGCG 2026.
--
-- Verified 2026-09-12 directly against the live Townscript booking flow
-- (www.townscript.com/v2/e/letsrun-tgcg-2026/booking/tickets) using the
-- organizer login. The "Non Runner Friend" and "Accompanying Child" add-ons
-- were not offered on the live ticket list at all (they showed "SALE ENDED"
-- in an earlier Aug 31 snapshot), so they're seeded inactive — flip
-- is_active back on in Supabase if/when they're relisted.

insert into events (slug, name, description, venue, event_date, starts_at_text, is_active)
values (
  'tgcg-2026',
  'LetsRun TGCG 2026',
  'The Great Chhattisgarh Run - 9th edition qualifier run (RFID timed), the first run in Central India certified by AIMS/IAAF. Cash prizes for the top 3 in 42KM, 21KM and 10KM, plus a special women''s category prize.',
  'Ekatma Path Park, Ekatma Path, Sector 21, Atal Nagar-Nava Raipur',
  '2026-12-20',
  '4:00 AM IST Onwards',
  true
)
on conflict (slug) do nothing;

do $$
declare
  v_event_id uuid;
begin
  select id into v_event_id from events where slug = 'tgcg-2026';

  insert into ticket_categories (event_id, "group", name, description, price_inr, min_age, requires_kyc, sort_order)
  values
    (v_event_id, 'competitive', '21 KM Half Marathon Competitive', 'For runners who wish to compete for prizes. All required details must be accurate; incomplete/incorrect info leads to disqualification without claims.', 1454, 16, true, 1),
    (v_event_id, 'competitive', '10KM - Beginner Delight Competitive', 'For runners who wish to compete for prizes. All required details must be accurate; incomplete/incorrect info leads to disqualification without claims.', 1454, 14, true, 2),
    (v_event_id, 'competitive', '42 KM Marathon Competitive', 'For runners who wish to compete for prizes. All required details must be accurate; incomplete/incorrect info leads to disqualification without claims.', 1454, 18, true, 3),
    (v_event_id, 'non_competitive', '42 KM Marathon Non Competitive', 'For runners who wish to participate for the experience, fitness, and joy of running — without competing for prizes.', 1205, 18, false, 4),
    (v_event_id, 'non_competitive', '21 KM Half Marathon Non Competitive', 'For runners who wish to participate for the experience, fitness, and joy of running — without competing for prizes.', 1205, 16, false, 5),
    (v_event_id, 'non_competitive', '10KM - Beginner Delight Non Competitive', 'For runners who wish to participate for the experience, fitness, and joy of running — without competing for prizes.', 1205, 14, false, 6),
    (v_event_id, 'non_competitive', '6KM - Dream Run Non Competitive', 'For runners who wish to participate for the experience, fitness, and joy of running — without competing for prizes.', 1205, 12, false, 7)
  on conflict do nothing;

  insert into addons (event_id, name, description, price_inr, is_active, sort_order)
  values
    (v_event_id, 'Non Runner Friend', 'Accompanying Guest Pass for non-running friends, drivers, assistants, or parents. Non-timed bib, access to the holding area.', 650, false, 1),
    (v_event_id, 'Accompanying Child (up to 10 years)', 'Child Runner Pass for children accompanying a registered runner. Non-timed bib, access to the holding area.', 600, false, 2)
  on conflict do nothing;
end $$;
