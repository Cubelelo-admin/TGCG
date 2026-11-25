-- Undo box generation for boxes nobody has started packing, so a runner's
-- channel can be changed (expo <-> corporate) and boxes regenerated.
--
-- Only boxes that are still 'open' with ZERO scanned items are deleted (their
-- items go with them). Anything with even one scan, and anything ready/staged/
-- handed over/collected, is never touched. p_poc limits it to one POC group
-- (expo bags of runners with that poc_name + that group's group boxes);
-- null = the whole event. Safe to re-run.

create or replace function kit_reset_unscanned(p_event_id uuid, p_poc text default null, p_admin text default null)
returns jsonb as $$
declare
  v_ids uuid[];
  v_deleted int;
  v_kept int;
begin
  -- Eligible = open and nothing scanned, optionally within one POC group.
  select coalesce(array_agg(b.id), '{}') into v_ids
  from kit_boxes b
  left join registrations r on r.id = b.registration_id
  where b.event_id = p_event_id
    and b.status = 'open'
    and not exists (select 1 from kit_items i where i.box_id = b.id and i.scanned_at is not null)
    and (p_poc is null or r.poc_name = p_poc or b.kit_group = p_poc);

  v_deleted := coalesce(array_length(v_ids, 1), 0);

  select count(*) into v_kept
  from kit_boxes b
  left join registrations r on r.id = b.registration_id
  where b.event_id = p_event_id
    and (p_poc is null or r.poc_name = p_poc or b.kit_group = p_poc)
    and not (b.id = any (v_ids));

  delete from kit_boxes where id = any (v_ids);

  insert into kit_log (event_id, action, detail, actor)
  values (p_event_id, 'reset', v_deleted || ' unscanned boxes removed' || coalesce(' for ' || p_poc, ''), p_admin);

  return jsonb_build_object('ok', true, 'deleted', v_deleted, 'kept', v_kept);
end;
$$ language plpgsql;

revoke execute on function kit_reset_unscanned(uuid, text, text) from public, anon, authenticated;
grant execute on function kit_reset_unscanned(uuid, text, text) to service_role;
