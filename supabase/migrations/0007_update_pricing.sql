-- Updated pricing per the organizer's official fee sheet (shared 2026-09-13),
-- replacing the earlier Townscript-derived seed prices from 0002_seed.sql.
-- Flat fee per group, regardless of distance:
--   Competitive (नकद पुरस्कार श्रेणी): ₹1,750 — 42KM / 21KM / 10KM
--   Non-Competitive (सामान्य पंजीकरण राशि): ₹1,450 — 42KM / 21KM / 10KM / 6KM Dream Run

update ticket_categories set price_inr = 1750 where "group" = 'competitive';
update ticket_categories set price_inr = 1450 where "group" = 'non_competitive';
