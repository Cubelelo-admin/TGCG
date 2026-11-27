-- Normalise text case at the database, so every write path (online sign-up,
-- bulk import, admin edit, anything added later) is covered by one rule, and
-- the same rule backfills existing rows (this also merges "VInay" into "Vinay").
--
--   Proper case : full_name, city (strict: "RAJESH KUMAR" -> "Rajesh Kumar")
--   Proper case, short ALL-CAPS words kept as acronyms (<= 3 letters: IOL, IOB, SBI, HR):
--                 poc_name, organization, running_community, bank_name_location,
--                 kit_group, organizer_full_name
--   UPPER       : bank_ifsc, pan_number, tshirt_size
--   lower       : email, organizer_email
-- Whitespace is trimmed and collapsed everywhere; blank optional fields become null.
-- Safe to re-run.

begin;

create or replace function tgcg_name_case(t text) returns text as $$
  select nullif(initcap(trim(regexp_replace(t, '\s+', ' ', 'g'))), '');
$$ language sql immutable;

create or replace function tgcg_acronym_case(t text) returns text as $$
  select nullif(string_agg(case when w ~ '^[A-Z]{2,3}$' then w else initcap(w) end, ' ' order by ord), '')
  from unnest(regexp_split_to_array(trim(regexp_replace(t, '\s+', ' ', 'g')), ' ')) with ordinality as x(w, ord);
$$ language sql immutable;

create or replace function tgcg_clean_upper(t text) returns text as $$
  select nullif(upper(trim(t)), '');
$$ language sql immutable;

create or replace function registrations_normalize_text() returns trigger as $$
begin
  -- Required columns: never let normalisation turn a value into null.
  new.full_name := coalesce(tgcg_name_case(new.full_name), new.full_name);
  new.city := coalesce(tgcg_name_case(new.city), new.city);
  new.email := coalesce(nullif(lower(trim(new.email)), ''), new.email);
  new.tshirt_size := coalesce(tgcg_clean_upper(new.tshirt_size), new.tshirt_size);

  new.poc_name := tgcg_acronym_case(new.poc_name);
  new.organization := tgcg_acronym_case(new.organization);
  new.running_community := tgcg_acronym_case(new.running_community);
  new.bank_name_location := tgcg_acronym_case(new.bank_name_location);
  new.kit_group := tgcg_acronym_case(new.kit_group);
  new.bank_ifsc := tgcg_clean_upper(new.bank_ifsc);
  new.pan_number := tgcg_clean_upper(new.pan_number);
  return new;
end;
$$ language plpgsql;

drop trigger if exists registrations_normalize_text on registrations;
create trigger registrations_normalize_text
before insert or update on registrations
for each row execute function registrations_normalize_text();

create or replace function registration_groups_normalize_text() returns trigger as $$
begin
  new.organizer_full_name := coalesce(tgcg_acronym_case(new.organizer_full_name), new.organizer_full_name);
  new.organizer_email := coalesce(nullif(lower(trim(new.organizer_email)), ''), new.organizer_email);
  return new;
end;
$$ language plpgsql;

drop trigger if exists registration_groups_normalize_text on registration_groups;
create trigger registration_groups_normalize_text
before insert or update on registration_groups
for each row execute function registration_groups_normalize_text();

-- Backfill: a no-op update re-fires the triggers on every existing row.
update registrations set full_name = full_name;
update registration_groups set organizer_email = organizer_email;

-- Kit tables copy the group label; keep them in step so a merged POC stays one group.
update kit_boxes set kit_group = tgcg_acronym_case(kit_group) where kit_group is not null;
update kit_handovers set kit_group = tgcg_acronym_case(kit_group) where kit_group is not null;

revoke execute on function tgcg_name_case(text), tgcg_acronym_case(text), tgcg_clean_upper(text)
  from public, anon, authenticated;
grant execute on function tgcg_name_case(text), tgcg_acronym_case(text), tgcg_clean_upper(text) to service_role;

commit;
