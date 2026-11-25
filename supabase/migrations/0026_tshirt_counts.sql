-- One grouped count instead of nine head-only count queries per dashboard load.
-- Aggregated in Postgres, so it stays exact past PostgREST's 1000-row cap.
-- Child Runner has no T-shirt (tshirt_size is null) and isn't counted.
create or replace function tshirt_counts(p_event_id uuid)
returns table (tshirt_size text, paid_count bigint) as $$
  select r.tshirt_size, count(*)
  from registrations r
  where r.event_id = p_event_id and r.payment_status = 'paid' and r.tshirt_size is not null
  group by r.tshirt_size;
$$ language sql stable;

revoke execute on function tshirt_counts(uuid) from public, anon, authenticated;
grant execute on function tshirt_counts(uuid) to service_role;
