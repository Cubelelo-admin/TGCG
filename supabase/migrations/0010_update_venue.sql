-- Venue changed from Ekatma Path Park to CBD Square, Naya Raipur (confirmed
-- by organizer 2026-09-14). Full street address + map coordinates for CBD
-- Square are not yet known — venue column updated to the short form only;
-- follow up with a precise address once available.

update events
set venue = 'CBD Square, Naya Raipur'
where slug = 'tgcg-2026';
