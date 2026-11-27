-- Exceptions desk: the two edits staff make at the desk, both logged with a reason.
--
--  kit_swap_size    : change a runner's T-shirt size (registration + the bag's T-shirt
--                     line). Scan state is left alone: at the desk the shirt is swapped
--                     by hand; in an unpacked bag the picker simply scans the new size.
--  kit_desk_collect : hand an expo runner their kit without the bag scan (missing or
--                     incomplete bag, damaged label...). Reason required. Corporate runners
--                     are refused: their kit goes to the company rep on day 0.
-- Safe to re-run.

create or replace function kit_swap_size(p_reg_id uuid, p_size text, p_reason text, p_admin text)
returns jsonb as $$
declare
  v_old text;
  v_event uuid;
  v_name text;
  v_size text := upper(trim(p_size));
begin
  if v_size not in ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL') then
    return jsonb_build_object('ok', false, 'message', 'Invalid size');
  end if;

  select tshirt_size, event_id, full_name into v_old, v_event, v_name
  from registrations where id = p_reg_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Runner not found');
  end if;
  if v_old is null then
    return jsonb_build_object('ok', false, 'message', 'This runner has no T-shirt (child runner)');
  end if;
  if v_old = v_size then
    return jsonb_build_object('ok', false, 'message', 'Already size ' || v_size);
  end if;

  update registrations set tshirt_size = v_size where id = p_reg_id;
  update kit_items set size = v_size where registration_id = p_reg_id and kind = 'tshirt';

  insert into kit_log (event_id, action, detail, actor)
  values (v_event, 'exception', 'size swap ' || v_name || ': ' || v_old || ' -> ' || v_size
    || coalesce(' (' || nullif(trim(p_reason), '') || ')', ''), p_admin);

  return jsonb_build_object('ok', true, 'message', 'Size changed ' || v_old || ' → ' || v_size);
end;
$$ language plpgsql;

create or replace function kit_desk_collect(p_reg_id uuid, p_reason text, p_admin text)
returns jsonb as $$
declare
  v_reg registrations;
  v_box kit_boxes;
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then
    return jsonb_build_object('ok', false, 'message', 'A reason is required');
  end if;

  select * into v_reg from registrations where id = p_reg_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Runner not found');
  end if;
  if v_reg.payment_status <> 'paid' then
    return jsonb_build_object('ok', false, 'message', 'Not paid: mark as paid first');
  end if;
  if v_reg.kit_channel = 'corporate' then
    return jsonb_build_object('ok', false, 'message', 'Corporate runner: the kit goes via the company rep');
  end if;

  select * into v_box from kit_boxes where registration_id = p_reg_id and kind = 'expo_bag' for update;
  if found and v_box.status = 'collected' then
    return jsonb_build_object('ok', false, 'message', 'Already collected');
  end if;

  if found then
    update kit_boxes set status = 'collected', collected_at = now() where id = v_box.id;
  end if;
  update registrations set checked_in = true, checked_in_at = now() where id = p_reg_id;

  insert into kit_log (event_id, box_code, action, detail, actor)
  values (v_reg.event_id, v_box.code, 'exception',
    'desk collect ' || v_reg.full_name || ' (' || trim(p_reason) || ')', p_admin);

  return jsonb_build_object('ok', true, 'message', 'Collected at desk: ' || v_reg.full_name);
end;
$$ language plpgsql;

revoke execute on function kit_swap_size(uuid, text, text, text) from public, anon, authenticated;
grant execute on function kit_swap_size(uuid, text, text, text) to service_role;
revoke execute on function kit_desk_collect(uuid, text, text) from public, anon, authenticated;
grant execute on function kit_desk_collect(uuid, text, text) to service_role;
