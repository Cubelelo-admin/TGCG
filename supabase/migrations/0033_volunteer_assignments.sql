-- Volunteer assignments (docs/volunteer-assignments-design.md, Part 1).
--
-- The admin assigns each desk volunteer a desk and each picker their items in
-- Configuration -> Volunteers, and the server enforces it: the app reads these columns with the
-- role and ignores the desk or items a volunteer's screen sends.
--
-- 1. admin_allowlist.desk: a desk volunteer's desk, a kit_pigeonholes.station such as D1. Only on
--    desk rows. The app checks it against the current event's desks when saving.
-- 2. admin_allowlist.picker_items: a picker's items (bib / tshirt / pack). Only on picker rows.
--    Empty = not assigned yet: the picker can't Start.
-- 3. kit_picker_items_changed(email, items): called when the admin changes a picker's items, changes
--    their role or removes them. Sets kit_pickers.specialties on every event's row, so the next
--    offer follows the new items (an offer already on screen stays). No items left: the picker is
--    paused, an offer on their screen goes back to the queue (as Pause does, 0032), and an accepted
--    task stays theirs to finish.
-- 4. One-off: every picker who is active with no task in hand is paused, so everyone starts again
--    under assigned items. Apply this while nobody is picking.
--
-- No backfill: every desk volunteer and picker starts unassigned. 0025-0032 are not edited.
-- Safe to re-run (a re-run pauses idle active pickers again). Service role only, like every other
-- kit function.

begin;

alter table admin_allowlist add column if not exists desk text;
alter table admin_allowlist add column if not exists picker_items text[] not null default '{}';

alter table admin_allowlist drop constraint if exists admin_allowlist_desk_check;
alter table admin_allowlist
  add constraint admin_allowlist_desk_check
  check (desk is null or (role = 'desk' and length(desk) between 1 and 10));

alter table admin_allowlist drop constraint if exists admin_allowlist_picker_items_check;
alter table admin_allowlist
  add constraint admin_allowlist_picker_items_check
  check (picker_items <@ array['bib', 'tshirt', 'pack']::text[]
         and (role = 'picker' or cardinality(picker_items) = 0));

create or replace function kit_picker_items_changed(p_email text, p_items text[])
returns jsonb as $$
declare
  v_email text := lower(trim(p_email));
  v_items text[] := coalesce(p_items, '{}');
  v_picker kit_pickers;
  v_task kit_tasks;
  v_events uuid[] := '{}';
  v_paused int := 0;
  v_handed_back int := 0;
begin
  if not (v_items <@ array['bib', 'tshirt', 'pack']::text[]) then
    return jsonb_build_object('ok', false, 'message', 'Unknown item');
  end if;

  for v_picker in
    select * from kit_pickers where email = v_email order by id for update
  loop
    if cardinality(v_items) > 0 then
      -- New items apply from the next offer. An offer already on screen stays.
      update kit_pickers set specialties = v_items where id = v_picker.id;
      continue;
    end if;

    -- No items left: paused.
    if v_picker.current_task_id is not null then
      select * into v_task from kit_tasks where id = v_picker.current_task_id for update;
      if found and v_task.picker_id = v_picker.id and v_task.status = 'offered' then
        -- The offer on screen goes back to the queue, as Pause does (0032).
        update kit_tasks
        set status = 'queued', declined_by = declined_by || v_picker.id, declined_at = now(),
            picker_id = null, offered_at = null, offer_expires_at = null
        where id = v_task.id;
        update kit_pickers set current_task_id = null, free_since = now() where id = v_picker.id;
        v_handed_back := v_handed_back + 1;
        v_events := v_events || v_picker.event_id;
      elsif not (found and v_task.picker_id = v_picker.id and v_task.status = 'accepted') then
        -- Stale pointer (task done, cancelled, or no longer theirs): just clear it.
        update kit_pickers set current_task_id = null where id = v_picker.id;
      end if;
      -- An accepted task stays: they finish it, then stay paused.
    end if;
    update kit_pickers set active = false, specialties = '{}' where id = v_picker.id;
    if v_picker.active then v_paused := v_paused + 1; end if;
  end loop;

  -- A handed-back offer can go to another free picker straight away.
  perform kit_dispatch(s.e) from (select distinct unnest(v_events) as e) s;

  return jsonb_build_object('ok', true, 'paused', v_paused, 'handedBack', v_handed_back);
end;
$$ language plpgsql;

-- One-off (point 4 above).
update kit_pickers set active = false where active and current_task_id is null;

do $$
begin
  revoke execute on function kit_picker_items_changed(text, text[]) from public, anon, authenticated;
  grant execute on function kit_picker_items_changed(text, text[]) to service_role;
end $$;

commit;
