-- Admin-editable app-wide settings, starting with the WhatsApp group links
-- shown on the ticket page's "Join WhatsApp Group" picker. 6K has three
-- separate groups (one WA group can't hold everyone) — WhatsApp exposes no
-- API to detect a full group, so which one is "active" is a value an admin
-- flips by hand here, not something the app can determine on its own.

create table if not exists app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value) values
  ('wa_group_42_21', null),
  ('wa_group_10', null),
  ('wa_group_6_1', null),
  ('wa_group_6_2', null),
  ('wa_group_6_3', null),
  ('active_6k_wa_group', '1')
on conflict (key) do nothing;
