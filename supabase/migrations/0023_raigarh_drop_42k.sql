-- Raigarh 2027 has no full marathon. 0022 was first run on the live
-- database in a version that still copied TGCG 2026's two 42 KM categories;
-- 0022 itself has since been fixed to skip them. This removes them where
-- they already exist (a no-op on a database seeded from the fixed 0022).
--
-- Only deletes categories nobody has registered under — the event is still
-- inactive, so there can't be any; if there somehow were, the NOT EXISTS
-- leaves that row alone instead of failing on the foreign key.

delete from ticket_categories c
using events e
where c.event_id = e.id
  and e.slug = 'raigarh-2027'
  and (c.bib_prefix = '42' or c.name ilike '42 KM%')
  and not exists (select 1 from registrations r where r.ticket_category_id = c.id);

-- Verify: should list only 21K / 10K / 6K / Child Runner.
select c.name, c.price_inr
from ticket_categories c
join events e on e.id = c.event_id
where e.slug = 'raigarh-2027'
order by c.sort_order;
