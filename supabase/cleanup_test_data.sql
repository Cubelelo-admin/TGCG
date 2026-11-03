-- One-time cleanup: wipes all test registration data and resets every
-- derived counter so real registrations start clean from BIB #1 / TGCG-0001.
-- Does NOT touch events, ticket_categories, addons, admin_allowlist,
-- app_settings, or site_assets rows themselves — only registration-derived
-- data and the counts/sequences those registrations had bumped.
--
-- Run once in the Supabase SQL editor, then confirm the row counts at the
-- bottom all read 0.

begin;

delete from wa_message_log;
delete from registration_addons;
delete from registrations;
delete from registration_groups;
delete from phone_otp_verifications;

-- These only increment on payment_status -> 'paid' UPDATE, never decrement
-- on DELETE (see 0004_sold_count_trigger.sql) — reset by hand or capacity
-- checks stay artificially inflated for real registrations afterward.
update ticket_categories set sold_count = 0;
update addons set sold_count = 0;

-- BIB numbering (0016_bib_number.sql) — restart per-distance counters.
update bib_counters set last_value = 0;
-- Retired-BIB pool (0020_reuse_retired_bibs.sql) — empty it alongside.
delete from bib_released;

-- Human-readable code numbering — restart so the first real registration is
-- TGCG-0001 / TGCG-G-0001 again. Per-event counters on `events` since
-- 0021_poc_and_multi_event.sql (the old global sequences are no longer used).
update events set registration_seq = 0, booking_seq = 0;

commit;

-- Verify — every count below should be 0.
select
  (select count(*) from registrations) as registrations,
  (select count(*) from registration_groups) as registration_groups,
  (select count(*) from registration_addons) as registration_addons,
  (select count(*) from wa_message_log) as wa_message_log,
  (select count(*) from phone_otp_verifications) as phone_otp_verifications,
  (select coalesce(sum(sold_count), 0) from ticket_categories) as ticket_categories_sold,
  (select coalesce(sum(sold_count), 0) from addons) as addons_sold,
  (select coalesce(sum(last_value), 0) from bib_counters) as bib_counters_sum;
