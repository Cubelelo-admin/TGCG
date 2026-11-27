-- Raigarh's race booklet PDF, uploaded under Admin → Configuration → Race Assets like Raipur's.
-- Its public link, https://tgcg.vercel.app/api/assets/raigarh-race-information, is the static
-- "Race Booklet & FAQ" button of the Raigarh registration WhatsApp template; until a PDF is uploaded
-- it redirects to /raigarh/race-info (src/app/api/assets/[id]/route.ts).

insert into site_assets (id, label) values
  ('raigarh-race-information', 'Raigarh Race Information (booklet)')
on conflict (id) do nothing;
