-- Child runner: an optional, 1-per-booking add-on for a child under 12
-- accompanying the group (name + an age-confirmation checkbox, ₹600).
-- Modeled as its own ticket category + registration row (so it gets a
-- normal QR ticket on the success page) rather than an addon, since addons
-- don't carry a per-selection name field. hidden_from_picker keeps it out
-- of the normal ticket-selection accordion — it's only ever added via the
-- dedicated "Add Child Runner" button.
alter table ticket_categories add column if not exists hidden_from_picker boolean not null default false;

-- A child registration has none of these — no phone (no OTP, no WhatsApp
-- number of their own), no gender/city/DOB/t-shirt/emergency contact.
alter table registrations alter column phone drop not null;
alter table registrations alter column gender drop not null;
alter table registrations alter column city drop not null;
alter table registrations alter column date_of_birth drop not null;
alter table registrations alter column tshirt_size drop not null;
alter table registrations alter column emergency_phone drop not null;

insert into ticket_categories
  (event_id, "group", name, description, price_inr, requires_kyc, is_active, hidden_from_picker, capacity, sort_order)
select id, 'non_competitive', 'Child Runner (Below 12)',
  'Accompanying child under 12 years — one per booking, no BIB/race entry.',
  600, false, true, true, null, 999
from events
on conflict (event_id, name) do nothing;
