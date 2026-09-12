-- Keeps ticket_categories.sold_count / addons.sold_count in sync whenever a
-- registration's payment_status transitions into or out of 'paid'. This is
-- the single source of truth for capacity checks in /api/register — both the
-- client-side verify callback and the Razorpay webhook update payment_status
-- via a plain UPDATE, so a trigger is the only place guaranteed to run once
-- per real transition regardless of which path fired.

create or replace function sync_sold_counts()
returns trigger as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    update ticket_categories
      set sold_count = sold_count + 1
      where id = new.ticket_category_id;

    update addons
      set sold_count = sold_count + ra.quantity
      from registration_addons ra
      where addons.id = ra.addon_id
        and ra.registration_id = new.id;

  elsif old.payment_status = 'paid' and new.payment_status is distinct from 'paid' then
    update ticket_categories
      set sold_count = greatest(sold_count - 1, 0)
      where id = new.ticket_category_id;

    update addons
      set sold_count = greatest(addons.sold_count - ra.quantity, 0)
      from registration_addons ra
      where addons.id = ra.addon_id
        and ra.registration_id = new.id;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger registrations_sync_sold_counts
after update on registrations
for each row execute function sync_sold_counts();
