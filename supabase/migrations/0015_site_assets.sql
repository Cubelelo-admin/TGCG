-- Admin-uploaded PDFs (Race Information, Rules & FAQ, Race Day Information)
-- linked from the ticket/QR page. Each asset always uploads to the SAME
-- storage path (upsert), so the public URL never changes when the admin
-- replaces the file — the redirect in /api/assets/[id] always points at
-- whatever is currently uploaded.

create table site_assets (
  id text primary key,
  label text not null,
  pdf_path text,
  original_filename text,
  updated_at timestamptz not null default now()
);

insert into site_assets (id, label) values
  ('race-information', 'Race Information'),
  ('rules-faq', 'TGCG Rules, Regulations & FAQ'),
  ('race-day-information', 'Race Day Information')
on conflict (id) do nothing;

alter table site_assets enable row level security;
-- No anon/authenticated policies — only the service-role client (admin
-- upload route, public redirect route) touches this table.

-- Public bucket: these are event-info PDFs meant for any registered
-- attendee to open, not PII, so no signed URLs needed.
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;
  