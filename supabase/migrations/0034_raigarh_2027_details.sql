-- TGCG Raigarh 2027: the confirmed details in place of 0022's placeholders (confirmed by the organiser,
-- 2026-11-27). Display copy for tickets and emails: src/lib/event-profiles.ts.
--   Date: Sunday 7 February 2027 · Venue: Mini Stadium, Kelo Vihar, Raigarh · First start 6:00 AM (21 KM)
--   Fees: ₹500 + tax for every race, competitive (21/10 KM) and non-competitive (21/10/6 KM);
--         GST and booking fees are added at checkout, as for TGCG 2026 ("Prices are excluding GST and Booking Fees").
--   No 42 KM and no Child Runner in Raigarh.
-- The event is switched on separately (is_active), once registration is tested.

update events
set event_date = '2027-02-07',
    venue = 'Mini Stadium, Kelo Vihar, Raigarh',
    starts_at_text = '6:00 AM IST Onwards',
    description = 'Singhal The Great Chhattisgarh Run 2027, Raigarh: 21 KM, 10 KM and 6 KM.'
where slug = 'raigarh-2027';

update ticket_categories
set price_inr = 500
where event_id = (select id from events where slug = 'raigarh-2027')
  and name <> 'Child Runner (Below 12)';

update ticket_categories
set is_active = false
where event_id = (select id from events where slug = 'raigarh-2027')
  and name = 'Child Runner (Below 12)';
