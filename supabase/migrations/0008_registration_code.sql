-- Unique, human-readable registration code (e.g. "TGCG-0001") assigned the
-- moment a registration is confirmed paid. Used on the success-page ticket
-- (QR code) and for BIB distribution / check-in lookups by event staff.
-- Assigned on payment_status -> 'paid' rather than at initial insert, since
-- pending/failed registrations shouldn't consume a code.

create sequence if not exists registration_code_seq start 1;

alter table registrations add column if not exists registration_code text unique;

create or replace function set_registration_code()
returns trigger as $$
begin
  if new.payment_status = 'paid' and new.registration_code is null then
    new.registration_code := 'TGCG-' || lpad(nextval('registration_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger registrations_set_registration_code
before insert or update on registrations
for each row execute function set_registration_code();

create index if not exists registrations_registration_code_idx on registrations (registration_code);
