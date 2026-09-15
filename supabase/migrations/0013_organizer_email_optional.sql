-- The organizer email step was removed from the registration flow — no
-- email is collected at all now. Both columns that used to store it must
-- allow null, or every new registration insert will fail.
alter table registration_groups alter column organizer_email drop not null;
alter table registrations alter column email drop not null;
