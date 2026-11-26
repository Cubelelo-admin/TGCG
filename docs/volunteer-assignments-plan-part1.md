# Volunteer assignments, Part 1: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The admin assigns each desk volunteer a desk and each picker their items in Configuration → Volunteers. The server enforces it, and the desk and picker screens show it.

**Architecture:** Migration 0033 adds `desk` and `picker_items` to `admin_allowlist`, plus `kit_picker_items_changed`, which keeps `kit_pickers.specialties` in step. The cached allowlist lookup puts both in the session, so the expo API overrides whatever desk or items a volunteer's screen sends. The desk and picker screens read the assignment from the polls they already make (desk board every 3 s, picker state every 2 s) and show a note when it changes.

**Tech stack:** Next 16.3 (App Router, route handlers), React 19, Tailwind v4 with the Dock design system (`src/components/ds`), Supabase Postgres (plpgsql, service role), zod 4.

**Spec:** `docs/volunteer-assignments-design.md`, sections 2 and 3. Part 2 (section 4: the scan-to-pick task screen, migration 0034) gets its own plan once this ships.

---

## Ground rules: read before Task 1

- **The database is production.** `.env.local` and the dev server (`npm run dev`, localhost:3000) use the production database. Treat it as read-only unless the user approves a write. Writes include: changing an assignment in the Volunteers screen, pressing Start or Pause, accepting a task, creating an order. **Never press Hand over.**
- **Migrations:** 0025–0032 are applied: never edit them. You write `0033`; the user applies it in the Supabase SQL editor. Once applied, 0033 is frozen too: a fix found later goes in a new migration.
- **Commits, pushes, deploys:** only with an explicit yes from the user for that commit or push. A yes doesn't carry over to the next one. Pushing `main` deploys production.
- **Next.js 16.3:** read `node_modules/next/dist/docs/` before using an API you're unsure of. `unstable_cache` is still supported (the previous caching model; `cacheComponents` is off in `next.config.ts`). Its results outlive deployments.
- **No JavaScript test runner** in this repo. SQL logic is tested by a rollback-style script in `supabase/tests/`, which the user runs. TypeScript is checked with `npx tsc --noEmit -p .`, `npx eslint <files>` and `npx next build`, plus the screen checks in Task 10.
- **Environment:** Windows with Git Bash or PowerShell, files are LF, no Python.
- **Order matters:** the user must apply 0033 before you run the dev server with Task 2's change. From Task 2 on, every request reads the new columns; without them the lookup fails and every login is refused (on your machine only, but it blocks testing).

## File map

| File | Responsibility | Task |
|---|---|---|
| `supabase/migrations/0033_volunteer_assignments.sql` | Create: columns, constraints, `kit_picker_items_changed`, one-off pause | 1 |
| `supabase/tests/0033_volunteer_assignments_test.sql` | Create: rollback test for 0033 | 1 |
| `src/lib/admin-auth.ts` | Session carries `desk` and `items` | 2 |
| `src/lib/expo.ts` | `DeskOrder` carries its `station` | 3 |
| `src/app/api/admin/volunteers/route.ts` | Saves desk / items; keeps the picker in step | 4 |
| `src/app/admin/(protected)/assets/page.tsx` | Loads desk / items and the event's desks | 5 |
| `src/app/admin/(protected)/assets/VolunteersCard.tsx` | "Desk or items" column and add form | 5 |
| `src/app/api/admin/kit/expo/route.ts` | Enforces the desk and the items | 6 |
| `src/app/admin/(protected)/kit/AssignmentNote.tsx` | Create: the note shown when an assignment changes or is missing | 7 |
| `src/app/admin/(protected)/kit/picker/PickerStation.tsx` | Read-only items for volunteers, notes, overflow line | 8 |
| `src/app/admin/(protected)/kit/desk/DeskStation.tsx` | Fixed desk for volunteers, no-desk screen, notes | 9 |
| `src/app/v/VolunteerApp.tsx`, `src/app/v/page.tsx` | Pass the assigned desk; header shows it | 9 |

Commit points: after Task 1 (SQL), after Task 6 (server), after Task 9 (screens). Each needs the user's yes.

---

### Task 1: Migration 0033 and its test

**Files:**
- Create: `supabase/migrations/0033_volunteer_assignments.sql`
- Create: `supabase/tests/0033_volunteer_assignments_test.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0033_volunteer_assignments.sql`:

```sql
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
```

- [ ] **Step 2: Write the test**

`supabase/tests/0033_volunteer_assignments_test.sql`:

```sql
-- Test script for 0033_volunteer_assignments.sql. Run AFTER the migration, in the
-- Supabase SQL editor.
--
-- It checks:
--   - admin_allowlist keeps a desk only on a desk row and items only on a picker row, and refuses
--     an unknown item or an over-long desk name
--   - kit_picker_items_changed with items left: specialties follow on every event's row and the
--     picker stays active
--   - with no items left: the picker is paused and an offer on their screen goes back to the queue
--   - with no items left: an accepted task stays theirs, and they're paused
--   - an unknown item is refused; an email with no picker rows is fine
-- It uses one test order for a real paid expo runner at a test desk (TST), test pickers and a test
-- allowlist email (@test.local). Then it RAISES AN ERROR ON PURPOSE: the error message is the
-- test report, and raising it rolls back every change (no order, pigeonhole, picker, task or
-- allowlist row is left behind). The order-number sequence skips a number.
--
-- Expected output: an error that starts with "TEST REPORT: 0 failed". Paste it back to Claude.
-- Run it while no real picker is active and no order is being picked.

create or replace function pg_temp.chk(p_name text, p_ok boolean, p_detail jsonb default null)
returns text language sql as $$
  select E'\n' || case when coalesce(p_ok, false) then 'PASS ' else 'FAIL ' end || p_name
    || case when coalesce(p_ok, false) then '' else '  ' || coalesce(p_detail::text, '(no detail)') end
$$;

-- Where a task is now: {"status": ..., "picker": email or null}.
create or replace function pg_temp.where_is(p_task uuid)
returns jsonb language sql as $$
  select jsonb_build_object('status', k.status, 'picker', p.email)
  from kit_tasks k left join kit_pickers p on p.id = k.picker_id where k.id = p_task
$$;

-- A test picker's row on one event, as JSON (for failure details).
create or replace function pg_temp.picker(p_event uuid, p_email text)
returns jsonb language sql as $$
  select to_jsonb(p) from kit_pickers p where p.event_id = p_event and p.email = p_email
$$;

-- True when admin_allowlist refuses this row with a check constraint. The row is never kept.
create or replace function pg_temp.refused(p_role text, p_desk text, p_items text[])
returns boolean language plpgsql as $$
begin
  insert into admin_allowlist (email, role, desk, picker_items)
  values ('assign-check@test.local', p_role, p_desk, p_items);
  delete from admin_allowlist where email = 'assign-check@test.local';
  return false;
exception when check_violation then
  return true;
end $$;

do $$
declare
  ev uuid;
  ev2 uuid;
  a uuid;
  res jsonb;
  o_a uuid;
  v_ts uuid;
  w jsonb;
  out text := '';
  fails int;
begin
  -- 1. Constraints on admin_allowlist
  out := out || pg_temp.chk('desk volunteer with a desk accepted', not pg_temp.refused('desk', 'D1', '{}'));
  out := out || pg_temp.chk('picker with items accepted', not pg_temp.refused('picker', null, array['bib', 'pack']));
  out := out || pg_temp.chk('handover with nothing assigned accepted', not pg_temp.refused('handover', null, '{}'));
  out := out || pg_temp.chk('desk on a picker row refused', pg_temp.refused('picker', 'D1', array['bib']));
  out := out || pg_temp.chk('items on a desk row refused', pg_temp.refused('desk', 'D1', array['bib']));
  out := out || pg_temp.chk('desk on a restock row refused', pg_temp.refused('restock', 'D1', '{}'));
  out := out || pg_temp.chk('unknown item refused', pg_temp.refused('picker', null, array['bag']));
  out := out || pg_temp.chk('desk name over 10 characters refused', pg_temp.refused('desk', 'DESK-NUMBER-1', '{}'));

  -- 2. One paid expo runner with a T-shirt, not collected, not in an order; a quiet floor
  select r.id into a from registrations r
  where r.payment_status = 'paid' and r.kit_channel = 'expo' and r.tshirt_size is not null
    and kit_order_blocker(r.id) is null
  order by r.created_at limit 1;
  if a is null then
    raise exception 'TEST REPORT: cannot run, no eligible expo runner';
  end if;
  select event_id into ev from registrations where id = a;
  if exists (select 1 from kit_pickers where event_id = ev and active) then
    raise exception 'TEST REPORT: cannot run, a picker is active (pause everyone first)';
  end if;
  if exists (select 1 from kit_tasks k join kit_orders o on o.id = k.order_id
             where o.event_id = ev and k.status in ('queued', 'offered', 'accepted')) then
    raise exception 'TEST REPORT: cannot run, an order is being picked (finish or cancel it first)';
  end if;
  perform kit_seed_pigeonholes(ev, array['TST'], 1, 1);

  -- 3. Items changed, some left: specialties follow on every event's row; still active
  select id into ev2 from events where id <> ev order by id limit 1;
  if ev2 is not null then
    insert into kit_pickers (event_id, email, name) values (ev2, 'p1@test.local', 'P1');
  end if;
  perform kit_picker_set_active(ev, 'p1@test.local', 'P1', true, array['bib', 'tshirt', 'pack']);
  res := kit_picker_items_changed(' P1@Test.Local ', array['pack']);
  out := out || pg_temp.chk('items change accepted (email case and spaces ignored)', (res->>'ok')::boolean, res);
  out := out || pg_temp.chk('new items on this event''s row, picker still active',
    (select specialties = array['pack'] and active from kit_pickers where event_id = ev and email = 'p1@test.local'),
    pg_temp.picker(ev, 'p1@test.local'));
  out := out || pg_temp.chk('new items on the other event''s row too',
    ev2 is null or (select specialties = array['pack'] from kit_pickers where event_id = ev2 and email = 'p1@test.local'),
    pg_temp.picker(ev2, 'p1@test.local'));
  perform kit_picker_set_active(ev, 'p1@test.local', 'P1', false, null);

  -- 4. No items left with an offer on screen: the offer goes back to the queue, picker paused
  perform kit_picker_set_active(ev, 'p2@test.local', 'P2', true, array['tshirt']);
  res := kit_create_order(ev, array[a], 'TST', 'test');
  out := out || pg_temp.chk('test order created', (res->>'ok')::boolean, res);
  o_a := (res->>'orderId')::uuid;
  select id into v_ts from kit_tasks where order_id = o_a and kind = 'tshirt';
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('T-shirt task offered to P2', w = '{"status":"offered","picker":"p2@test.local"}', w);

  res := kit_picker_items_changed('p2@test.local', '{}');
  out := out || pg_temp.chk('items removed: one offer handed back', (res->>'ok')::boolean and (res->>'handedBack')::int = 1, res);
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('the offer went back to the queue', w->>'status' = 'queued', w);
  out := out || pg_temp.chk('counted as turned down by P2 (60 s break)',
    (select k.declined_at is not null and p.id = any (k.declined_by)
     from kit_tasks k, kit_pickers p
     where k.id = v_ts and p.event_id = ev and p.email = 'p2@test.local'), null);
  out := out || pg_temp.chk('P2 paused, no task, no items',
    (select not active and current_task_id is null and specialties = '{}'
     from kit_pickers where event_id = ev and email = 'p2@test.local'),
    pg_temp.picker(ev, 'p2@test.local'));

  -- 5. No items left with an accepted task: it stays theirs; they're paused
  perform kit_picker_set_active(ev, 'p3@test.local', 'P3', true, array['tshirt']);
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('T-shirt task offered to P3', w = '{"status":"offered","picker":"p3@test.local"}', w);
  res := kit_accept_task(v_ts, 'p3@test.local');
  out := out || pg_temp.chk('P3 accepts', (res->>'ok')::boolean, res);
  res := kit_picker_items_changed('p3@test.local', '{}');
  out := out || pg_temp.chk('items removed mid-task: nothing handed back', (res->>'ok')::boolean and (res->>'handedBack')::int = 0, res);
  w := pg_temp.where_is(v_ts);
  out := out || pg_temp.chk('accepted task still P3''s', w = '{"status":"accepted","picker":"p3@test.local"}', w);
  out := out || pg_temp.chk('P3 paused but still holds the task',
    (select not active and current_task_id = v_ts from kit_pickers where event_id = ev and email = 'p3@test.local'),
    pg_temp.picker(ev, 'p3@test.local'));

  -- 6. Unknown item refused, nothing changed
  res := kit_picker_items_changed('p1@test.local', array['bag']);
  out := out || pg_temp.chk('unknown item refused', not (res->>'ok')::boolean, res);
  out := out || pg_temp.chk('P1 items unchanged after the refusal',
    (select specialties = array['pack'] from kit_pickers where event_id = ev and email = 'p1@test.local'),
    pg_temp.picker(ev, 'p1@test.local'));

  -- 7. An email that never picked: nothing to change, still ok
  res := kit_picker_items_changed('nobody@test.local', array['bib']);
  out := out || pg_temp.chk('email with no picker rows: ok, nobody paused',
    (res->>'ok')::boolean and (res->>'paused')::int = 0, res);

  fails := (length(out) - length(replace(out, E'\nFAIL ', ''))) / length(E'\nFAIL ');
  raise exception 'TEST REPORT: % failed (everything rolled back)%', fails, out;
end $$;
```

- [ ] **Step 3: Check that only the two new files changed under `supabase/`**

Run: `git status --short supabase/`
Expected: exactly
```
?? supabase/migrations/0033_volunteer_assignments.sql
?? supabase/tests/0033_volunteer_assignments_test.sql
```

- [ ] **Step 4: Hand over to the user and wait**

Tell the user: "Please apply `supabase/migrations/0033_volunteer_assignments.sql` in the Supabase SQL editor while nobody is picking. Then run `supabase/tests/0033_volunteer_assignments_test.sql` and paste the error it raises."
Expected report: `TEST REPORT: 0 failed (everything rolled back)` followed by 25 PASS lines.
If a line FAILs: find the cause. If it's in the test, fix the test and ask the user to run it again. If it's in the migration, 0033 is now applied and frozen: write the fix as a new migration (0034, which moves Part 2 to 0035), with the test updated to match. Don't start Task 2 until the report says 0 failed.

- [ ] **Step 5: Commit (ask the user first)**

Ask: "OK to commit the 0033 migration and its test?" Only on a yes:
```bash
git add supabase/migrations/0033_volunteer_assignments.sql supabase/tests/0033_volunteer_assignments_test.sql
git commit -m "Volunteer assignments 0033: desk and picker items on the allowlist" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The session carries the assignment

**Files:**
- Modify: `src/lib/admin-auth.ts` (whole file below)

- [ ] **Step 1: Replace `src/lib/admin-auth.ts` with:**

```ts
import "server-only";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";
import type { ExpoKind } from "@/lib/expo";

/**
 * admin_allowlist.role (0030, widened in 0031). 'admin' is the full dashboard. Every other
 * role is a volunteer: they only use the volunteer app (/v), which shows the screen for their
 * role, and only that screen's API actions. Never runner contact details or the registrations list.
 */
export type AdminRole = "admin" | "desk" | "picker" | "handover" | "restock";
export type VolunteerRole = Exclude<AdminRole, "admin">;
export const VOLUNTEER_ROLES: readonly VolunteerRole[] = ["desk", "picker", "handover", "restock"];
const ROLES: readonly AdminRole[] = ["admin", ...VOLUNTEER_ROLES];
/** Picker items an admin can assign (0033), in the order screens list them. */
const PICKER_ITEMS: readonly ExpoKind[] = ["bib", "tshirt", "pack"];

/** The volunteer app: one URL, the role decides the screen. */
export const VOLUNTEER_HOME = "/v";

export interface AdminSession {
  email: string;
  /** Name from the Google profile, when the token carries one. */
  name: string | null;
  /** null = signed in but not on the allowlist. */
  role: AdminRole | null;
  /** Desk volunteers: the desk the admin assigned (0033), e.g. "D1". null = none yet, or not a desk volunteer. */
  desk: string | null;
  /** Pickers: the items the admin assigned (0033). Empty = none yet, or not a picker. */
  items: ExpoKind[];
  /**
   * Full admin (role 'admin'). Every pre-role check in the app reads this, so volunteers
   * are kept out of everything that existed before roles.
   */
  authorized: boolean;
}

interface AllowlistEntry {
  role: AdminRole | null;
  desk: string | null;
  items: ExpoKind[];
}
const NOT_LISTED: AllowlistEntry = { role: null, desk: null, items: [] };

// admin_allowlist changes rarely — every admin navigation was paying for a fresh
// Postgres round trip just to re-check the same email. The short revalidate window
// trades up to a minute of staleness for cutting this off every page load; the
// Volunteers screen clears the tag on every change, so its edits apply at once.
// The key is new since 0033 added desk and items: this cache outlives deployments,
// and an entry under the old key holds only the role.
const allowlistEntry = unstable_cache(
  async (email: string): Promise<AllowlistEntry> => {
    const service = createServiceClient();
    const { data, error } = await service
      .from("admin_allowlist")
      .select("role, desk, picker_items")
      .eq("email", email)
      .maybeSingle();
    if (error) {
      console.error("admin_allowlist lookup failed", error);
      return NOT_LISTED;
    }
    if (!data) return NOT_LISTED;
    // Unknown value (should be impossible: check constraint) = least privilege.
    if (!ROLES.includes(data.role as AdminRole)) return NOT_LISTED;
    const role = data.role as AdminRole;
    const stored = (data.picker_items ?? []) as string[];
    return {
      role,
      desk: role === "desk" ? ((data.desk as string | null) ?? null) : null,
      items: role === "picker" ? PICKER_ITEMS.filter((k) => stored.includes(k)) : [],
    };
  },
  ["admin-allowlist-entry"],
  { revalidate: 60, tags: ["admin-allowlist"] }
);

/**
 * Returns the current Supabase Auth session (if any) plus the email's allowlist role and
 * assignment. Check `authorized` (full admin) or use the require* helpers below before touching
 * any PII in admin route handlers / server components.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const authClient = await createServerAuthClient();
  // Local JWT verification: no Auth-server round trip per request (see middleware-client.ts).
  const { data } = await authClient.auth.getClaims();
  const claims = data?.claims;
  const email = typeof claims?.email === "string" ? claims.email : null;
  if (!email) return null;

  const meta = (claims?.user_metadata ?? {}) as Record<string, unknown>;
  const rawName = meta.full_name ?? meta.name;
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : null;

  const entry = await allowlistEntry(email.toLowerCase());
  return { email, name, role: entry.role, desk: entry.desk, items: entry.items, authorized: entry.role === "admin" };
}

export function isVolunteer(role: AdminRole | null): role is VolunteerRole {
  return role !== null && role !== "admin";
}

/**
 * Page guard for full-admin screens. Call it at the top of every page under (protected):
 * the layout's check alone does not stop a page from rendering into the RSC payload
 * (Next 16 docs, "Layouts and auth checks"). Volunteers are sent to the volunteer app.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (isVolunteer(session.role)) redirect(VOLUNTEER_HOME);
  if (session.role !== "admin") redirect("/admin/denied");
  return session;
}

/** Page guard for the volunteer app: any volunteer role, or an admin (supervising / testing). */
export async function requireVolunteerApp(): Promise<AdminSession & { role: AdminRole }> {
  const session = await getAdminSession();
  if (!session) redirect("/v/login");
  if (!session.role) redirect("/v/denied");
  return session as AdminSession & { role: AdminRole };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no output (exit 0). Nothing else builds an `AdminSession` by hand (checked: no other `authorized:` in `src`).

---

### Task 3: A desk order carries its desk

**Files:**
- Modify: `src/lib/expo.ts` (`DeskOrder`, `OrderRow`, `ORDER_COLS`, `toDeskOrder`)

- [ ] **Step 1: Add `station` to `DeskOrder`**

Find:
```ts
export interface DeskOrder {
  id: string;
  code: string;
  status: OrderStatus;
```
Replace with:
```ts
export interface DeskOrder {
  id: string;
  code: string;
  /** The desk (pigeonhole station) the order belongs to, e.g. D1. */
  station: string;
  status: OrderStatus;
```

- [ ] **Step 2: Add `station` to `OrderRow` and the selected columns**

Find:
```ts
type OrderRow = {
  id: string;
  code: string;
  status: OrderStatus;
```
Replace with:
```ts
type OrderRow = {
  id: string;
  code: string;
  station: string;
  status: OrderStatus;
```
Find:
```ts
const ORDER_COLS =
  "id, code, status, created_at,
```
Replace with:
```ts
const ORDER_COLS =
  "id, code, station, status, created_at,
```
(Only the start of that string changes; leave the rest of the line as it is.)

- [ ] **Step 3: Fill it in `toDeskOrder`**

Find:
```ts
  return {
    id: o.id,
    code: o.code,
    status: o.status,
```
Replace with:
```ts
  return {
    id: o.id,
    code: o.code,
    station: o.station,
    status: o.status,
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no output. (`CancelModal` takes `Pick<DeskOrder, "id" | "code">`, so the floor board is unaffected.)

---

### Task 4: The Volunteers API saves desks and items

**Files:**
- Modify: `src/app/api/admin/volunteers/route.ts` (whole file below)

- [ ] **Step 1: Replace the file with:**

```ts
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminEvent } from "@/lib/admin-event";
import { listStations, type ExpoKind } from "@/lib/expo";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/*
 * Volunteers on admin_allowlist (desk | picker | handover | restock, 0031) and what the admin assigns
 * them (0033): a desk volunteer's desk, a picker's items. Full admins only. Admin rows are never
 * created, changed or removed here, so nobody can lock an organiser out from the UI; promoting
 * someone to admin stays a deliberate SQL change.
 *
 * `set` keeps a desk only on a desk row and items only on a picker row: a role change clears the
 * other. A desk or items left out of the request keep their value while the role stays the same.
 */

const ITEMS: readonly ExpoKind[] = ["bib", "tshirt", "pack"];
const email = z.string().trim().toLowerCase().email("Enter a valid email").max(200);
const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set"),
    email,
    role: z.enum(["desk", "picker", "handover", "restock"]),
    desk: z.string().trim().min(1).max(10).nullable().optional(),
    items: z.array(z.enum(["bib", "tshirt", "pack"])).max(3).optional(),
  }),
  z.object({ action: z.literal("remove"), email }),
]);

type Existing = { role: string; desk: string | null; picker_items: string[] | null };
type Service = ReturnType<typeof createServiceClient>;

/** Brings a picker's kit_pickers rows in line with their items (0033). No items = paused. */
async function syncPicker(supabase: Service, address: string, items: ExpoKind[]): Promise<boolean> {
  const { error } = await supabase.rpc("kit_picker_items_changed", { p_email: address, p_items: items });
  if (error) console.error("kit_picker_items_changed failed", error);
  return !error;
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session?.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const body = parsed.data;
  const supabase = createServiceClient();

  const { data, error: readError } = await supabase
    .from("admin_allowlist")
    .select("role, desk, picker_items")
    .eq("email", body.email)
    .maybeSingle();
  if (readError) {
    console.error("volunteers read failed", readError);
    return NextResponse.json({ error: "Could not read the allowlist" }, { status: 500 });
  }
  const existing = data as Existing | null;
  if (existing?.role === "admin") {
    return NextResponse.json({ error: `${body.email} is an admin; admins can't be changed here` }, { status: 409 });
  }
  const wasPicker = existing?.role === "picker";

  if (body.action === "set") {
    const sameRole = existing?.role === body.role;
    const desk =
      body.role !== "desk" ? null : body.desk !== undefined ? body.desk : sameRole ? (existing?.desk ?? null) : null;
    const wanted: readonly string[] =
      body.role !== "picker" ? [] : body.items !== undefined ? body.items : sameRole ? (existing?.picker_items ?? []) : [];
    const items = ITEMS.filter((k) => wanted.includes(k));

    // A newly chosen desk must be one of the current event's desks (kit_pigeonholes stations).
    if (body.role === "desk" && body.desk) {
      const { event } = await getAdminEvent();
      const stations = event ? await listStations(event.id) : [];
      if (!stations.includes(body.desk)) {
        return NextResponse.json({ error: `Desk ${body.desk} isn't set up for this event` }, { status: 400 });
      }
    }

    const { error } = await supabase
      .from("admin_allowlist")
      .upsert({ email: body.email, role: body.role, desk, picker_items: items });
    if (error) {
      console.error("volunteers upsert failed", error);
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    }

    // Their phone follows at once: the next offer uses the new items; none left = paused.
    if ((wasPicker || body.role === "picker") && !(await syncPicker(supabase, body.email, items))) {
      revalidateTag("admin-allowlist", { expire: 0 });
      return NextResponse.json({ error: "Saved, but the picker's screen wasn't updated: save it again" }, { status: 500 });
    }
  } else {
    if (!existing) return NextResponse.json({ ok: true });
    const { error } = await supabase.from("admin_allowlist").delete().eq("email", body.email).neq("role", "admin");
    if (error) {
      console.error("volunteers delete failed", error);
      return NextResponse.json({ error: "Remove failed" }, { status: 500 });
    }
    // A removed picker is paused; an offer on their screen goes to someone else.
    if (wasPicker) await syncPicker(supabase, body.email, []);
  }

  // Drop the cached role and assignment now (not after up to 60 s), so a change reaches the
  // volunteer on their next request and a removal locks them out.
  revalidateTag("admin-allowlist", { expire: 0 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit -p .` then `npx eslint src/app/api/admin/volunteers/route.ts`
Expected: no output from either.

---

### Task 5: Configuration → Volunteers screen

**Files:**
- Modify: `src/app/admin/(protected)/assets/page.tsx` (imports, `VolunteersTab`)
- Modify: `src/app/admin/(protected)/assets/VolunteersCard.tsx` (whole file below)

- [ ] **Step 1: Load desks and items in `page.tsx`**

Find:
```ts
import { createServiceClient } from "@/lib/supabase/server";
import type { IconName } from "@/components/ds";
```
Replace with:
```ts
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminEvent } from "@/lib/admin-event";
import { listStations } from "@/lib/expo";
import type { IconName } from "@/components/ds";
```
Replace the whole `VolunteersTab` function with:
```tsx
async function VolunteersTab() {
  const [{ data, error }, { event }] = await Promise.all([
    createServiceClient()
      .from("admin_allowlist")
      .select("email, role, added_at, desk, picker_items")
      .order("added_at", { ascending: true }),
    getAdminEvent(),
  ]);
  if (error) {
    console.error("volunteers load failed", error);
    return (
      <Banner tone="danger" title="Could not load volunteers">
        Refresh the page; if it keeps failing, check the server logs.
      </Banner>
    );
  }
  // The desks a desk volunteer can be given: this event's pigeonhole stations.
  const stations = event ? await listStations(event.id) : [];
  const rows = (data ?? []) as {
    email: string;
    role: string;
    added_at: string;
    desk: string | null;
    picker_items: string[] | null;
  }[];
  const volunteers: Volunteer[] = rows
    .filter((r) => (VOLUNTEER_ROLES as readonly string[]).includes(r.role))
    .map((r) => ({
      email: r.email,
      role: r.role as Volunteer["role"],
      addedAt: r.added_at,
      desk: r.desk,
      items: (r.picker_items ?? []) as Volunteer["items"],
    }));
  return (
    <VolunteersCard
      volunteers={volunteers}
      stations={stations}
      adminCount={rows.filter((r) => r.role === "admin").length}
    />
  );
}
```

- [ ] **Step 2: Replace `VolunteersCard.tsx` with:**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banner,
  Button,
  Card,
  DataTable,
  EmptyState,
  FieldLabel,
  Select,
  StatusPill,
  TextField,
  type ColumnDef,
  type StatusTone,
} from "@/components/ds";
import type { VolunteerRole } from "@/lib/admin-auth";
import type { ExpoKind } from "@/lib/expo";

export type { VolunteerRole };
export type Volunteer = {
  email: string;
  role: VolunteerRole;
  addedAt: string;
  /** Desk volunteers: the desk assigned to them (0033). */
  desk: string | null;
  /** Pickers: the items assigned to them (0033). */
  items: ExpoKind[];
};

const ROLE_OPTIONS: { value: VolunteerRole; label: string }[] = [
  { value: "desk", label: "Desk (collection desk)" },
  { value: "picker", label: "Picker (warehouse)" },
  { value: "handover", label: "Handover (corporate boxes)" },
  { value: "restock", label: "Restock (refills bins)" },
];
const ROLE_LABEL: Record<VolunteerRole, string> = { desk: "Desk", picker: "Picker", handover: "Handover", restock: "Restock" };
const ROLE_TONE: Record<VolunteerRole, StatusTone> = { desk: "info", picker: "warning", handover: "active", restock: "pending" };
const ITEMS: ExpoKind[] = ["bib", "tshirt", "pack"];
const ITEM_LABEL: Record<ExpoKind, string> = { bib: "BIB", tshirt: "T-shirt", pack: "Pack" };

type Body =
  | { action: "set"; email: string; role: VolunteerRole; desk?: string | null; items?: ExpoKind[] }
  | { action: "remove"; email: string };

async function post(body: Body): Promise<string | null> {
  try {
    const res = await fetch("/api/admin/volunteers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return json.error ?? "Save failed";
  } catch {
    return "No connection: try again";
  }
}

/** Turns one item on or off, keeping the BIB, T-shirt, Pack order. */
function toggle(items: ExpoKind[], k: ExpoKind): ExpoKind[] {
  return items.includes(k) ? items.filter((x) => x !== k) : ITEMS.filter((x) => x === k || items.includes(x));
}

/** "Not assigned" plus this event's desks. A stored desk that isn't one of them stays listed, marked. */
function deskOptions(stations: string[], current: string | null) {
  const extra = current && !stations.includes(current) ? [{ value: current, label: `${current} (not set up)` }] : [];
  return [{ value: "", label: "Not assigned" }, ...stations.map((s) => ({ value: s, label: `Desk ${s}` })), ...extra];
}

/** BIB / T-shirt / Pack toggles: the look of the DS FilterChip, which has no disabled state. */
function ItemChips({
  items,
  disabled,
  onToggle,
}: {
  items: ExpoKind[];
  disabled: boolean;
  onToggle: (k: ExpoKind) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ITEMS.map((k) => {
        const on = items.includes(k);
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(k)}
            className={`inline-flex h-7 items-center rounded-full px-3 text-12 disabled:cursor-not-allowed disabled:opacity-50 ${
              on ? "bg-dark text-white" : "bg-line-secondary text-ink hover:bg-line"
            }`}
          >
            {on && "✓ "}
            {ITEM_LABEL[k]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Volunteers: Google emails with a volunteer role, and the desk or items assigned to them. They
 * use the volunteer app (/v), which shows the screen for their role; a change here reaches their
 * phone within a few seconds. No runner contact details, no registrations list.
 */
export default function VolunteersCard({
  volunteers,
  stations,
  adminCount,
}: {
  volunteers: Volunteer[];
  /** The current event's desks (pigeonhole stations). */
  stations: string[];
  adminCount: number;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<VolunteerRole>("picker");
  const [desk, setDesk] = useState("");
  const [items, setItems] = useState<ExpoKind[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, body: Body, after?: () => void) {
    setBusy(key);
    setError(null);
    const err = await post(body);
    setBusy(null);
    if (err) {
      setError(err);
      return;
    }
    after?.();
    router.refresh();
  }

  function assignment(v: Volunteer) {
    if (v.role === "desk") {
      return (
        <Select
          ariaLabel={`Desk for ${v.email}`}
          options={deskOptions(stations, v.desk)}
          value={v.desk ?? ""}
          disabled={busy !== null}
          width={150}
          onChange={(next) => {
            if (next !== (v.desk ?? "")) {
              void run(`desk:${v.email}`, { action: "set", email: v.email, role: "desk", desk: next || null });
            }
          }}
        />
      );
    }
    if (v.role === "picker") {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <ItemChips
            items={v.items}
            disabled={busy !== null}
            onToggle={(k) =>
              void run(`items:${v.email}`, { action: "set", email: v.email, role: "picker", items: toggle(v.items, k) })
            }
          />
          {v.items.length === 0 && <StatusPill tone="warning">Not assigned</StatusPill>}
        </div>
      );
    }
    return <span className="text-12 text-ink-muted">Not needed</span>;
  }

  const columns: ColumnDef<Volunteer>[] = [
    { key: "email", header: "Google email", render: (v) => <span className="break-all">{v.email}</span> },
    {
      key: "role",
      header: "Role",
      render: (v) => <StatusPill tone={ROLE_TONE[v.role]}>{ROLE_LABEL[v.role]}</StatusPill>,
    },
    { key: "assignment", header: "Desk or items", render: assignment },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (v) => {
        return (
          <div className="flex items-center justify-end gap-2">
            <Select
              ariaLabel={`Role for ${v.email}`}
              options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: ROLE_LABEL[o.value] }))}
              value={v.role}
              disabled={busy !== null}
              width={140}
              onChange={(next) => {
                if (next !== v.role) void run(`role:${v.email}`, { action: "set", email: v.email, role: next as VolunteerRole });
              }}
            />
            <Button
              size="sm"
              variant="red"
              disabled={busy !== null}
              onClick={() => {
                if (window.confirm(`Remove ${v.email}? They lose access within a few seconds.`)) {
                  void run(`rm:${v.email}`, { action: "remove", email: v.email });
                }
              }}
            >
              Remove
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <Card title="Volunteers" className="max-w-4xl">
      <p className="-mt-2 mb-4 text-14 text-ink-tertiary">
        Volunteers open <span className="font-medium text-ink">/v</span> on their phone (installable as an app) and see
        the screen for their role. Desk volunteers work at the desk you assign; pickers get tasks for the items you
        assign, plus anything waiting over 90 s. Desk sees runner name, BIB and size; pickers see items, sizes, BIBs
        and crates; handover sees company groups and box codes; restock sees empty bins. Nobody sees phone numbers,
        emails or the registrations list. {adminCount} admin{adminCount === 1 ? "" : "s"} not shown (admins are managed
        in the database).
      </p>

      <form
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            "add",
            {
              action: "set",
              email,
              role,
              ...(role === "desk" ? { desk: desk || null } : {}),
              ...(role === "picker" ? { items } : {}),
            },
            () => {
              setEmail("");
              setDesk("");
              setItems([]);
            }
          );
        }}
      >
        <div className="min-w-0 flex-1">
          <TextField
            label="Google email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="volunteer@gmail.com"
          />
        </div>
        <Select
          label="Role"
          options={ROLE_OPTIONS}
          value={role}
          onChange={(v) => {
            setRole(v as VolunteerRole);
            setDesk("");
            setItems([]);
          }}
          width={240}
        />
        {role === "desk" && (
          <Select label="Desk" options={deskOptions(stations, null)} value={desk} onChange={setDesk} width={150} />
        )}
        {role === "picker" && (
          <div>
            <FieldLabel label="Items" />
            <div className="flex h-9 items-center">
              <ItemChips items={items} disabled={busy !== null} onToggle={(k) => setItems((cur) => toggle(cur, k))} />
            </div>
          </div>
        )}
        <Button type="submit" variant="dark" disabled={busy !== null || !email.trim()}>
          {busy === "add" ? "Adding…" : "Add volunteer"}
        </Button>
      </form>

      {error && (
        <div className="mb-4">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={volunteers}
        rowKey={(v) => v.email}
        minWidth={0}
        empty={<EmptyState title="No volunteers yet" />}
      />
    </Card>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit -p .` then `npx eslint "src/app/admin/(protected)/assets/page.tsx" "src/app/admin/(protected)/assets/VolunteersCard.tsx"`
Expected: no output from either.

- [ ] **Step 4: Look at it (read-only)**

Only once the user has applied 0033 (Task 1). Run `npm run dev`, sign in as an admin, and open `http://localhost:3000/admin/assets?tab=volunteers`.
Expected: a "Desk or items" column. Each desk volunteer has a select reading "Not assigned"; each picker has three chips and a "Not assigned" label; handover and restock rows say "Not needed". In the add form, choosing Desk or Picker shows the matching control.
**Don't change anything on this screen:** it writes to production. Leave assigning to the user (Task 10).

---

### Task 6: The expo API enforces the desk and the items

**Files:**
- Modify: `src/app/api/admin/kit/expo/route.ts`

- [ ] **Step 1: Update the header comment**

Find:
```ts
 * Cancel, floor board and release: admins only (support / supervisor). The picker / restocker is always the signed-in email;
 * it is never taken from the request body.
 */
```
Replace with:
```ts
 * Cancel, floor board and release: admins only (support / supervisor). The picker / restocker is always the signed-in email;
 * it is never taken from the request body.
 * Assignments (0033): a desk volunteer works at the desk the admin assigned, and a picker on the items the admin assigned;
 * the station or specialties their screen sends are ignored. Admins are not restricted.
 */

const NO_DESK = "No desk assigned yet: ask the supervisor";
```

- [ ] **Step 2: Make `specialties` optional (only admins send it now)**

Find:
```ts
  z.object({ action: z.literal("set-active"), eventId, active: z.boolean(), specialties: z.array(kind).min(1).max(3) }),
```
Replace with:
```ts
  z.object({ action: z.literal("set-active"), eventId, active: z.boolean(), specialties: z.array(kind).min(1).max(3).optional() }),
```

- [ ] **Step 3: Add the desk check helper**

Find:
```ts
  const supabase = createServiceClient();
  const email = session.email.toLowerCase();
```
Replace with:
```ts
  const supabase = createServiceClient();
  const email = session.email.toLowerCase();
  const role = session.role;
  const myDesk = session.desk;

  /** Desk volunteers see and hand over only their own desk's orders (0033). Returns the refusal, or null. */
  function otherDesk(order: { code: string; station: string }): string | null {
    if (role !== "desk") return null;
    if (!myDesk) return NO_DESK;
    return order.station === myDesk ? null : `${order.code} is at desk ${order.station}: send the runner there`;
  }
```

- [ ] **Step 4: `desk-board` uses the assigned desk**

Find:
```ts
    case "desk-board":
      await dispatch(body.eventId);
      return NextResponse.json({ ok: true, board: await loadDeskBoard(body.eventId, body.station) });
```
Replace with:
```ts
    case "desk-board": {
      await dispatch(body.eventId);
      if (role !== "desk") {
        return NextResponse.json({ ok: true, board: await loadDeskBoard(body.eventId, body.station) });
      }
      // The assigned desk, whatever the screen asked for. A desk that isn't one of this event's counts as none.
      const board = await loadDeskBoard(body.eventId, myDesk);
      const assignedDesk = myDesk && board.stations.includes(myDesk) ? myDesk : null;
      return NextResponse.json({ ok: true, board, assignedDesk });
    }
```

- [ ] **Step 5: `create-order` uses the assigned desk**

Find:
```ts
    case "create-order":
      return rpc("kit_create_order", {
        p_event_id: body.eventId,
        p_reg_ids: body.registrationIds,
        p_station: body.station,
        p_admin: email,
      });
```
Replace with:
```ts
    case "create-order": {
      const station = role === "desk" ? myDesk : body.station;
      if (!station) return NextResponse.json({ ok: false, message: NO_DESK });
      return rpc("kit_create_order", {
        p_event_id: body.eventId,
        p_reg_ids: body.registrationIds,
        p_station: station,
        p_admin: email,
      });
    }
```

- [ ] **Step 6: `order-preview` and `fulfil` refuse another desk's order**

Find:
```ts
      if (!order) return NextResponse.json({ ok: false, message: `No open order for ${body.code.toUpperCase()}` });
      return NextResponse.json({ ok: true, order });
```
Replace with:
```ts
      if (!order) return NextResponse.json({ ok: false, message: `No open order for ${body.code.toUpperCase()}` });
      const refused = otherDesk(order);
      if (refused) return NextResponse.json({ ok: false, message: refused });
      return NextResponse.json({ ok: true, order });
```
Find:
```ts
    case "fulfil":
      return rpc("kit_fulfil_order", { p_event_id: body.eventId, p_code: body.code, p_photo: null, p_admin: email });
```
Replace with:
```ts
    case "fulfil": {
      if (role === "desk") {
        const order = await findOpenOrder(body.eventId, body.code);
        const refused = order ? otherDesk(order) : myDesk ? null : NO_DESK;
        if (refused) return NextResponse.json({ ok: false, message: refused });
      }
      return rpc("kit_fulfil_order", { p_event_id: body.eventId, p_code: body.code, p_photo: null, p_admin: email });
    }
```

- [ ] **Step 7: `picker-state` returns the assigned items**

Find:
```ts
        // Lets the phone correct its clock for the 60 s offer countdown.
        now: new Date().toISOString(),
      });
```
Replace with:
```ts
        // Lets the phone correct its clock for the 60 s offer countdown.
        now: new Date().toISOString(),
        // Volunteer pickers: the items the admin assigned (0033). null = an admin, who ticks them on the screen.
        assigned: role === "picker" ? session.items : null,
      });
```

- [ ] **Step 8: `set-active` uses the assigned items**

Find:
```ts
    case "set-active":
      return rpc("kit_picker_set_active", {
        p_event_id: body.eventId,
        p_email: email,
        p_name: session.name,
        p_active: body.active,
        p_specialties: body.specialties,
      });
```
Replace with:
```ts
    case "set-active": {
      // A volunteer picker works on the items the admin assigned (0033); only an admin's ticks count.
      if (role === "picker" && body.active && session.items.length === 0) {
        return NextResponse.json({ ok: false, message: "No items assigned yet: ask the supervisor" });
      }
      const specialties =
        role === "picker" ? (session.items.length > 0 ? session.items : null) : (body.specialties ?? null);
      return rpc("kit_picker_set_active", {
        p_event_id: body.eventId,
        p_email: email,
        p_name: session.name,
        p_active: body.active,
        p_specialties: specialties,
      });
    }
```

- [ ] **Step 9: Type-check and lint**

Run: `npx tsc --noEmit -p .` then `npx eslint src/app/api/admin/kit/expo/route.ts src/lib/expo.ts src/lib/admin-auth.ts`
Expected: no output from either.

- [ ] **Step 10: Commit the server side (ask the user first)**

Ask: "OK to commit the Part 1 server changes (session, volunteers API, Volunteers screen, expo API)?" Only on a yes:
```bash
git add src/lib/admin-auth.ts src/lib/expo.ts src/app/api/admin/volunteers/route.ts "src/app/admin/(protected)/assets/page.tsx" "src/app/admin/(protected)/assets/VolunteersCard.tsx" src/app/api/admin/kit/expo/route.ts
git commit -m "Volunteer assignments: assign desks and items; the server enforces them" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The assignment note

**Files:**
- Create: `src/app/admin/(protected)/kit/AssignmentNote.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { Icon } from "@/components/ds";

/** A change the supervisor made to a volunteer's desk or items (0033), or a missing assignment. */
export type Note = { tone: "info" | "warn"; title: string; text: string } | null;

/**
 * Shown on the desk and picker screens: blue for information, amber for a warning. With
 * onDismiss it has a × and stays until the volunteer closes it. (Part 2 restyles every alert.)
 */
export function AssignmentNote({ note, onDismiss }: { note: Note; onDismiss?: () => void }) {
  if (!note) return null;
  const warn = note.tone === "warn";
  return (
    <div
      role={warn ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-12 px-4 py-3 ${
        warn ? "bg-tint-orange text-on-tint-orange" : "bg-tint-blue text-on-tint-blue"
      }`}
    >
      <Icon name={warn ? "alert" : "info"} size={22} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-16 font-semibold">{note.title}</p>
        {note.text && <p className="mt-0.5 text-14 text-ink">{note.text}</p>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="-mr-1 shrink-0 px-1 text-20 leading-none">
          ×
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no output.

---

### Task 8: Picker screen shows the assigned items

**Files:**
- Modify: `src/app/admin/(protected)/kit/picker/PickerStation.tsx`

- [ ] **Step 1: Import the note**

Find:
```ts
import { KIND_LABEL, buzz, chime, postExpo, useLatestReply, usePoll } from "../expo-client";
```
Replace with:
```ts
import { KIND_LABEL, buzz, chime, postExpo, useLatestReply, usePoll } from "../expo-client";
import { AssignmentNote, type Note } from "../AssignmentNote";
```

- [ ] **Step 2: Add state for the assigned items and the note**

Find:
```ts
  const [connError, setConnError] = useState(false);
```
Replace with:
```ts
  const [connError, setConnError] = useState(false);
  // Volunteer pickers: the items the admin assigned (0033). null = an admin, who ticks items here.
  const [assigned, setAssigned] = useState<ExpoKind[] | null>(null);
  // What the last poll said, to spot the admin's changes. undefined = no poll back yet.
  const assignedSeen = useRef<ExpoKind[] | null | undefined>(undefined);
  const [note, setNote] = useState<Note>(null);
```

- [ ] **Step 3: Read `assigned` from each poll and note changes**

Find:
```ts
    const res = await postExpo<{ state?: PickerState; now?: string }>({ action: "picker-state", eventId });
```
Replace with:
```ts
    const res = await postExpo<{ state?: PickerState; now?: string; assigned?: ExpoKind[] | null }>({
      action: "picker-state",
      eventId,
    });
```
Find:
```ts
    const next = res.state;
    if (next.task?.status === "offered" && next.task.id !== lastTaskId.current) {
```
Replace with:
```ts
    const next = res.state;
    // The admin changed this picker's items (0033). Not on the first poll: that's just loading.
    const nextAssigned = res.assigned ?? null;
    const before = assignedSeen.current;
    const itemsRemoved = Array.isArray(before) && before.length > 0 && nextAssigned !== null && nextAssigned.length === 0;
    if (Array.isArray(before) && nextAssigned !== null && before.join() !== nextAssigned.join()) {
      setNote(
        nextAssigned.length === 0
          ? {
              tone: "warn",
              title: "Your items were removed",
              text:
                next.task?.status === "accepted"
                  ? "Finish the task on your screen. After that you're paused until the supervisor assigns new ones."
                  : "You're paused until the supervisor assigns new ones.",
            }
          : {
              tone: "info",
              title: `Your items are now ${nextAssigned.map((k) => KIND_LABEL[k]).join(" · ")}`,
              text: "Set by the supervisor. A task already on your screen carries on.",
            }
      );
    }
    assignedSeen.current = nextAssigned;
    setAssigned(nextAssigned);
    if (next.task?.status === "offered" && next.task.id !== lastTaskId.current) {
```

- [ ] **Step 4: Don't show "You were paused" when the note already explains it**

Find:
```ts
    // Paused by the server: an offer ran out, or the supervisor released the task.
    if (wasActive.current && next.picker && !next.picker.active && !busy && !pausedByMe.current) {
```
Replace with:
```ts
    // Paused by the server: an offer ran out, or the supervisor released the task. (Items removed:
    // the note says so instead.)
    if (wasActive.current && next.picker && !next.picker.active && !busy && !pausedByMe.current && !itemsRemoved) {
```

- [ ] **Step 5: A volunteer's items are the assigned ones**

Find:
```ts
  const active = state?.picker?.active ?? false;
  const mySpecialties = specialties ?? state?.picker?.specialties ?? ALL_KINDS;
```
Replace with:
```ts
  const active = state?.picker?.active ?? false;
  // A volunteer picks the items the admin assigned; an admin previewing ticks their own.
  const isVolunteer = assigned !== null;
  const mySpecialties = assigned ?? specialties ?? state?.picker?.specialties ?? ALL_KINDS;
```

- [ ] **Step 6: Only an admin sends ticks on Start**

Find:
```ts
    const res = await act({ action: "set-active", eventId, active: on, specialties: kinds });
```
Replace with:
```ts
    // A volunteer's items come from the server (0033); only an admin sends ticks.
    const res = await act({ action: "set-active", eventId, active: on, ...(isVolunteer ? {} : { specialties: kinds }) });
```

- [ ] **Step 7: Show the note above the card**

Find:
```tsx
  const task = state.task;
  return (
    <div className="flex flex-col gap-4">
      <Card>
```
Replace with:
```tsx
  const task = state.task;
  return (
    <div className="flex flex-col gap-4">
      <AssignmentNote note={note} onDismiss={() => setNote(null)} />
      <Card>
```

- [ ] **Step 8: Read-only items for volunteers, ticks for admins**

Find:
```tsx
        <div className="mt-4 border-t border-line-secondary pt-3">
          <p className="mb-2 text-12 font-medium uppercase tracking-wide text-ink-tertiary">I pick</p>
          <div className="flex flex-wrap gap-4">
            {ALL_KINDS.map((k) => (
              <Checkbox
                key={k}
                label={KIND_LABEL[k]}
                checked={mySpecialties.includes(k)}
                disabled={busy}
                onChange={(on) => {
                  const next = on ? [...mySpecialties, k] : mySpecialties.filter((x) => x !== k);
                  setSpecialties(next);
                  // Saved straight away while active; otherwise on Start.
                  if (active && next.length > 0) void setActive(true, next);
                }}
              />
            ))}
          </div>
          <p className="mt-2 text-12 text-ink-muted">A task waiting over 90 s can go to anyone free.</p>
        </div>
```
Replace with:
```tsx
        <div className="mt-4 border-t border-line-secondary pt-3">
          {isVolunteer ? (
            <>
              <p className="mb-2 text-12 font-medium uppercase tracking-wide text-ink-tertiary">Your items</p>
              {mySpecialties.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {mySpecialties.map((k) => (
                      <StatusPill key={k} tone="pending">
                        {KIND_LABEL[k]}
                      </StatusPill>
                    ))}
                  </div>
                  <p className="mt-2 text-12 text-ink-muted">
                    Set by the supervisor. A task waiting over 90 s can go to anyone free.
                  </p>
                </>
              ) : (
                <AssignmentNote
                  note={{ tone: "warn", title: "No items assigned yet", text: "Ask the supervisor. Start unlocks once they assign some." }}
                />
              )}
            </>
          ) : (
            <>
              <p className="mb-2 text-12 font-medium uppercase tracking-wide text-ink-tertiary">I pick</p>
              <div className="flex flex-wrap gap-4">
                {ALL_KINDS.map((k) => (
                  <Checkbox
                    key={k}
                    label={KIND_LABEL[k]}
                    checked={mySpecialties.includes(k)}
                    disabled={busy}
                    onChange={(on) => {
                      const next = on ? [...mySpecialties, k] : mySpecialties.filter((x) => x !== k);
                      setSpecialties(next);
                      // Saved straight away while active; otherwise on Start.
                      if (active && next.length > 0) void setActive(true, next);
                    }}
                  />
                ))}
              </div>
              <p className="mt-2 text-12 text-ink-muted">
                Admin preview: tick items to test. A task waiting over 90 s can go to anyone free.
              </p>
            </>
          )}
        </div>
```

- [ ] **Step 9: Mark an overflow offer**

Find:
```tsx
        <OfferCard task={task} secondsLeft=
```
Replace with:
```tsx
        <OfferCard task={task} notMine={!mySpecialties.includes(task.kind)} secondsLeft=
```
(Only the start of that line changes.)

Find:
```tsx
function OfferCard({
  task,
  secondsLeft,
  busy,
  onAccept,
  onDecline,
}: {
  task: PickerTask;
  secondsLeft: number;
```
Replace with:
```tsx
function OfferCard({
  task,
  notMine,
  secondsLeft,
  busy,
  onAccept,
  onDecline,
}: {
  task: PickerTask;
  /** Overflow: a task for an item this picker wasn't given, sent because it waited over 90 s. */
  notMine: boolean;
  secondsLeft: number;
```
Find:
```tsx
      </div>
      <div className="mt-5 grid grid-cols-[2fr_1fr] gap-2">
```
Replace with:
```tsx
      </div>
      {notMine && (
        <p className="mt-3 flex items-start gap-2 rounded-8 border border-[#F7B27A] bg-white px-3 py-2 text-14 text-on-tint-orange">
          <Icon name="alert" size={18} className="mt-px shrink-0" />
          <span>
            <span className="font-semibold">Not one of your items.</span> It has waited over 90 s, so any free picker can
            take it.
          </span>
        </p>
      )}
      <div className="mt-5 grid grid-cols-[2fr_1fr] gap-2">
```

- [ ] **Step 10: Type-check and lint**

Run: `npx tsc --noEmit -p .` then `npx eslint "src/app/admin/(protected)/kit/picker/PickerStation.tsx" "src/app/admin/(protected)/kit/AssignmentNote.tsx"`
Expected: no output from either.

---

### Task 9: Desk screen and volunteer app show the assigned desk

**Files:**
- Modify: `src/app/admin/(protected)/kit/desk/DeskStation.tsx`
- Modify: `src/app/v/VolunteerApp.tsx`
- Modify: `src/app/v/page.tsx`

- [ ] **Step 1: Import the note in `DeskStation.tsx`**

Find:
```ts
import { KIND_LABEL, buzz, chime, elapsed, postExpo, useLatestReply, usePoll } from "../expo-client";
```
Replace with:
```ts
import { KIND_LABEL, buzz, chime, elapsed, postExpo, useLatestReply, usePoll } from "../expo-client";
import { AssignmentNote, type Note } from "../AssignmentNote";
```

- [ ] **Step 2: New props; a volunteer's desk is the assigned one**

Find:
```tsx
export default function DeskStation({
  eventId,
  stations: initialStations,
  canCancel,
}: {
  eventId: string;
  stations: string[];
  canCancel: boolean;
}) {
  // The desk's station sticks to this browser (one laptop per desk).
  const saved = useSyncExternalStore(subscribeStation, readStation, () => null);
  const station =
    saved && initialStations.includes(saved) ? saved : initialStations.length === 1 ? initialStations[0] : null;
```
Replace with:
```tsx
export default function DeskStation({
  eventId,
  stations: initialStations,
  canCancel,
  assignedDesk,
  onDeskChange,
}: {
  eventId: string;
  stations: string[];
  canCancel: boolean;
  /**
   * Desk volunteers (0033): the desk the admin assigned, null = none yet. The server decides it;
   * this screen only shows it. Left out for admins, who choose the desk here.
   */
  assignedDesk?: string | null;
  /** Called when the admin moves this desk volunteer, or takes them off their desk. */
  onDeskChange?: (desk: string | null) => void;
}) {
  const fixed = assignedDesk !== undefined;
  const [assigned, setAssigned] = useState<string | null>(assignedDesk ?? null);
  // What the last poll said, to spot the admin's changes. undefined = no poll back yet.
  const assignedSeen = useRef<string | null | undefined>(undefined);
  const [note, setNote] = useState<Note>(null);
  // An admin's choice of desk sticks to this browser (one laptop per desk).
  const saved = useSyncExternalStore(subscribeStation, readStation, () => null);
  const chosen =
    saved && initialStations.includes(saved) ? saved : initialStations.length === 1 ? initialStations[0] : null;
  const station = fixed ? assigned : chosen;
```

- [ ] **Step 3: Read `assignedDesk` from each board poll**

Find:
```ts
    const res = await postExpo<{ board?: DeskBoard }>({ action: "desk-board", eventId, station });
    // Left before the last create / hand-over (or a station switch) and came back after it.
    if (latest.isStale(ticket)) return;
    setNow(Date.now());
    if (!res.ok || !res.board) {
      setBoardError(true);
      return;
    }
    setBoardError(false);
```
Replace with:
```ts
    const res = await postExpo<{ board?: DeskBoard; assignedDesk?: string | null }>({ action: "desk-board", eventId, station });
    // Left before the last create / hand-over (or a station switch) and came back after it.
    if (latest.isStale(ticket)) return;
    setNow(Date.now());
    if (!res.ok || !res.board) {
      setBoardError(true);
      return;
    }
    setBoardError(false);
    if (fixed) {
      const next = res.assignedDesk ?? null;
      const before = assignedSeen.current;
      assignedSeen.current = next;
      if (before !== next) {
        // The admin moved them or took them off (not the first poll): what was on screen belonged to the old desk.
        if (before !== undefined) {
          setNote(
            next
              ? { tone: "info", title: `You're now at desk ${next}`, text: "Set by the supervisor." }
              : { tone: "warn", title: "You were taken off your desk", text: "Ask the supervisor. This screen updates by itself." }
          );
          readySeen.current = null;
          setLookup(null);
          setSelected([]);
          setPreview(null);
          setBanner(null);
        }
        setAssigned(next);
        onDeskChange?.(next);
      }
    }
```

- [ ] **Step 4: Keep polling with no desk**

Find:
```ts
  usePoll(refreshBoard, 3000, station !== null);
```
Replace with:
```ts
  // A desk volunteer keeps polling with no desk, to notice when the admin assigns one.
  usePoll(refreshBoard, 3000, fixed || station !== null);
```

- [ ] **Step 5: Fixed desk row, no switcher for volunteers**

Find:
```tsx
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-14 font-medium text-ink-secondary">This desk</span>
        <SegmentedControl
          size="md"
          ariaLabel="Desk station"
          options={stations.map((s) => ({ value: s, label: s }))}
          value={station ?? ""}
          onChange={chooseStation}
        />
```
Replace with:
```tsx
    <div className="flex flex-col gap-4">
      <AssignmentNote note={note} onDismiss={() => setNote(null)} />
      <div className="flex flex-wrap items-center gap-3">
        {fixed ? (
          station && (
            <>
              <span className="text-14 font-medium text-ink-secondary">This desk</span>
              <StatusPill tone="info">{station}</StatusPill>
              <span className="text-12 text-ink-muted">Set by the supervisor</span>
            </>
          )
        ) : (
          <>
            <span className="text-14 font-medium text-ink-secondary">This desk</span>
            <SegmentedControl
              size="md"
              ariaLabel="Desk station"
              options={stations.map((s) => ({ value: s, label: s }))}
              value={station ?? ""}
              onChange={chooseStation}
            />
          </>
        )}
```

- [ ] **Step 6: "No desk assigned yet" instead of the scan box**

Find:
```tsx
      {!station ? (
        <Card>
          <EmptyState title="Choose which desk this is to start." />
        </Card>
      ) : (
```
Replace with:
```tsx
      {!station ? (
        <Card>
          {fixed ? (
            <EmptyState title="No desk assigned yet">
              <p className="text-14 text-ink-tertiary">Ask the supervisor to assign you a desk. This screen updates by itself.</p>
            </EmptyState>
          ) : (
            <EmptyState title="Choose which desk this is to start." />
          )}
        </Card>
      ) : (
```

- [ ] **Step 7: The volunteer app passes the desk and shows it in the header**

In `src/app/v/VolunteerApp.tsx`, find:
```ts
import { useRef } from "react";
```
Replace with:
```ts
import { useRef, useState } from "react";
```
Find:
```tsx
  eventName,
  stations,
}: {
  email: string;
```
Replace with:
```tsx
  eventName,
  stations,
  assignedDesk,
}: {
  email: string;
```
Find:
```tsx
  eventName: string;
  stations: string[];
}) {
  const router = useRouter();
  const isAdmin = role === "admin";
```
Replace with:
```tsx
  eventName: string;
  stations: string[];
  /** Desk volunteers: the desk the admin assigned (0033), null = none yet. */
  assignedDesk: string | null;
}) {
  const router = useRouter();
  const isAdmin = role === "admin";
  // Kept up to date by the desk screen's poll, for the header.
  const [desk, setDesk] = useState(assignedDesk);
```
Find:
```tsx
            <p className="truncate text-16 font-semibold">{ROLE_TITLE[view]}</p>
```
Replace with:
```tsx
            <p className="truncate text-16 font-semibold">
              {ROLE_TITLE[view]}
              {view === "desk" && !isAdmin && desk ? ` · ${desk}` : ""}
            </p>
```
Find:
```tsx
              <DeskStation
                key="desk"
                eventId={eventId}
                stations={stations}
                canCancel={isAdmin}
              />
```
Replace with:
```tsx
              <DeskStation
                key="desk"
                eventId={eventId}
                stations={stations}
                canCancel={isAdmin}
                assignedDesk={isAdmin ? undefined : assignedDesk}
                onDeskChange={setDesk}
              />
```

- [ ] **Step 8: The page reads the desk from the session**

In `src/app/v/page.tsx`, find:
```tsx
  const stations = view === "desk" && event ? await listStations(event.id) : [];
```
Replace with:
```tsx
  const stations = view === "desk" && event ? await listStations(event.id) : [];
  // A desk volunteer's desk (0033). One that isn't a desk of this event counts as none.
  const assignedDesk = session.role === "desk" && session.desk && stations.includes(session.desk) ? session.desk : null;
```
Find:
```tsx
      stations={stations}
    />
```
Replace with:
```tsx
      stations={stations}
      assignedDesk={assignedDesk}
    />
```

- [ ] **Step 9: Type-check and lint**

Run: `npx tsc --noEmit -p .` then `npx eslint "src/app/admin/(protected)/kit/desk/DeskStation.tsx" src/app/v/VolunteerApp.tsx src/app/v/page.tsx`
Expected: no output from either.

- [ ] **Step 10: Commit the screens (ask the user first)**

Ask: "OK to commit the Part 1 screen changes (desk, picker, volunteer app)?" Only on a yes:
```bash
git add "src/app/admin/(protected)/kit/AssignmentNote.tsx" "src/app/admin/(protected)/kit/picker/PickerStation.tsx" "src/app/admin/(protected)/kit/desk/DeskStation.tsx" src/app/v/VolunteerApp.tsx src/app/v/page.tsx
git commit -m "Volunteer assignments: desk and picker screens show the assigned desk and items" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Verify everything, then hand over

**Files:** none changed (fix anything these checks find in the file concerned, then repeat the check).

- [ ] **Step 1: Full type-check, lint and build**

Run: `npx tsc --noEmit -p .`
Expected: no output.
Run: `npx eslint src/lib/admin-auth.ts src/lib/expo.ts src/app/api/admin/volunteers/route.ts src/app/api/admin/kit/expo/route.ts "src/app/admin/(protected)/assets" "src/app/admin/(protected)/kit/AssignmentNote.tsx" "src/app/admin/(protected)/kit/picker/PickerStation.tsx" "src/app/admin/(protected)/kit/desk/DeskStation.tsx" src/app/v`
Expected: no output.
Run: `npx next build`
Expected: ends with the route table and no errors. A local build deploys nothing.

- [ ] **Step 2: Read-only checks on the dev server**

`npm run dev`, signed in as an admin (0033 must be applied):
1. `/admin/assets?tab=volunteers`: the "Desk or items" column, as in Task 5 Step 4. Change nothing.
2. `/v?as=picker`: the "I pick" ticks are still there, with "Admin preview: tick items to test". Don't press Start (it writes `kit_pickers`).
3. `/v?as=desk`: the desk switcher is still there, and the header has no "· D1".
4. `/admin/kit/desk` and `/admin/kit/picker`: they look and behave as before for an admin.
5. The browser console shows no errors on these pages.

- [ ] **Step 3: Report to the user, with the checks that need writes**

Tell the user what passed. Then list the checks that write to production, which the user should do (or approve) after deploying, with a spare Google account added as a test volunteer:
1. Add it as Picker with no items: on /v, "No items assigned yet" shows and Start is disabled.
2. Tick T-shirt: within about 2 s the phone shows a blue note, "Your items are now T-shirt", and Start works.
3. Untick everything while it's active: an amber note appears, and it's paused.
4. Change it to Desk with no desk: "No desk assigned yet" shows, with no scan box.
5. Assign D1: within about 3 s, a blue note appears and the D1 board shows, with "· D1" in the header.
6. At D1, scan the pigeonhole label of an order at another desk: "… is at desk D2: send the runner there" shows. Don't press Hand over on anything.
7. Remove the test volunteer afterwards.

- [ ] **Step 4: Deploy (only with a yes)**

Ask: "OK to push `main` (deploys Part 1 to production)?" Only on a yes: `git push origin main`.
Then remind the user that every desk volunteer and picker starts unassigned: they need to assign desks and items in Configuration → Volunteers before the pilot.
