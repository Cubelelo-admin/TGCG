-- Human-readable Booking ID (e.g. "TGCG-G-0007") for a whole group
-- registration transaction, analogous to registrations.registration_code
-- (0008). Used as the shared link in every attendee's WhatsApp confirmation
-- and the organizer's summary email, so opening it shows every attendee's
-- ticket/QR from that single checkout — not just one person's.
--
-- Unlike registration_code (assigned via a row-level trigger keyed off
-- payment_status), registration_groups has no payment_status of its own —
-- payment lives on the child `registrations` rows. So this is assigned from
-- application code (payment-fulfillment.ts) via the assign_booking_code()
-- function below, right after a group's rows are marked paid.

create sequence if not exists booking_code_seq start 1;

alter table registration_groups add column if not exists booking_code text unique;

create index if not exists registration_groups_booking_code_idx
  on registration_groups (booking_code);

-- Idempotent, race-safe: if two callers (razorpay/verify and the webhook)
-- call this for the same group at nearly the same time, the UPDATE ... WHERE
-- booking_code IS NULL means only one of them actually consumes a sequence
-- value; the other sees the already-assigned code once it re-reads the row.
create or replace function assign_booking_code(p_group_id uuid)
returns text as $$
declare
  v_code text;
begin
  select booking_code into v_code from registration_groups where id = p_group_id;
  if v_code is not null then
    return v_code;
  end if;

  update registration_groups
  set booking_code = 'TGCG-G-' || lpad(nextval('booking_code_seq')::text, 4, '0')
  where id = p_group_id and booking_code is null
  returning booking_code into v_code;

  if v_code is null then
    select booking_code into v_code from registration_groups where id = p_group_id;
  end if;

  return v_code;
end;
$$ language plpgsql;
