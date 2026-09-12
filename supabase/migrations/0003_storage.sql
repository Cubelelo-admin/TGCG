-- Private storage bucket for government-ID uploads (Aadhar/PAN/etc).
-- No public read access; files are only ever accessed server-side via the
-- service role key (e.g. from the admin dashboard) using short-lived signed URLs.

insert into storage.buckets (id, name, public)
values ('govt-ids', 'govt-ids', false)
on conflict (id) do nothing;

-- No storage.objects policies are created for anon/authenticated roles, so
-- only the service role (server) can read/write into this bucket.
