# Volunteer assignments, Part 2: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pickers pick by scanning. After Accept, the picker screen splits into a live camera on top, then one step at a time, with a progress bar pinned to the bottom. Every scan is one server action, `task-scan`. Every volunteer screen gets the new alert, and "crate" becomes "pigeonhole" on screen.

**Architecture:** Migration 0035 adds `kit_task_scan(task, code, email)`. It works out what a scan means (pigeonhole, this task's bin, a BIB, another pigeonhole, or a wrong code), does the write, and answers `{ok, result, message, hint}`. The expo API passes it through as action `task-scan`. On the phone, camera detection moves out of `CameraScanner` into a hook, `useBarcodeCamera`. The full-screen scanner (single scan) and the new inline `TaskCamera` both use it. `steps.ts` turns a `PickerTask` into steps, and `TaskScreen` shows the first step not done. `ResultBanner` becomes the one alert component (red / amber / blue / green). It still accepts the old `{ok, text}` shape, so the screens this plan doesn't touch keep working.

**Tech stack:** Next 16.3 (App Router, route handlers), React 19.2, Tailwind v4 with the Dock design system (`src/components/ds`), Supabase Postgres (plpgsql, service role), zod 4, `barcode-detector` (zxing ponyfill).

**Spec:** `docs/volunteer-assignments-design.md`, sections 4–8 (approved). Mockup: `docs/mockups/volunteer-assignments.html`. Part 1 (`docs/volunteer-assignments-plan-part1.md`) is live since 28 Nov. The spec calls this migration 0034, but another workstream took that number (`0034_raigarh_2027_details.sql`), so Part 2 uses **0035**.

---

## Ground rules: read before Task 1

- **The database is production.** `.env.local` and the dev server (`npm run dev`, localhost:3000) use the production database. Treat it as read-only unless the user approves a write. Writes include: Start or Pause, Accept or Decline, any scan on a real task's screen (task-scan writes), Bin is empty, Create order and Cancel order. **Never press Hand over.** The screen checks in Task 11 use a temporary preview page that makes no API calls.
- **Migrations:** 0025–0034 are applied, including both 0033 files (`0033_raigarh_booklet_asset.sql` and `0033_volunteer_assignments.sql`). Never edit them. You write `0035`, and the user applies it in the Supabase SQL editor. Once applied, 0035 is frozen too: a fix found later goes in a new migration. Before Task 1, run `ls supabase/migrations`. If someone has pushed a 0035 since, use the next free number and rename it everywhere this plan says 0035 (file names, comments, commit messages).
- **Commits, pushes, deploys:** only with an explicit yes from the user for that commit or push. A yes doesn't carry over to the next one. Pushing `main` deploys production. Others push to `main` too: `git fetch` before a push.
- **Paths:** the app lives in the `(app)` route group: `src/app/(app)/admin/(protected)/kit/...` and `src/app/(app)/v/...`. The spec gives the older paths. Quote these paths in shell commands because of the parentheses.
- **Next.js 16.3:** read `node_modules/next/dist/docs/` before using an API you're unsure of. Nothing in this plan needs a new Next API.
- **Lint rules:** `eslint-plugin-react-hooks` 7 runs the React Compiler rules. Don't read `ref.current` during render (only in effects and handlers), and don't call a state setter synchronously in an effect body (inside a timer or async callback is fine). The code below follows both rules.
- **No JavaScript test runner** in this repo. The SQL logic is tested by a rollback-style script in `supabase/tests/`, which the user runs. TypeScript is checked with `npx tsc --noEmit -p .`, `npx eslint <files>` and `npx next build`, plus the screen checks in Task 11.
- **Environment:** Windows with Git Bash or PowerShell, no Python. The repo stores LF. `core.autocrlf` is on, so checked-out files may be CRLF. The Edit tool matches either, and new files may be written with LF.
- **Order:** the user applies 0035 in Task 1, before anything is deployed. Part 2's screen calls `task-scan` only on a real accepted task, which the local checks never create, so the dev server works with or without 0035. A phone left on the old screen during the deploy keeps working: `pick-bin`, `pick-item` and `put-away` stay (spec §8).

## File map

| File | Responsibility | Task |
|---|---|---|
| `supabase/migrations/0035_task_scan.sql` | Create: `kit_task_scan` | 1 |
| `supabase/tests/0035_task_scan_test.sql` | Create: rollback test for 0035 | 1 |
| `src/lib/expo.ts` | `PickerBin.size` (T-shirt bins); `TaskScanResult` | 2 |
| `src/app/api/admin/kit/expo/route.ts` | Action `task-scan` | 3 |
| `src/app/(app)/admin/(protected)/kit/useBarcodeCamera.ts` | Create: camera + barcode detection hook (stream leak fixed) | 4 |
| `src/app/(app)/admin/(protected)/kit/CameraScanner.tsx` | Replace: full-screen, single scan, uses the hook | 4 |
| `src/app/(app)/admin/(protected)/kit/ScanInput.tsx` | Replace: `Alert`, `alertFrom`, the new `ResultBanner`, exported `isTouchFirst`; no `continuous` / `feedback` | 4 |
| `src/app/(app)/admin/(protected)/kit/picker/steps.ts` | Create: task → steps, camera line, progress, what to take | 5 |
| `src/app/(app)/admin/(protected)/kit/picker/TaskCamera.tsx` | Create: the inline camera (55 dvh) with the step line and the alert over it | 6 |
| `src/app/(app)/admin/(protected)/kit/picker/TaskScreen.tsx` | Create: split task screen, code box, step card, pinned progress bar | 7 |
| `src/app/(app)/admin/(protected)/kit/picker/PickerStation.tsx` | Replace: task-scan, alerts, TaskScreen during a task | 8 (one-line interim edit in 4) |
| `src/app/(app)/admin/(protected)/kit/desk/DeskStation.tsx` | Alerts; "No free pigeonhole"; crate → pigeonhole | 9 |
| `src/app/(app)/admin/(protected)/kit/AssignmentNote.tsx` | Delete (ResultBanner replaces it) | 9 |
| `src/app/(app)/admin/(protected)/kit/desk/page.tsx`, `kit/page.tsx`, `kit/labels/page.tsx`, `src/app/(app)/v/VolunteerApp.tsx` | crate → pigeonhole in visible text | 10 |
| `src/app/(app)/v/task-preview/page.tsx` | Temporary: sample tasks, no API calls. **Deleted before the commit.** | 11 |

There are 3 commit points: after Task 1 (SQL, once the test passes), after Task 3 (server) and after Task 11 (screens). Each one needs the user's yes.

---

### Task 1: Migration 0035 and its test

**Files:**
- Create: `supabase/migrations/0035_task_scan.sql`
- Create: `supabase/tests/0035_task_scan_test.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0035_task_scan.sql`:

```sql
-- One action for every scan during a picker's task (docs/volunteer-assignments-design.md §4.2,
-- volunteer assignments Part 2). The spec calls this migration 0034; that number went to another
-- workstream (0034_raigarh_2027_details.sql), so it is 0035.
--
-- kit_task_scan(task, code, email): the picker's screen sends every scan here (camera, typed, or
-- a hardware scanner), and the answer says what the scan did: {ok, result, message, hint}.
-- message = what happened (the alert's title), hint = what to do now (the line under it).
-- Checked in this order:
--   1. This order's pigeonhole: everything picked -> put away (kit_put_away; the order turns
--      Ready when it was the last task) = done. Not everything picked = not-all-picked.
--   2. A bin of this task: nothing left to pick in it = already. A BIB bin -> opened. A T-shirt or
--      pack bin -> every line this task needs from it is picked = picked (the bin label is the check).
--   3. A BIB of this task: picked already = already; its bin not open yet = bin-first; else
--      picked = bib.
--   4. Another pigeonhole of this event = wrong-pigeonhole.
--   5. Anything else: a BIB task with a bin open = wrong-bib, otherwise wrong-bin.
-- ok is true only for picked / opened / bib / done. A task that isn't accepted, or isn't the
-- caller's, is refused with "Accept the task first" and no result, like the 0030 pick functions.
-- One exception: the pigeonhole scanned again after the task is done (the camera reading it twice)
-- answers "Task done".
--
-- kit_pick_bin, kit_pick_item and kit_put_away stay: a phone still on the old screen keeps working
-- during the deploy. 0025-0034 are not edited. Safe to re-run. Service role only, like every other
-- kit function.

begin;

create or replace function kit_task_scan(p_task uuid, p_code text, p_email text)
returns jsonb as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_task kit_tasks;
  v_mine boolean;
  v_order kit_orders;
  v_label text;           -- this order's pigeonhole
  v_bin text;             -- the scanned bin, when it is one of this task's
  v_left int;
  v_size text;
  v_line kit_order_lines;
  v_res jsonb;
begin
  -- Locked for the whole scan: two scans of one task never interleave.
  select * into v_task from kit_tasks where id = p_task for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Task not found'); end if;
  v_mine := coalesce(
    (select email from kit_pickers where id = v_task.picker_id) = lower(trim(coalesce(p_email, ''))), false);
  select * into v_order from kit_orders where id = v_task.order_id;
  select label into v_label from kit_pigeonholes where id = v_order.pigeonhole_id;

  -- The pigeonhole read again after the task finished (the camera still sees it).
  if v_task.status = 'done' and v_mine and v_code = upper(v_label) then
    return jsonb_build_object('ok', true, 'result', 'done', 'message', 'Task done',
      'hint', 'It is in pigeonhole ' || v_label || '.');
  end if;
  if v_task.status <> 'accepted' or not v_mine then
    return jsonb_build_object('ok', false, 'message', 'Accept the task first');
  end if;

  -- 1. This order's pigeonhole
  if v_code = upper(v_label) then
    select count(*) into v_left from kit_order_lines
    where task_id = p_task and status = 'pending' and picked_at is null;
    if v_left > 0 then
      return jsonb_build_object('ok', false, 'result', 'not-all-picked', 'message', 'Pick everything first',
        'hint', v_left || ' still to pick. Then scan ' || v_label || ' again.');
    end if;
    v_res := kit_put_away(p_task, v_label, p_email);
    if not coalesce((v_res->>'ok')::boolean, false) then
      return jsonb_build_object('ok', false, 'message', v_res->>'message');
    end if;
    return jsonb_build_object('ok', true, 'result', 'done', 'message', 'Task done',
      'hint', 'Dropped in pigeonhole ' || v_label || '. The next task comes to this screen.',
      'orderReady', coalesce((v_res->>'orderReady')::boolean, false));
  end if;

  -- 2. A bin of this task
  select bin_code into v_bin from kit_order_lines
  where task_id = p_task and status = 'pending' and upper(bin_code) = v_code
  limit 1;
  if v_bin is not null then
    select count(*) filter (where picked_at is null), max(size) into v_left, v_size
    from kit_order_lines where task_id = p_task and status = 'pending' and bin_code = v_bin;
    if v_left = 0 then
      return jsonb_build_object('ok', false, 'result', 'already', 'message', 'Bin ' || v_bin || ' is already picked',
        'hint', 'Nothing more to take from it.');
    end if;
    update kit_order_lines set opened_at = coalesce(opened_at, now())
    where task_id = p_task and status = 'pending' and bin_code = v_bin and picked_at is null;
    if v_task.kind = 'bib' then
      return jsonb_build_object('ok', true, 'result', 'opened', 'message', 'Bin ' || v_bin || ' open',
        'hint', 'Now scan each BIB as you take it.');
    end if;
    -- T-shirts and packs: the bin label is the check, so it picks what this task needs from the bin.
    update kit_order_lines set picked_at = now()
    where task_id = p_task and status = 'pending' and bin_code = v_bin and picked_at is null;
    return jsonb_build_object('ok', true, 'result', 'picked', 'message',
      'Picked ' || v_left
        || case when v_task.kind = 'tshirt' then ' × size ' || coalesce(v_size, '?')
                when v_left = 1 then ' pack' else ' packs' end
        || ' from ' || v_bin);
  end if;

  -- 3. A BIB of this task
  if v_task.kind = 'bib' then
    select l.* into v_line
    from kit_order_lines l join registrations r on r.id = l.registration_id
    where l.task_id = p_task and l.kind = 'bib' and l.status = 'pending' and upper(r.bib_number) = v_code
    limit 1;
    if found then
      if v_line.picked_at is not null then
        return jsonb_build_object('ok', false, 'result', 'already', 'message', 'BIB ' || v_code || ' is already picked',
          'hint', 'Carry on with the next step.');
      end if;
      if v_line.opened_at is null then
        return jsonb_build_object('ok', false, 'result', 'bin-first', 'message', 'Scan the bin label first',
          'hint', 'Bin ' || v_line.bin_code || ', then BIB ' || v_code || '.');
      end if;
      update kit_order_lines set picked_at = now() where id = v_line.id;
      return jsonb_build_object('ok', true, 'result', 'bib', 'message', 'BIB ' || v_code || ' picked');
    end if;
  end if;

  -- 4. Another pigeonhole of this event
  if exists (select 1 from kit_pigeonholes where event_id = v_order.event_id and upper(label) = v_code) then
    return jsonb_build_object('ok', false, 'result', 'wrong-pigeonhole', 'message', 'Wrong pigeonhole: ' || v_code,
      'hint', 'This task goes in ' || v_label || '.');
  end if;

  -- 5. Anything else
  if v_task.kind = 'bib' and exists (
    select 1 from kit_order_lines where task_id = p_task and status = 'pending' and opened_at is not null
  ) then
    return jsonb_build_object('ok', false, 'result', 'wrong-bib', 'message', 'Wrong BIB: ' || v_code,
      'hint', 'It isn''t in this order. Put it back.');
  end if;
  return jsonb_build_object('ok', false, 'result', 'wrong-bin', 'message', 'Wrong bin: ' || v_code,
    'hint', 'It isn''t in this task. Put back anything you took from it.');
end;
$$ language plpgsql;

do $$
begin
  revoke execute on function kit_task_scan(uuid, text, text) from public, anon, authenticated;
  grant execute on function kit_task_scan(uuid, text, text) to service_role;
end $$;

commit;
```

- [ ] **Step 2: Write the test**

`supabase/tests/0035_task_scan_test.sql`:

```sql
-- Test script for 0035_task_scan.sql. Run AFTER the migration, in the Supabase SQL editor.
--
-- It checks kit_task_scan, the one action behind every scan during a picker's task:
--   - refusals with no result: an unknown task, a task not accepted yet, another picker's task
--   - T-shirt and pack tasks: the bin label picks; the same bin again = already picked; the
--     order's pigeonhole puts the task away; again on the done task = "Task done"
--   - the BIB task: a BIB before its bin = scan the bin first; the bin label opens it; the BIB
--     picks it; the same BIB again = already picked
--   - wrong pigeonhole, wrong bin, wrong BIB (only once a bin is open), and the pigeonhole
--     before everything is picked
--   - the order turns Ready when its last task is put away
-- It uses one test order for a real paid expo runner at a test desk (TST: 2 small + 1 large
-- pigeonhole) and three test pickers, one item each (p1 BIB, p2 T-shirt, p3 pack, @test.local).
-- Then it RAISES AN ERROR ON PURPOSE: the error message is the test report, and raising it rolls
-- back every change (no order, pigeonhole, picker, task or log row is left behind). The
-- order-number sequence skips a number.
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

-- True when a scan's answer has this ok and this result (a null result = a refusal).
create or replace function pg_temp.answered(p_res jsonb, p_ok boolean, p_result text)
returns boolean language sql as $$
  select coalesce((p_res->>'ok')::boolean = p_ok and (p_res->>'result') is not distinct from p_result, false)
$$;

do $$
declare
  ev uuid;
  a uuid;
  res jsonb;
  v_order uuid;
  v_bt uuid;        -- the BIB task (P1)
  v_ts uuid;        -- the T-shirt task (P2)
  v_pk uuid;        -- the pack task (P3)
  v_bib text;       -- the runner's BIB
  v_bib_bin text;   -- the BIB file it is in, e.g. BF-42001-42100
  v_ts_bin text;    -- e.g. TS-M
  v_size text;      -- e.g. M
  out text := '';
  fails int;
begin
  -- 1. One paid expo runner with a numeric BIB and a T-shirt, not collected, not in an order; a quiet floor
  select r.id into a from registrations r
  where r.payment_status = 'paid' and r.kit_channel = 'expo'
    and r.bib_number ~ '^\d+$' and r.tshirt_size is not null
    and kit_order_blocker(r.id) is null
  order by r.created_at limit 1;
  if a is null then
    raise exception 'TEST REPORT: cannot run, no eligible expo runner';
  end if;
  select event_id, bib_number into ev, v_bib from registrations where id = a;
  if exists (select 1 from kit_pickers where event_id = ev and active) then
    raise exception 'TEST REPORT: cannot run, a picker is active (pause everyone first)';
  end if;
  if exists (select 1 from kit_tasks k join kit_orders o on o.id = k.order_id
             where o.event_id = ev and k.status in ('queued', 'offered', 'accepted')) then
    raise exception 'TEST REPORT: cannot run, an order is being picked (finish or cancel it first)';
  end if;

  -- 2. Setup: TST with 2 small + 1 large pigeonhole, one specialist picker per item, one order
  res := kit_seed_pigeonholes(ev, array['TST'], 2, 1);
  out := out || pg_temp.chk('seed TST: 2 small + 1 large pigeonhole', (res->>'added')::int = 3, res);
  perform kit_picker_set_active(ev, 'p1@test.local', 'P1', true, array['bib']);
  perform kit_picker_set_active(ev, 'p2@test.local', 'P2', true, array['tshirt']);
  perform kit_picker_set_active(ev, 'p3@test.local', 'P3', true, array['pack']);
  res := kit_create_order(ev, array[a], 'TST', 'test');
  out := out || pg_temp.chk('test order created in TST-S1', (res->>'ok')::boolean and res->>'crate' = 'TST-S1', res);
  v_order := (res->>'orderId')::uuid;
  select id into v_bt from kit_tasks where order_id = v_order and kind = 'bib';
  select id into v_ts from kit_tasks where order_id = v_order and kind = 'tshirt';
  select id into v_pk from kit_tasks where order_id = v_order and kind = 'pack';
  select bin_code into v_bib_bin from kit_order_lines where task_id = v_bt;
  select bin_code, size into v_ts_bin, v_size from kit_order_lines where task_id = v_ts;
  out := out || pg_temp.chk('each task offered to its specialist',
    pg_temp.where_is(v_bt) = '{"status":"offered","picker":"p1@test.local"}'
    and pg_temp.where_is(v_ts) = '{"status":"offered","picker":"p2@test.local"}'
    and pg_temp.where_is(v_pk) = '{"status":"offered","picker":"p3@test.local"}',
    jsonb_build_array(pg_temp.where_is(v_bt), pg_temp.where_is(v_ts), pg_temp.where_is(v_pk)));

  -- 3. Refusals: no result, nothing picked
  res := kit_task_scan(v_ts, v_ts_bin, 'p2@test.local');
  out := out || pg_temp.chk('scan before Accept: "Accept the task first", no result',
    pg_temp.answered(res, false, null) and res->>'message' = 'Accept the task first', res);
  res := kit_task_scan(gen_random_uuid(), v_ts_bin, 'p2@test.local');
  out := out || pg_temp.chk('unknown task: "Task not found"',
    pg_temp.answered(res, false, null) and res->>'message' = 'Task not found', res);
  res := kit_accept_task(v_bt, 'p1@test.local');
  out := out || pg_temp.chk('P1 accepts the BIB task', (res->>'ok')::boolean, res);
  res := kit_accept_task(v_ts, 'p2@test.local');
  out := out || pg_temp.chk('P2 accepts the T-shirt task', (res->>'ok')::boolean, res);
  res := kit_accept_task(v_pk, 'p3@test.local');
  out := out || pg_temp.chk('P3 accepts the pack task', (res->>'ok')::boolean, res);
  res := kit_task_scan(v_ts, v_ts_bin, 'p1@test.local');
  out := out || pg_temp.chk('another picker''s task: "Accept the task first"',
    pg_temp.answered(res, false, null) and res->>'message' = 'Accept the task first', res);
  out := out || pg_temp.chk('the refused scans picked nothing',
    not exists (select 1 from kit_order_lines
                where order_id = v_order and (opened_at is not null or picked_at is not null)), null);

  -- 4. T-shirt task (P2)
  res := kit_task_scan(v_ts, 'TST-S1', 'p2@test.local');
  out := out || pg_temp.chk('own pigeonhole before picking: "Pick everything first"',
    pg_temp.answered(res, false, 'not-all-picked') and res->>'message' = 'Pick everything first', res);
  res := kit_task_scan(v_ts, 'TST-S2', 'p2@test.local');
  out := out || pg_temp.chk('another pigeonhole: "Wrong pigeonhole: TST-S2", goes in TST-S1',
    pg_temp.answered(res, false, 'wrong-pigeonhole') and res->>'message' = 'Wrong pigeonhole: TST-S2'
    and res->>'hint' = 'This task goes in TST-S1.', res);
  res := kit_task_scan(v_ts, 'PACK', 'p2@test.local');
  out := out || pg_temp.chk('a bin of another task: "Wrong bin: PACK"',
    pg_temp.answered(res, false, 'wrong-bin') and res->>'message' = 'Wrong bin: PACK', res);
  res := kit_task_scan(v_ts, v_bib, 'p2@test.local');
  out := out || pg_temp.chk('a BIB on the T-shirt task: wrong bin', pg_temp.answered(res, false, 'wrong-bin'), res);
  res := kit_task_scan(v_ts, lower(v_ts_bin), 'p2@test.local');
  out := out || pg_temp.chk('T-shirt bin label (lower case) picks it: "Picked 1 × size …"',
    pg_temp.answered(res, true, 'picked') and res->>'message' = 'Picked 1 × size ' || v_size || ' from ' || v_ts_bin, res);
  out := out || pg_temp.chk('T-shirt line opened and picked',
    (select bool_and(opened_at is not null and picked_at is not null) from kit_order_lines where task_id = v_ts), null);
  res := kit_task_scan(v_ts, v_ts_bin, 'p2@test.local');
  out := out || pg_temp.chk('the same bin again: "Bin … is already picked"',
    pg_temp.answered(res, false, 'already') and res->>'message' = 'Bin ' || v_ts_bin || ' is already picked', res);
  res := kit_task_scan(v_ts, ' tst-s1 ', 'p2@test.local');
  out := out || pg_temp.chk('own pigeonhole (spaces, lower case): "Task done", order not ready yet',
    pg_temp.answered(res, true, 'done') and res->>'message' = 'Task done' and not (res->>'orderReady')::boolean, res);
  out := out || pg_temp.chk('T-shirt task done, P2 free for the next one',
    (select status from kit_tasks where id = v_ts) = 'done'
    and (select current_task_id is null from kit_pickers where event_id = ev and email = 'p2@test.local'), null);
  res := kit_task_scan(v_ts, 'TST-S1', 'p2@test.local');
  out := out || pg_temp.chk('own pigeonhole again on the done task: "Task done"',
    pg_temp.answered(res, true, 'done') and res->>'message' = 'Task done', res);
  res := kit_task_scan(v_ts, v_ts_bin, 'p2@test.local');
  out := out || pg_temp.chk('anything else on the done task: refused', pg_temp.answered(res, false, null), res);
  out := out || pg_temp.chk('order still picking (BIB and pack left)',
    (select status from kit_orders where id = v_order) = 'picking', null);

  -- 5. Pack task (P3)
  res := kit_task_scan(v_pk, 'pack', 'p3@test.local');
  out := out || pg_temp.chk('PACK label picks it: "Picked 1 pack from PACK"',
    pg_temp.answered(res, true, 'picked') and res->>'message' = 'Picked 1 pack from PACK', res);
  res := kit_task_scan(v_pk, 'TST-S1', 'p3@test.local');
  out := out || pg_temp.chk('pack task put away', pg_temp.answered(res, true, 'done'), res);

  -- 6. BIB task (P1)
  res := kit_task_scan(v_bt, v_bib, 'p1@test.local');
  out := out || pg_temp.chk('BIB before its bin: "Scan the bin label first"',
    pg_temp.answered(res, false, 'bin-first') and res->>'message' = 'Scan the bin label first'
    and res->>'hint' = 'Bin ' || v_bib_bin || ', then BIB ' || v_bib || '.', res);
  res := kit_task_scan(v_bt, 'NOT-IN-ORDER', 'p1@test.local');
  out := out || pg_temp.chk('unknown code, no bin open yet: wrong bin', pg_temp.answered(res, false, 'wrong-bin'), res);
  res := kit_task_scan(v_bt, v_bib_bin, 'p1@test.local');
  out := out || pg_temp.chk('BIB bin label opens it: "Bin … open"',
    pg_temp.answered(res, true, 'opened') and res->>'message' = 'Bin ' || v_bib_bin || ' open', res);
  out := out || pg_temp.chk('BIB line opened, not picked yet',
    (select opened_at is not null and picked_at is null from kit_order_lines where task_id = v_bt), null);
  res := kit_task_scan(v_bt, 'TST-S1', 'p1@test.local');
  out := out || pg_temp.chk('own pigeonhole with the BIB still to pick: "Pick everything first"',
    pg_temp.answered(res, false, 'not-all-picked'), res);
  res := kit_task_scan(v_bt, 'NOT-IN-ORDER', 'p1@test.local');
  out := out || pg_temp.chk('unknown code with the bin open: "Wrong BIB: NOT-IN-ORDER"',
    pg_temp.answered(res, false, 'wrong-bib') and res->>'message' = 'Wrong BIB: NOT-IN-ORDER', res);
  res := kit_task_scan(v_bt, 'TST-L1', 'p1@test.local');
  out := out || pg_temp.chk('another pigeonhole with the bin open: still wrong pigeonhole',
    pg_temp.answered(res, false, 'wrong-pigeonhole'), res);
  res := kit_task_scan(v_bt, v_bib, 'p1@test.local');
  out := out || pg_temp.chk('the BIB picks it: "BIB … picked"',
    pg_temp.answered(res, true, 'bib') and res->>'message' = 'BIB ' || v_bib || ' picked', res);
  res := kit_task_scan(v_bt, v_bib, 'p1@test.local');
  out := out || pg_temp.chk('the same BIB again: already picked', pg_temp.answered(res, false, 'already'), res);
  res := kit_task_scan(v_bt, v_bib_bin, 'p1@test.local');
  out := out || pg_temp.chk('the BIB bin again: already picked', pg_temp.answered(res, false, 'already'), res);
  res := kit_task_scan(v_bt, 'TST-S1', 'p1@test.local');
  out := out || pg_temp.chk('last task put away: "Task done", order ready',
    pg_temp.answered(res, true, 'done') and (res->>'orderReady')::boolean, res);

  -- 7. The order waits at the desk
  out := out || pg_temp.chk('order turned Ready',
    (select status = 'ready' and ready_at is not null from kit_orders where id = v_order), null);
  out := out || pg_temp.chk('every line of the order done',
    not exists (select 1 from kit_order_lines where order_id = v_order and status <> 'done'), null);
  out := out || pg_temp.chk('P1, P2 and P3 free for the next task',
    not exists (select 1 from kit_pickers
                where event_id = ev and email like 'p_@test.local' and current_task_id is not null), null);

  fails := (length(out) - length(replace(out, E'\nFAIL ', ''))) / length(E'\nFAIL ');
  raise exception 'TEST REPORT: % failed (everything rolled back)%', fails, out;
end $$;
```

- [ ] **Step 3: Check that only the two new files changed under `supabase/`**

Run: `git status --short supabase/`
Expected: exactly
```
?? supabase/migrations/0035_task_scan.sql
?? supabase/tests/0035_task_scan_test.sql
```

- [ ] **Step 4: Hand over to the user and wait**

Tell the user: "Please apply `supabase/migrations/0035_task_scan.sql` in the Supabase SQL editor (it only adds a function; it is safe to apply any time). Then run `supabase/tests/0035_task_scan_test.sql` while nobody is picking, and paste the error it raises."
Expected report: `TEST REPORT: 0 failed (everything rolled back)` followed by 38 PASS lines.
If a line FAILs, find the cause. If it's in the test, fix the test and ask the user to run it again. If it's in the migration, 0035 is now applied and frozen: write the fix as a new migration (0036, `create or replace function kit_task_scan ...`), with the test updated to match. Don't start Task 2 until the report says 0 failed.

- [ ] **Step 5: Commit (ask the user first)**

Ask: "OK to commit the 0035 migration and its test?" Only on a yes:
```bash
git add supabase/migrations/0035_task_scan.sql supabase/tests/0035_task_scan_test.sql
git commit -m "Volunteer assignments 0035: kit_task_scan, one action for every scan during a task" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Picker bins carry the T-shirt size; the scan result type

**Files:**
- Modify: `src/lib/expo.ts` (header comment, `PickerBin`, after `PickerState`, `loadPickerState`)

- [ ] **Step 1: Header comment**

Find:
```ts
 *  - picker: item kinds, sizes, BIB numbers, bin and crate labels. No names at all, and a
 *            line's size/BIB only once its source bin has been scanned (opened_at set).
```
Replace with:
```ts
 *  - picker: item kinds, sizes, BIB numbers, bin and crate labels. No names at all, and a
 *            line's size/BIB only once its source bin has been scanned (opened_at set). A T-shirt
 *            bin's size shows from the start: its code (TS-M) says it anyway.
```

- [ ] **Step 2: `size` on `PickerBin`**

Find:
```ts
export interface PickerBin {
  code: string;
  count: number;
```
Replace with:
```ts
export interface PickerBin {
  code: string;
  /** T-shirt bins: the size, from the start (the code TS-M already says it). null otherwise. */
  size: string | null;
  count: number;
```

- [ ] **Step 3: `TaskScanResult`**

Find:
```ts
  /** Tasks waiting for any picker (shown so an idle picker knows the floor is quiet). */
  queued: number;
}
```
Replace with:
```ts
  /** Tasks waiting for any picker (shown so an idle picker knows the floor is quiet). */
  queued: number;
}

/**
 * What one scan during a task did (kit_task_scan, 0035). picked / opened / bib / done moved the
 * task on (ok); already / bin-first / not-all-picked are warnings; wrong-* are wrong scans. A
 * refusal (task not found, not accepted) has no result.
 */
export type TaskScanResult =
  | "picked"
  | "opened"
  | "bib"
  | "done"
  | "already"
  | "bin-first"
  | "not-all-picked"
  | "wrong-pigeonhole"
  | "wrong-bib"
  | "wrong-bin";
```

- [ ] **Step 4: Fill `size` in `loadPickerState`**

Find:
```ts
    const bin = bins.get(l.bin_code) ?? { code: l.bin_code, count: 0, picked: 0, opened: false, empty: false, lines: [] };
```
Replace with:
```ts
    const bin = bins.get(l.bin_code) ?? {
      code: l.bin_code,
      size: task.kind === "tshirt" ? l.size : null,
      count: 0,
      picked: 0,
      opened: false,
      empty: false,
      lines: [],
    };
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no output. (`PickerBin` is only built here. `PickerStation` only reads it.)

---

### Task 3: The expo API's `task-scan` action

**Files:**
- Modify: `src/app/api/admin/kit/expo/route.ts`

- [ ] **Step 1: Header comment**

Find:
```ts
 * the station or specialties their screen sends are ignored. Admins are not restricted.
 */
```
Replace with:
```ts
 * the station or specialties their screen sends are ignored. Admins are not restricted.
 * Every scan during a picker's task goes to task-scan (kit_task_scan, 0035), one call per scan. pick-bin, pick-item and
 * put-away stay so a phone still on the old screen keeps working; the new screen doesn't use them.
 */
```

- [ ] **Step 2: The body schema**

Find:
```ts
  z.object({ action: z.literal("put-away"), taskId: uuid, crate: code }),
```
Replace with:
```ts
  z.object({ action: z.literal("put-away"), taskId: uuid, crate: code }),
  z.object({ action: z.literal("task-scan"), taskId: uuid, code }),
```

- [ ] **Step 3: Pickers may call it**

Find:
```ts
  "put-away",
  "bin-empty",
]);
```
Replace with:
```ts
  "put-away",
  "task-scan",
  "bin-empty",
]);
```

- [ ] **Step 4: The case**

Find:
```ts
    case "put-away":
      return rpc("kit_put_away", { p_task: body.taskId, p_crate: body.crate, p_email: email });
```
Replace with:
```ts
    case "put-away":
      return rpc("kit_put_away", { p_task: body.taskId, p_crate: body.crate, p_email: email });

    case "task-scan":
      // Answers {ok, result, message, hint}; the screen builds its alert from it (0035).
      return rpc("kit_task_scan", { p_task: body.taskId, p_code: body.code, p_email: email });
```

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit -p .` then `npx eslint src/app/api/admin/kit/expo/route.ts src/lib/expo.ts`
Expected: no output from either.

- [ ] **Step 6: Commit the server side (ask the user first)**

Ask: "OK to commit the Part 2 server changes (task-scan action, T-shirt bin size)?" Only on a yes:
```bash
git add src/lib/expo.ts src/app/api/admin/kit/expo/route.ts
git commit -m "Volunteer assignments: task-scan action; picker bins carry the T-shirt size" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Shared camera hook and the new alert

**Files:**
- Create: `src/app/(app)/admin/(protected)/kit/useBarcodeCamera.ts`
- Modify: `src/app/(app)/admin/(protected)/kit/CameraScanner.tsx` (whole file below)
- Modify: `src/app/(app)/admin/(protected)/kit/ScanInput.tsx` (whole file below)
- Modify: `src/app/(app)/admin/(protected)/kit/picker/PickerStation.tsx` (one line; Task 8 replaces the file)

- [ ] **Step 1: Write the hook**

`src/app/(app)/admin/(protected)/kit/useBarcodeCamera.ts`:

```ts
"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/*
 * Reads QR codes (passes, pigeonhole and bin labels) and 1D barcodes (BIBs) from the phone camera
 * into a <video>. Shared by the full-screen CameraScanner (desk, handover, restock and the other
 * scan fields) and the picker's inline TaskCamera. Uses the browser's built-in BarcodeDetector
 * where it exists (Android Chrome) and otherwise the barcode-detector ponyfill (zxing
 * WebAssembly), which is what iPhones need. The .wasm file is served from /vendor (no CDN), named
 * by its version so a library upgrade that forgets to copy it fails loudly instead of loading a
 * mismatched file.
 *
 * Cameras only work on HTTPS (or localhost): on a plain-http LAN address the error says so.
 */

const FORMATS = ["qr_code", "code_128", "code_39", "code_93", "ean_13", "ean_8", "upc_a", "itf"] as const;
/** The same code seen again within this window is ignored (the camera sees it many times a second). */
const REPEAT_MS = 2500;

type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };

let detectorPromise: Promise<Detector> | null = null;

function getDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const Native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } })
      .BarcodeDetector;
    if (Native) {
      try {
        const supported = await Native.getSupportedFormats();
        if (supported.includes("qr_code")) {
          return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
        }
      } catch {
        // fall through to the ponyfill
      }
    }
    const { BarcodeDetector, prepareZXingModule, ZXING_WASM_VERSION } = await import("barcode-detector/ponyfill");
    prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith(".wasm") ? `/vendor/zxing_reader-${ZXING_WASM_VERSION}.wasm` : prefix + path,
      },
    });
    return new BarcodeDetector({ formats: [...FORMATS] }) as unknown as Detector;
  })();
  // A failed load (e.g. offline) may be retried next time a camera opens.
  detectorPromise.catch(() => {
    detectorPromise = null;
  });
  return detectorPromise;
}

function cameraError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (typeof window !== "undefined" && !window.isSecureContext) return "The camera only works on the https:// site.";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera access is blocked. Allow the camera for this site in your browser settings, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera found on this device.";
  if (name === "NotReadableError") return "The camera is in use by another app. Close it and try again.";
  return "Couldn't start the camera. Type the code instead.";
}

/**
 * Starts the back camera into `videoRef` and calls `onDetect` with each new code. The next frame
 * is read only after onDetect's promise settles, so a slow scan never overlaps the next one.
 * `once`: stop reading after the first code. `onError`: the camera couldn't start (the message
 * says why, in words for the volunteer). The camera stops on unmount, even while still starting.
 */
export function useBarcodeCamera(
  videoRef: RefObject<HTMLVideoElement | null>,
  onDetect: (value: string) => void | Promise<void>,
  { once = false, onError }: { once?: boolean; onError?: (message: string) => void } = {}
): { starting: boolean; error: string | null } {
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onDetectRef = useRef(onDetect);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onDetectRef.current = onDetect;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const seen = new Map<string, number>();
    const stopStream = () => {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("no media"), { name: "NotFoundError" });
        // The detector loads while the camera starts.
        const detectorReady = getDetector();
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        // Kept the moment it arrives, so it can always be stopped. Closed while the camera was still
        // starting: stop it now, or the camera stays on (the old leak).
        stream = s;
        if (stopped) {
          stopStream();
          return;
        }
        const detector = await detectorReady;
        const video = videoRef.current;
        if (stopped || !video) {
          stopStream();
          return;
        }
        video.srcObject = s;
        await video.play();
        if (stopped) return;
        setStarting(false);

        const tick = async () => {
          if (stopped) return;
          try {
            if (video.readyState >= 2) {
              const found = await detector.detect(video);
              const value = found.map((f) => f.rawValue.trim()).find(Boolean);
              const now = Date.now();
              if (value && now - (seen.get(value) ?? 0) > REPEAT_MS) {
                seen.set(value, now);
                navigator.vibrate?.(60);
                await onDetectRef.current(value);
                if (once) return;
              }
            }
          } catch {
            // A frame that can't be read is skipped.
          }
          if (!stopped) timer = setTimeout(tick, 120);
        };
        void tick();
      } catch (e) {
        stopStream();
        if (!stopped) {
          const message = cameraError(e);
          setStarting(false);
          setError(message);
          onErrorRef.current?.(message);
        }
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stopStream();
    };
  }, [videoRef, once]);

  return { starting, error };
}
```

- [ ] **Step 2: Replace `CameraScanner.tsx` with:**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Icon } from "@/components/ds";
import { useBarcodeCamera } from "./useBarcodeCamera";

/*
 * Full-screen phone-camera scanner: reads one code, hands it to the screen, then closes. Opened by
 * the camera button of a scan field (ScanInput). The detection lives in useBarcodeCamera, shared
 * with the picker's inline task camera.
 */

export default function CameraScanner({
  title,
  onDetect,
  onClose,
}: {
  title: string;
  /** Called with the code read. The scanner closes once it has finished. */
  onDetect: (value: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [last, setLast] = useState<string | null>(null);
  const { starting, error } = useBarcodeCamera(
    videoRef,
    async (value) => {
      setLast(value);
      await onDetect(value);
      onClose();
    },
    { once: true }
  );
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[300] flex flex-col bg-black">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <p className="min-w-0 truncate text-16 font-semibold">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close camera"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
        >
          <Icon name="close" size={22} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[58vmin] w-[78vmin] max-w-[420px] rounded-12 border-4 border-white/90 shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]" />
          </div>
        )}
        {starting && !error && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-16 text-white">Starting camera…</p>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <Icon name="warning" size={32} className="text-[#FDB022]" />
            <p className="max-w-sm text-16 text-white">{error}</p>
            <Button variant="outline" onClick={onClose} className="h-12! px-6!">
              Type it instead
            </Button>
          </div>
        )}
      </div>

      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-center text-white">
        {last ? (
          <p className="text-14">
            Scanned <span className="font-mono font-semibold">{last}</span>
          </p>
        ) : (
          <p className="text-14 text-white/80">Hold the code inside the frame</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace `ScanInput.tsx` with:**

```tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ds";
import CameraScanner from "./CameraScanner";

/** Touch-first device (phone / tablet): focusing a field would pop the keyboard over the screen. */
export function isTouchFirst() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

/**
 * One-line scan field. USB / Bluetooth scanners type the code and press Enter, so this works
 * with a ₹1–2k scanner or by typing; the camera button scans one code with the phone camera.
 * On a laptop it re-focuses itself after every scan so the volunteer never has to click it;
 * on a phone it doesn't (that would keep popping the keyboard up).
 */
export default function ScanInput({
  label,
  onScan,
  disabled,
  placeholder = "Scan or type, then Enter",
}: {
  label: string;
  onScan: (value: string) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [camera, setCamera] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!disabled && !isTouchFirst()) ref.current?.focus();
  }, [disabled]);

  async function submit(raw: string) {
    const v = raw.trim();
    if (!v) return;
    setValue("");
    await onScan(v);
    if (!isTouchFirst()) ref.current?.focus();
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(value);
        }}
      >
        <label htmlFor={id} className="block text-14 font-medium text-ink-secondary">
          {label}
        </label>
        <div className="mt-1.5 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Icon
              name="scan"
              size={22}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              id={id}
              ref={ref}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={disabled}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="go"
              placeholder={placeholder}
              className="h-12 w-full rounded-6 border border-line bg-white pl-12 pr-4 font-mono text-20 tracking-wide text-ink outline-hidden placeholder:font-sans placeholder:text-16 placeholder:tracking-normal placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:bg-surface-tertiary disabled:text-ink-muted"
            />
          </div>
          <button
            type="button"
            onClick={() => setCamera(true)}
            disabled={disabled}
            aria-label={`${label}: scan with camera`}
            title="Scan with camera"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-6 border border-dark bg-dark text-white hover:bg-ink disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-tertiary disabled:text-ink-disabled"
          >
            <Icon name="qr" size={22} />
          </button>
        </div>
      </form>
      {camera && <CameraScanner title={label} onDetect={(v) => submit(v)} onClose={() => setCamera(false)} />}
    </>
  );
}

/** The older result shape: the counter, pick & pack, handover, restock, floor and exceptions screens still use it. */
export type Banner = { ok: boolean; text: string } | null;

export type AlertTone = "error" | "warn" | "note" | "done";
/** An alert on a volunteer screen: what happened (title), then at most one line on what to do now. */
export type Alert = { tone: AlertTone; title: string; text?: string };

/**
 * An API message as an alert. Messages put what happened before ": " and what to do after it, so
 * "No items assigned yet: ask the supervisor" becomes that title with "Ask the supervisor" under
 * it. ok gives green, otherwise red: callers change the tone where the spec says amber or blue.
 */
export function alertFrom(ok: boolean, message: string): Alert {
  const tone: AlertTone = ok ? "done" : "error";
  const at = message.indexOf(": ");
  if (at < 0) return { tone, title: message };
  const rest = message.slice(at + 2);
  return { tone, title: message.slice(0, at), text: rest.charAt(0).toUpperCase() + rest.slice(1) };
}

const TONES: Record<AlertTone, { box: string; icon: IconName; iconColor: string; title: string; role: "alert" | "status" }> = {
  error: {
    box: "border border-[#FDA29B] border-l-[5px] border-l-[#D92D20] bg-tint-red text-on-tint-red",
    icon: "xCircle",
    iconColor: "text-[#D92D20]",
    title: "text-18",
    role: "alert",
  },
  warn: {
    box: "border border-[#FEDF89] border-l-[5px] border-l-[#F79009] bg-[#FFFAEB] text-[#93370D]",
    icon: "alert",
    iconColor: "text-[#DC6803]",
    title: "text-16",
    role: "alert",
  },
  note: {
    box: "border-l-[5px] border-l-[#1570EF] bg-[#EFF8FF] text-on-tint-blue",
    icon: "info",
    iconColor: "text-[#1570EF]",
    title: "text-16",
    role: "status",
  },
  done: {
    box: "border-l-[5px] border-l-[#079455] bg-tint-green text-on-tint-green",
    icon: "checkCircle",
    iconColor: "text-[#079455]",
    title: "text-16",
    role: "status",
  },
};

/**
 * The one alert on every volunteer screen (docs/volunteer-assignments-design.md §4.3): an icon, a
 * bold title, at most one line under it. Red = a wrong scan (larger title), amber = a warning,
 * blue = a note, green = done. A green Alert hides itself after 3 s; red and amber stay until the
 * screen replaces them. onDismiss adds a × (assignment notes). The older {ok, text} shape still
 * works: green or red, title only, and it never hides itself (pick & pack's "READY. Shelf …"
 * must stay on screen).
 */
export function ResultBanner({
  banner,
  onDismiss,
  className = "",
}: {
  banner: Banner | Alert;
  onDismiss?: () => void;
  className?: string;
}) {
  // Keyed on the object: the same words shown again later are a new alert.
  const [hidden, setHidden] = useState<Alert | null>(null);
  const fading = banner && "tone" in banner && banner.tone === "done" ? banner : null;
  useEffect(() => {
    if (!fading) return;
    const timer = setTimeout(() => setHidden(fading), 3000);
    return () => clearTimeout(timer);
  }, [fading]);
  if (!banner || banner === hidden) return null;

  const alert: Alert = "tone" in banner ? banner : { tone: banner.ok ? "done" : "error", title: banner.text };
  const t = TONES[alert.tone];
  return (
    <div role={t.role} className={`flex items-start gap-3 rounded-12 px-3 py-3 ${t.box} ${className}`}>
      <Icon name={t.icon} size={22} className={`mt-px shrink-0 ${t.iconColor}`} />
      <div className="min-w-0 flex-1 break-words">
        <p className={`font-bold ${t.title}`}>{alert.title}</p>
        {alert.text && <p className="mt-0.5 text-14 text-ink">{alert.text}</p>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="-mr-1 shrink-0 px-1 text-20 leading-none">
          ×
        </button>
      )}
    </div>
  );
}

export async function postKit<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T & { ok: boolean; message?: string }> {
  try {
    const res = await fetch("/api/admin/kit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) return { ok: false, message: "Signed out: reload and sign in again" } as never;
    if (res.status === 403) return { ok: false, message: "Your role can't do that" } as never;
    if (!res.ok && json.error) return { ok: false, message: json.error } as never;
    return json;
  } catch {
    return { ok: false, message: "No connection: try again" } as never;
  }
}
```

- [ ] **Step 4: Interim edit so the old picker screen still compiles**

In `src/app/(app)/admin/(protected)/kit/picker/PickerStation.tsx`, find:
```tsx
          <ScanInput label={label} onScan={onScan} disabled={busy} continuous feedback={banner} />
```
Replace with:
```tsx
          <ScanInput label={label} onScan={onScan} disabled={busy} />
```
(Task 8 replaces the whole file. This only keeps `tsc` clean in between.)

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit -p .` then `npx eslint "src/app/(app)/admin/(protected)/kit/useBarcodeCamera.ts" "src/app/(app)/admin/(protected)/kit/CameraScanner.tsx" "src/app/(app)/admin/(protected)/kit/ScanInput.tsx"`
Expected: no output from either.

---

### Task 5: The task as steps

**Files:**
- Create: `src/app/(app)/admin/(protected)/kit/picker/steps.ts`

- [ ] **Step 1: Write the module**

```ts
import type { ExpoKind, PickerBin, PickerLine, PickerTask } from "@/lib/expo";

/*
 * A picker's task as single steps (docs/volunteer-assignments-design.md §4.1). The task screen
 * shows only the first step not done yet. A scan that finishes a later step still counts, and that
 * step is skipped when its turn comes. T-shirts and packs: one step per bin (take, then scan the
 * bin label, which picks them). BIBs: open the bin, then one step per BIB. Last: the pigeonhole.
 */

export type Step =
  | { type: "take"; bin: PickerBin; done: boolean }
  | { type: "open"; bin: PickerBin; done: boolean }
  | { type: "bib"; bin: PickerBin; line: PickerLine; done: boolean }
  | { type: "drop"; done: false };

export function taskSteps(task: PickerTask): Step[] {
  const steps: Step[] = [];
  for (const bin of task.bins) {
    if (task.kind === "bib") {
      steps.push({ type: "open", bin, done: bin.opened });
      for (const line of bin.lines) steps.push({ type: "bib", bin, line, done: line.picked });
    } else {
      steps.push({ type: "take", bin, done: bin.picked === bin.count });
    }
  }
  steps.push({ type: "drop", done: false });
  return steps;
}

/** The step on screen: the first one not done (the pigeonhole, once everything is picked). */
export function currentStep(steps: Step[]): Step {
  return steps.find((s) => !s.done) ?? steps[steps.length - 1];
}

const NOUN: Record<ExpoKind, [string, string]> = {
  bib: ["BIB", "BIBs"],
  tshirt: ["T-shirt", "T-shirts"],
  pack: ["pack", "packs"],
};

/** "1 T-shirt", "3 BIBs", "2 packs". */
export function itemCount(kind: ExpoKind, n: number): string {
  return `${n} ${NOUN[kind][n === 1 ? 0 : 1]}`;
}

/** What to take from a T-shirt or pack bin: "1 × size M", "2 packs". */
export function takeWhat(kind: ExpoKind, bin: PickerBin): string {
  const left = bin.count - bin.picked;
  return kind === "tshirt" ? `${left} × size ${bin.size ?? "?"}` : itemCount(kind, left);
}

/** The line across the top of the camera: what to point it at now. */
export function cameraLine(task: PickerTask, step: Step): string {
  switch (step.type) {
    case "take":
      return `Take ${takeWhat(task.kind, step.bin)}, then scan the label on bin ${step.bin.code}`;
    case "open":
      return `Scan the label on bin ${step.bin.code}`;
    case "bib":
      return `Take BIB ${step.line.bib ?? "?"}, then scan it`;
    case "drop":
      return `Scan the label on pigeonhole ${task.crate ?? ""}`;
  }
}

/**
 * The pinned progress bar. It counts finished steps, so a scan that skips ahead still moves it.
 * label: "Step 2 of 3"; picked: "1 of 2 T-shirts picked".
 */
export function progress(task: PickerTask, steps: Step[]) {
  const done = steps.filter((s) => s.done).length;
  const picked = task.bins.reduce((n, b) => n + b.picked, 0);
  const count = task.bins.reduce((n, b) => n + b.count, 0);
  return {
    done,
    total: steps.length,
    label: `Step ${Math.min(done + 1, steps.length)} of ${steps.length}`,
    picked: `${picked} of ${itemCount(task.kind, count)} picked`,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no output.

---

### Task 6: The inline task camera

**Files:**
- Create: `src/app/(app)/admin/(protected)/kit/picker/TaskCamera.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useRef } from "react";
import { ResultBanner, type Alert } from "../ScanInput";
import { useBarcodeCamera } from "../useBarcodeCamera";

/**
 * The top of the picker's task screen: a live camera that keeps reading for the whole task. Across
 * its top edge: what to scan now. Over its bottom edge: the last scan's result, where the picker is
 * looking. "Camera off" folds it away (TaskScreen remembers the choice on this phone).
 */
export default function TaskCamera({
  line,
  alert,
  onScan,
  onOff,
  onError,
}: {
  line: string;
  alert: Alert | null;
  onScan: (code: string) => Promise<void>;
  onOff: () => void;
  /** The camera can't start (blocked, missing, not https): TaskScreen folds it away and says why. */
  onError: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { starting } = useBarcodeCamera(videoRef, onScan, { onError });

  return (
    <div className="relative h-[55dvh] overflow-hidden rounded-12 bg-black text-white">
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[30dvh] max-h-[260px] w-[70%] max-w-[300px] rounded-12 border-4 border-white/90" />
      </div>
      {starting && <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-16">Starting camera…</p>}
      <div className="absolute inset-x-0 top-0 flex items-start gap-3 bg-black/60 px-3 py-2.5">
        <p className="min-w-0 flex-1 text-16 font-semibold">{line}</p>
        <button
          type="button"
          onClick={onOff}
          className="shrink-0 rounded-8 bg-white/20 px-2.5 py-1 text-12 font-medium hover:bg-white/30"
        >
          Camera off
        </button>
      </div>
      {alert && (
        <div className="absolute inset-x-2.5 bottom-2.5">
          <ResultBanner banner={alert} className="shadow-[0_6px_18px_rgba(0,0,0,0.4)]" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no output.

---

### Task 7: The task screen

**Files:**
- Create: `src/app/(app)/admin/(protected)/kit/picker/TaskScreen.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Button, Icon, StatusPill } from "@/components/ds";
import type { PickerBin, PickerTask } from "@/lib/expo";
import { ResultBanner, isTouchFirst, type Alert } from "../ScanInput";
import TaskCamera from "./TaskCamera";
import { cameraLine, currentStep, progress, takeWhat, taskSteps, type Step } from "./steps";

// "Camera off" is remembered on this phone (localStorage), read through useSyncExternalStore.
const CAMERA_KEY = "tgcg.picker.camera";
const CAMERA_EVENT = "tgcg-picker-camera";
function subscribeCamera(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CAMERA_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CAMERA_EVENT, onChange);
  };
}
const readCameraOff = () => window.localStorage.getItem(CAMERA_KEY) === "off";
function saveCameraOff(off: boolean) {
  if (off) window.localStorage.setItem(CAMERA_KEY, "off");
  else window.localStorage.removeItem(CAMERA_KEY);
  window.dispatchEvent(new Event(CAMERA_EVENT));
}

/**
 * The picker's screen during an accepted task (docs/volunteer-assignments-design.md §4.1). Top,
 * over half the screen: the live camera with what to scan now, and under it a box to type a code
 * (it also takes a hardware scanner). Below: one step at a time, then a progress bar pinned to the
 * bottom. Every scan (camera, typed or hardware) goes to onScan: one server action per scan.
 */
export default function TaskScreen({
  task,
  alert,
  note,
  onDismissNote,
  connError,
  busy,
  onScan,
  onBinEmpty,
  onGiveBack,
}: {
  task: PickerTask;
  /** The last scan's result (or another action's): over the camera's bottom edge. */
  alert: Alert | null;
  /** An assignment change (0033), until dismissed. */
  note: Alert | null;
  onDismissNote: () => void;
  connError: boolean;
  busy: boolean;
  /** Sends one scan. Resolves true when it moved the task on (a green answer). */
  onScan: (code: string) => Promise<boolean>;
  onBinEmpty: (bin: PickerBin) => void;
  onGiveBack: () => void;
}) {
  const cameraOff = useSyncExternalStore(subscribeCamera, readCameraOff, () => true);
  // Why the camera couldn't start (blocked, missing, not https), shown in its place.
  const [problem, setProblem] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  // Codes that already did their job in this task (a bin or BIB picked). The camera keeps seeing a
  // label after it is scanned: those repeats are dropped instead of showing "already picked".
  const usedCodes = useRef(new Set<string>());

  // A laptop with a hardware scanner types straight into the box. (On a phone, focusing it would
  // pop the keyboard up.)
  useEffect(() => {
    if (!isTouchFirst()) inputRef.current?.focus();
  }, []);

  const steps = taskSteps(task);
  const step = currentStep(steps);
  const p = progress(task, steps);
  const showCamera = !cameraOff && problem === null;

  async function scan(raw: string, fromCamera: boolean) {
    const value = raw.trim().toUpperCase();
    if (!value || (fromCamera && usedCodes.current.has(value))) return;
    if (await onScan(value)) usedCodes.current.add(value);
  }

  return (
    <div className="flex flex-col gap-3">
      <section>
        {showCamera ? (
          <TaskCamera
            line={cameraLine(task, step)}
            alert={alert}
            onScan={(v) => scan(v, true)}
            onOff={() => saveCameraOff(true)}
            onError={setProblem}
          />
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-12 bg-surface-tertiary px-3 py-2.5">
            <p className="min-w-0 text-14 font-medium text-ink-tertiary">{problem ?? "Camera off: type the code below"}</p>
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => {
                setProblem(null);
                saveCameraOff(false);
              }}
            >
              Turn camera on
            </Button>
          </div>
        )}
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const typed = code;
            setCode("");
            void scan(typed, false).then(() => {
              if (!isTouchFirst()) inputRef.current?.focus();
            });
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            Code
          </label>
          <input
            id={inputId}
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="Camera can't read it? Type the code"
            className="h-12 min-w-0 flex-1 rounded-6 border border-line bg-white px-3 font-mono text-18 uppercase tracking-wide text-ink outline-hidden placeholder:font-sans placeholder:text-14 placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
          <Button type="submit" variant="dark" className="h-12! px-5!">
            Enter
          </Button>
        </form>
        {!showCamera && <ResultBanner banner={alert} className="mt-2" />}
      </section>

      <ResultBanner banner={note} onDismiss={onDismissNote} />
      {connError && (
        <p>
          <StatusPill tone="expired">Connection problem: retrying</StatusPill>
        </p>
      )}
      <StepCard task={task} step={step} busy={busy} onBinEmpty={onBinEmpty} onGiveBack={onGiveBack} />

      <div className="sticky bottom-0 z-10 -mx-3 border-t border-line-secondary bg-white px-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-2.5 text-14 text-ink-tertiary">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="font-semibold text-ink">{p.label}</span>
          <span>
            {p.picked} · {task.orderCode} → <span className="font-mono font-semibold text-ink">{task.crate ?? "—"}</span>
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Task progress"
          aria-valuemin={0}
          aria-valuemax={p.total}
          aria-valuenow={p.done}
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-tertiary"
        >
          <div
            className="h-full rounded-full bg-[#079455] transition-[width] duration-300"
            style={{ width: `${Math.round((p.done / p.total) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** One instruction in large type. When a scan finishes it, the next step replaces it. */
function StepCard({
  task,
  step,
  busy,
  onBinEmpty,
  onGiveBack,
}: {
  task: PickerTask;
  step: Step;
  busy: boolean;
  onBinEmpty: (bin: PickerBin) => void;
  onGiveBack: () => void;
}) {
  if (step.type === "drop") {
    return (
      <>
        <section className="rounded-12 bg-tint-green px-4 py-3.5 text-center">
          <p className="flex items-center justify-center gap-1 text-12 font-semibold uppercase tracking-wide text-on-tint-green">
            <Icon name="check" size={14} />
            All picked
          </p>
          <p className="mt-1.5 text-18 font-semibold text-ink">Drop everything in pigeonhole</p>
          {/* One exception to the Dock type scale: read at arm's length while carrying the items. */}
          <p className="my-1 break-all font-mono text-[56px] font-bold leading-[62px] text-on-tint-green">{task.crate ?? "—"}</p>
          <p className="text-14 text-ink-secondary">Then scan its label (or type it above) to finish.</p>
        </section>
        <Button onClick={onGiveBack} disabled={busy} className="h-11! w-full">
          Can&apos;t finish: give this task back
        </Button>
      </>
    );
  }

  const bin = step.bin;
  return (
    <>
      <section className="rounded-12 border-2 border-dark bg-white px-4 py-3.5">
        {step.type === "take" && (
          <>
            <p className="text-14 font-semibold text-ink-tertiary">Take</p>
            <p className="text-32 font-bold text-ink">{takeWhat(task.kind, bin)}</p>
            <p className="mt-0.5 text-16 text-ink-secondary">
              from bin <span className="break-all font-mono text-24 font-bold text-ink">{bin.code}</span>
            </p>
            <p className="mt-2 text-14 text-ink-secondary">
              Then scan the bin label: that picks {bin.count - bin.picked === 1 ? "it" : "them"}.
            </p>
          </>
        )}
        {step.type === "open" && (
          <>
            <p className="text-14 font-semibold text-ink-tertiary">Go to bin</p>
            <p className="break-all font-mono text-32 font-bold text-ink">{bin.code}</p>
            <p className="mt-2 text-14 text-ink-secondary">Scan its label to open it.</p>
          </>
        )}
        {step.type === "bib" && (
          <>
            <p className="text-14 font-semibold text-ink-tertiary">Take BIB</p>
            <p className="font-mono text-32 font-bold text-ink">{step.line.bib ?? "?"}</p>
            <p className="mt-0.5 text-16 text-ink-secondary">
              from bin <span className="break-all font-mono text-24 font-bold text-ink">{bin.code}</span>
            </p>
            <p className="mt-2 text-14 text-ink-secondary">Then scan the BIB itself.</p>
          </>
        )}
        {bin.empty && (
          <ResultBanner
            className="mt-3"
            banner={{ tone: "warn", title: "Bin marked empty", text: "Restock is on the way. Wait here or give the task back." }}
          />
        )}
      </section>
      <div className="grid grid-cols-2 gap-2">
        {!bin.empty && (
          <Button onClick={() => onBinEmpty(bin)} disabled={busy} className="h-11! text-[#B42318]!">
            Bin is empty
          </Button>
        )}
        <Button onClick={onGiveBack} disabled={busy} className={`h-11! ${bin.empty ? "col-span-2" : ""}`}>
          Give task back
        </Button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no output.

---

### Task 8: The picker screen uses task-scan and the task screen

**Files:**
- Modify: `src/app/(app)/admin/(protected)/kit/picker/PickerStation.tsx` (whole file below)

- [ ] **Step 1: Replace `PickerStation.tsx` with:**

```tsx
"use client";

import { useRef, useState } from "react";
import { Button, Card, Checkbox, Icon, StatusPill } from "@/components/ds";
import type { ExpoKind, PickerState, PickerTask, TaskScanResult } from "@/lib/expo";
import { ResultBanner, alertFrom, type Alert, type AlertTone } from "../ScanInput";
import { KIND_LABEL, buzz, chime, postExpo, useLatestReply, usePoll } from "../expo-client";
import TaskScreen from "./TaskScreen";
import { itemCount } from "./steps";

const ALL_KINDS: ExpoKind[] = ["bib", "tshirt", "pack"];

/** How serious each task-scan answer is (kit_task_scan, 0035; spec §4.3). */
const SCAN_TONE: Record<TaskScanResult, AlertTone> = {
  picked: "done",
  opened: "done",
  bib: "done",
  done: "done",
  already: "warn",
  "bin-first": "warn",
  "not-all-picked": "warn",
  "wrong-pigeonhole": "error",
  "wrong-bib": "error",
  "wrong-bin": "error",
};

type ScanAnswer = { ok: boolean; result?: TaskScanResult; message?: string; hint?: string | null };

/** A task-scan answer as an alert. No result: a refusal (task released, not accepted) or no connection. */
function scanAlert(res: ScanAnswer): Alert {
  if (res.result) return { tone: SCAN_TONE[res.result], title: res.message ?? "", text: res.hint ?? undefined };
  return { ...alertFrom(false, res.message ?? "Try again"), tone: "warn" };
}

/**
 * Phone screen for a warehouse picker. Active → tasks are offered here one at a time (60 s to
 * accept). Accepted → the task screen (TaskScreen): camera on top, one step at a time, every scan
 * sent to task-scan, finished by scanning the pigeonhole. Sees no runner names or contact details.
 */
export default function PickerStation({ eventId }: { eventId: string }) {
  const [state, setState] = useState<PickerState | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [banner, setBanner] = useState<Alert | null>(null);
  const [busy, setBusy] = useState(false);
  const [specialties, setSpecialties] = useState<ExpoKind[] | null>(null);
  const [connError, setConnError] = useState(false);
  // Volunteer pickers: the items the admin assigned (0033). null = an admin, who ticks items here.
  const [assigned, setAssigned] = useState<ExpoKind[] | null>(null);
  // What the last poll said, to spot the admin's changes. undefined = no poll back yet.
  const assignedSeen = useRef<ExpoKind[] | null | undefined>(undefined);
  // An assignment change, shown until dismissed (×).
  const [note, setNote] = useState<Alert | null>(null);
  const lastTaskId = useRef<string | null>(null);
  const wasActive = useRef<boolean | null>(null);
  // True while paused by their own Pause, so it never reads as "you were paused". (Setting
  // wasActive wasn't enough: a poll sent before Pause usually lands after it and resets it.)
  const pausedByMe = useRef(false);
  // Bins of the current task with an open "empty" alert, to announce the refill.
  const emptyBins = useRef<Set<string>>(new Set());
  const latest = useLatestReply();
  // When the banner was last set: a new offer clears an old banner, not one just shown.
  const bannerAt = useRef(0);
  function showBanner(b: Alert | null) {
    bannerAt.current = Date.now();
    setBanner(b);
  }

  async function refresh() {
    const ticket = latest.begin();
    const sent = Date.now();
    const res = await postExpo<{ state?: PickerState; now?: string; assigned?: ExpoKind[] | null }>({
      action: "picker-state",
      eventId,
    });
    const received = Date.now();
    // A poll that left before the last action and came back after it: its state is old.
    if (latest.isStale(ticket)) return;
    setNow(received);
    if (!res.ok || !res.state) {
      setConnError(true);
      return;
    }
    setConnError(false);
    // Server-vs-phone clock difference, so the offer countdown matches the server's 60 s.
    if (res.now) setOffset(Date.parse(res.now) - (sent + received) / 2);

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
              tone: "note",
              title: `Your items are now ${nextAssigned.map((k) => KIND_LABEL[k]).join(" · ")}`,
              text: "Set by the supervisor. A task already on your screen carries on.",
            }
      );
    }
    assignedSeen.current = nextAssigned;
    setAssigned(nextAssigned);
    if (next.task?.status === "offered" && next.task.id !== lastTaskId.current) {
      chime();
      buzz(400);
      // "Task done" from the last task (or any older message) doesn't belong to this offer.
      if (Date.now() - bannerAt.current > 4000) setBanner(null);
    }
    // Paused by the server: an offer ran out, or the supervisor released the task. (Items removed:
    // the note says so instead.)
    if (wasActive.current && next.picker && !next.picker.active && !busy && !pausedByMe.current && !itemsRemoved) {
      showBanner({
        tone: "warn",
        title: "You were paused",
        text: "An offer ran out or the supervisor took the task back. Tap Start when you're ready again.",
      });
    }
    // Restock refilled a bin this picker flagged.
    const nowEmpty = new Set((next.task?.bins ?? []).filter((b) => b.empty).map((b) => b.code));
    if (next.task?.id === lastTaskId.current) {
      const refilled = [...emptyBins.current].filter((c) => !nowEmpty.has(c));
      if (refilled.length > 0) {
        chime();
        buzz(300);
        showBanner({ tone: "note", title: `${refilled.join(", ")} refilled`, text: "Carry on with the step on screen." });
      }
    }
    emptyBins.current = nowEmpty;
    lastTaskId.current = next.task?.id ?? null;
    wasActive.current = next.picker?.active ?? false;
    setState(next);
  }
  usePoll(refresh, 2000);
  // A 1 s tick for the countdown between polls.
  usePoll(async () => setNow(Date.now()), 1000, state?.task?.status === "offered");

  const active = state?.picker?.active ?? false;
  // A volunteer picks the items the admin assigned; an admin previewing ticks their own.
  const isVolunteer = assigned !== null;
  const mySpecialties = assigned ?? specialties ?? state?.picker?.specialties ?? ALL_KINDS;

  /**
   * Start, Pause, Accept, Decline, Give back, Bin is empty. A refusal is a warning (amber).
   * okTone: the alert when it works; null = none (Bin is empty: the step itself says so).
   */
  async function act(body: Record<string, unknown>, okTone: AlertTone | null = "done", okText?: string) {
    setBusy(true);
    const res = await postExpo(body);
    setBusy(false);
    if (!res.ok) {
      buzz();
      showBanner({ ...alertFrom(false, res.message ?? "Try again"), tone: "warn" });
    } else {
      showBanner(okTone ? { ...alertFrom(true, okText ?? res.message ?? "Done"), tone: okTone } : null);
    }
    await refresh();
    return res;
  }

  async function setActive(on: boolean, kinds = mySpecialties) {
    if (!on) pausedByMe.current = true;
    // A volunteer's items come from the server (0033); only an admin sends ticks.
    const res = await act({ action: "set-active", eventId, active: on, ...(isVolunteer ? {} : { specialties: kinds }) });
    // Start worked: their own pause is over. Pause refused: they're still active.
    if (on ? res.ok : !res.ok) pausedByMe.current = false;
  }

  /** One scan during the task (camera, typed or hardware): one task-scan call. True = it moved the task on. */
  async function onTaskScan(t: PickerTask, code: string) {
    setBusy(true);
    const res = await postExpo<ScanAnswer>({ action: "task-scan", taskId: t.id, code });
    setBusy(false);
    const alert = scanAlert(res);
    if (alert.tone === "error") buzz();
    showBanner(alert);
    // The next step shows when this lands; the camera already reads the next code meanwhile.
    void refresh();
    return res.ok;
  }

  if (!state) {
    return (
      <Card>
        <p className="text-14 text-ink-muted">{connError ? "Can't reach the server: retrying…" : "Loading…"}</p>
      </Card>
    );
  }

  const task = state.task;

  // During a task the screen splits (camera on top, one step at a time). Start / Pause come back after it.
  if (task?.status === "accepted") {
    return (
      <TaskScreen
        key={task.id}
        task={task}
        alert={banner}
        note={note}
        onDismissNote={() => setNote(null)}
        connError={connError}
        busy={busy}
        onScan={(code) => onTaskScan(task, code)}
        onBinEmpty={(bin) => {
          if (window.confirm(`Is ${bin.code} empty? Restock will be told to refill it.`)) {
            void act({ action: "bin-empty", taskId: task.id, bin: bin.code }, null);
          }
        }}
        onGiveBack={() => {
          if (window.confirm("Give this task back? It goes to another picker.")) {
            void act({ action: "decline", taskId: task.id }, "note", "Given back: it goes to another picker");
          }
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ResultBanner banner={note} onDismiss={() => setNote(null)} />
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-18 font-semibold text-ink">{active ? "You're active" : "You're paused"}</p>
            <p className="text-14 text-ink-tertiary">
              {active
                ? task
                  ? "Finish this task to get the next one."
                  : `Waiting for a task · ${state.queued} in the queue`
                : "Tap Start to receive tasks."}
            </p>
          </div>
          {active ? (
            // With an offer on screen, Pause hands it back (0032).
            <Button onClick={() => setActive(false)} disabled={busy} className="h-12! px-5!">
              Pause
            </Button>
          ) : (
            <Button variant="green" onClick={() => setActive(true)} disabled={busy || mySpecialties.length === 0} className="h-12! px-6! text-16!">
              Start
            </Button>
          )}
        </div>
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
                <ResultBanner
                  banner={{ tone: "warn", title: "No items assigned yet", text: "Ask the supervisor. Start unlocks once they assign some." }}
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
        {connError && (
          <p className="mt-3">
            <StatusPill tone="expired">Connection problem: retrying</StatusPill>
          </p>
        )}
      </Card>

      <ResultBanner banner={banner} />

      {task?.status === "offered" && (
        <OfferCard
          task={task}
          notMine={!mySpecialties.includes(task.kind)}
          secondsLeft={secondsLeft(task.offerExpiresAt, now + offset)}
          busy={busy}
          onAccept={() => act({ action: "accept", taskId: task.id }, "done", "Accepted")}
          onDecline={() => act({ action: "decline", taskId: task.id }, "note")}
        />
      )}
    </div>
  );
}

function secondsLeft(expiresAt: string | null, serverNow: number) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - serverNow) / 1000));
}

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
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const count = task.bins.reduce((s, b) => s + b.count, 0);
  return (
    <section className="rounded-12 border-2 border-[#F7B27A] bg-tint-orange p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-12 font-medium uppercase tracking-wide text-on-tint-orange">New task · {task.orderCode}</p>
          <p className="mt-1 text-32 font-semibold text-ink">{itemCount(task.kind, count)}</p>
          <p className="mt-1 text-14 text-ink-secondary">From {task.bins.map((b) => b.code).join(", ")}</p>
        </div>
        <div className="text-right">
          <p className={`font-mono text-32 font-semibold tabular-nums ${secondsLeft <= 15 ? "text-[#D92D20]" : "text-ink"}`}>{secondsLeft}s</p>
          <p className="text-12 text-ink-tertiary">to accept</p>
        </div>
      </div>
      {notMine && (
        <ResultBanner
          className="mt-3"
          banner={{ tone: "warn", title: "Not one of your items", text: "It has waited over 90 s, so any free picker can take it." }}
        />
      )}
      <div className="mt-5 grid grid-cols-[2fr_1fr] gap-2">
        <Button variant="dark" onClick={onAccept} disabled={busy || secondsLeft === 0} className="h-14! text-18!">
          <Icon name="check" size={20} />
          Accept
        </Button>
        <Button onClick={onDecline} disabled={busy} className="h-14!">
          Decline
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit -p .` then `npx eslint "src/app/(app)/admin/(protected)/kit/picker"`
Expected: no output from either.

---

### Task 9: Desk screen: alerts and pigeonholes

**Files:**
- Modify: `src/app/(app)/admin/(protected)/kit/desk/DeskStation.tsx`
- Delete: `src/app/(app)/admin/(protected)/kit/AssignmentNote.tsx`

- [ ] **Step 1: Imports**

Find:
```tsx
import ScanInput, { ResultBanner, type Banner as ScanBanner } from "../ScanInput";
import { KIND_LABEL, buzz, chime, elapsed, postExpo, useLatestReply, usePoll } from "../expo-client";
import { AssignmentNote, type Note } from "../AssignmentNote";
```
Replace with:
```tsx
import ScanInput, { ResultBanner, alertFrom, type Alert } from "../ScanInput";
import { KIND_LABEL, buzz, chime, elapsed, postExpo, useLatestReply, usePoll } from "../expo-client";
```

- [ ] **Step 2: Recognise the "No free crate" refusal**

Find:
```tsx
const HANDOVER_CODE = /^(D\d+-[SL]\d+|O-\d+)$/i;
```
Replace with:
```tsx
const HANDOVER_CODE = /^(D\d+-[SL]\d+|O-\d+)$/i;

/**
 * kit_create_order (0030) still says "crate" when the desk is full: "No free [large ]crate at D1:
 * wait for one to be handed over". Changing it would mean replacing the function, so the desk
 * recognises it and words it itself (spec §4.4).
 */
function noFreePigeonhole(message: string): Alert | null {
  const m = /^No free (large )?crate at ([^\s:]+)/.exec(message);
  return m ? { tone: "warn", title: `No free ${m[1] ?? ""}pigeonhole at ${m[2]}`, text: "Wait for one to be handed over." } : null;
}
```

- [ ] **Step 3: State types**

Find:
```tsx
  const [note, setNote] = useState<Note>(null);
```
Replace with:
```tsx
  const [note, setNote] = useState<Alert | null>(null);
```
Find:
```tsx
  const [banner, setBanner] = useState<ScanBanner>(null);
```
Replace with:
```tsx
  const [banner, setBanner] = useState<Alert | null>(null);
```

- [ ] **Step 4: The desk-moved note is blue**

Find:
```tsx
              ? { tone: "info", title: `You're now at desk ${next}`, text: "Set by the supervisor." }
```
Replace with:
```tsx
              ? { tone: "note", title: `You're now at desk ${next}`, text: "Set by the supervisor." }
```

- [ ] **Step 5: Scan results**

Find:
```tsx
        setBanner({ ok: false, text: res.message ?? "No open order" });
```
Replace with:
```tsx
        setBanner(alertFrom(false, res.message ?? "No open order"));
```
Find:
```tsx
      setBanner({ ok: false, text: res.message ?? "Runner not found" });
```
Replace with:
```tsx
      setBanner(alertFrom(false, res.message ?? "Runner not found"));
```
Find:
```tsx
    setBanner(res.lookup.scanned.blocker ? { ok: false, text: `${res.lookup.scanned.name}: ${res.lookup.scanned.blocker}` } : null);
```
Replace with:
```tsx
    // A runner who can't be collected now (already collected, in another order, corporate): a warning.
    const { name, blocker } = res.lookup.scanned;
    setBanner(blocker ? { tone: "warn", title: name, text: blocker } : null);
```

- [ ] **Step 6: Create order**

Find:
```tsx
    if (!res.ok) {
      setBanner({ ok: false, text: res.message ?? "Could not create the order" });
      buzz();
      return;
    }
    setBanner({ ok: true, text: `Order ${res.code} → crate ${res.crate}. Ask the runner to wait; it turns Ready on the right.` });
```
Replace with:
```tsx
    if (!res.ok) {
      // A refusal here is a warning (desk full, runner already in an order), not a wrong scan.
      const message = res.message ?? "Could not create the order";
      setBanner(noFreePigeonhole(message) ?? { ...alertFrom(false, message), tone: "warn" });
      buzz();
      return;
    }
    setBanner({ tone: "done", title: `Order ${res.code} → pigeonhole ${res.crate}`, text: "Ask the runner to wait; it turns Ready on the right." });
```

- [ ] **Step 7: Hand over and cancel results**

Find:
```tsx
    setBanner({ ok: res.ok, text: res.message ?? (res.ok ? "Handed over" : "Could not hand over") });
```
Replace with:
```tsx
    setBanner(alertFrom(res.ok, res.message ?? (res.ok ? "Handed over" : "Could not hand over")));
```
Find:
```tsx
          setBanner({ ok, text });
```
Replace with:
```tsx
          setBanner(alertFrom(ok, text));
```

- [ ] **Step 8: The note uses ResultBanner**

Find:
```tsx
      <AssignmentNote note={note} onDismiss={() => setNote(null)} />
```
Replace with:
```tsx
      <ResultBanner banner={note} onDismiss={() => setNote(null)} />
```

- [ ] **Step 9: crate → pigeonhole in the visible text**

Find:
```tsx
      <Banner tone="danger" title="No crates set up for this event">
        Seed the desk crates first (kit_seed_pigeonholes in 0030), then reload this page.
```
Replace with:
```tsx
      <Banner tone="danger" title="No pigeonholes set up for this event">
        Seed the desk pigeonholes first (kit_seed_pigeonholes in 0030), then reload this page.
```
Find:
```tsx
            Free crates: {board.crates.free.small}/{board.crates.total.small} small · {board.crates.free.large}/
```
Replace with:
```tsx
            Free pigeonholes: {board.crates.free.small}/{board.crates.total.small} small · {board.crates.free.large}/
```
Find:
```tsx
                label="Scan runner pass / BIB, or a crate label to hand over"
```
Replace with:
```tsx
                label="Scan runner pass / BIB, or a pigeonhole label to hand over"
```
Find:
```tsx
      {selected.length > 1 && <p className="mt-2 text-12 text-ink-tertiary">Groups go in a large crate.</p>}
```
Replace with:
```tsx
      {selected.length > 1 && <p className="mt-2 text-12 text-ink-tertiary">Groups go in a large pigeonhole.</p>}
```
Find:
```tsx
      title={`Crate ${order.crate ?? "—"} · ${order.code}`}
```
Replace with:
```tsx
      title={`Pigeonhole ${order.crate ?? "—"} · ${order.code}`}
```
Find:
```tsx
              {KIND_LABEL[t.kind]} {t.status === "done" ? "in crate" : "being picked"}
```
Replace with:
```tsx
              {KIND_LABEL[t.kind]} {t.status === "done" ? "in pigeonhole" : "being picked"}
```
Find:
```tsx
      subtitle="Frees the crate and stops any picking. Items already in the crate go back to their bins."
```
Replace with:
```tsx
      subtitle="Frees the pigeonhole and stops any picking. Items already in the pigeonhole go back to their bins."
```
(`CancelModal` is shared with the floor board, which gets the same wording.)

- [ ] **Step 10: Delete `AssignmentNote.tsx`**

Run: `grep -rn "AssignmentNote" src` and expect only the file itself. Then run `git rm "src/app/(app)/admin/(protected)/kit/AssignmentNote.tsx"`.

- [ ] **Step 11: Type-check and lint**

Run: `npx tsc --noEmit -p .` then `npx eslint "src/app/(app)/admin/(protected)/kit/desk/DeskStation.tsx"`
Expected: no output from either. Also check that `grep -n "crate" "src/app/(app)/admin/(protected)/kit/desk/DeskStation.tsx"` shows only code names and comments (`crate?:`, `o.crate`, `order.crate`, `board.crates`, `res.crate`, the comment on line 12, and the `noFreePigeonhole` comment and regex), and no visible text.

---

### Task 10: crate → pigeonhole on the other screens

**Files:**
- Modify: `src/app/(app)/admin/(protected)/kit/desk/page.tsx`
- Modify: `src/app/(app)/admin/(protected)/kit/page.tsx`
- Modify: `src/app/(app)/admin/(protected)/kit/labels/page.tsx`
- Modify: `src/app/(app)/v/VolunteerApp.tsx`

- [ ] **Step 1: Desk page subtitle**

In `desk/page.tsx`, find:
```tsx
        subtitle="Scan the runner's pass to start an order. When it turns Ready, scan the crate and hand the kit over."
```
Replace with:
```tsx
        subtitle="Scan the runner's pass to start an order. When it turns Ready, scan the pigeonhole and hand the kit over."
```

- [ ] **Step 2: Kit page link**

In `kit/page.tsx`, find:
```tsx
  { href: "/admin/kit/labels?type=crates", label: "Print crate labels" },
```
Replace with:
```tsx
  { href: "/admin/kit/labels?type=crates", label: "Print pigeonhole labels" },
```
(`type=crates` is a code name and stays.)

- [ ] **Step 3: Labels page: printed text and title**

In `labels/page.tsx`, find:
```tsx
        lines: [`Desk ${c.station}`, c.size === "small" ? "Small crate: one runner" : "Large crate: group order"],
```
Replace with:
```tsx
        // Short lines: the label prints at text-14 and truncates anything longer.
        lines: [`Desk ${c.station} pigeonhole`, c.size === "small" ? "Small: one runner" : "Large: group order"],
```
Find:
```tsx
            type === "bins" ? "Bin labels" : type === "crates" ? "Crate labels" : type === "groups" ? "Group-box labels" : "Expo bag labels"
```
Replace with:
```tsx
            type === "bins" ? "Bin labels" : type === "crates" ? "Pigeonhole labels" : type === "groups" ? "Group-box labels" : "Expo bag labels"
```

- [ ] **Step 4: Volunteer app hints**

In `VolunteerApp.tsx`, find:
```tsx
  desk: "Scan the runner's pass to start an order. When it turns Ready, scan the crate and hand over.",
  picker:
    "Tap Start to receive tasks. Scan the bin, pick, then scan the crate.",
```
Replace with:
```tsx
  desk: "Scan the runner's pass to start an order. When it turns Ready, scan the pigeonhole and hand over.",
  picker:
    "Tap Start to receive tasks. Scan each bin or BIB as you pick, then scan the pigeonhole.",
```

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit -p .` then `npx eslint "src/app/(app)/admin/(protected)/kit/desk/page.tsx" "src/app/(app)/admin/(protected)/kit/page.tsx" "src/app/(app)/admin/(protected)/kit/labels/page.tsx" "src/app/(app)/v/VolunteerApp.tsx"`
Expected: no output from either.

---

### Task 11: Look at it (read-only), then commit the screens

**Files:**
- Create, then delete: `src/app/(app)/v/task-preview/page.tsx` (never committed)

- [ ] **Step 1: Write the temporary preview page**

`src/app/(app)/v/task-preview/page.tsx`:

```tsx
"use client";

// TEMPORARY (Part 2 screen checks): the picker's task screen with sample tasks. No API calls, nothing
// is written. The scan logic below is a rough copy of kit_task_scan for looking at the screen; the
// SQL test covers the real one. DELETE THIS FOLDER BEFORE COMMITTING.

import { useState } from "react";
import type { PickerBin, PickerTask } from "@/lib/expo";
import { ResultBanner, type Alert } from "../../admin/(protected)/kit/ScanInput";
import TaskScreen from "../../admin/(protected)/kit/picker/TaskScreen";

type Kind = PickerTask["kind"];

function bin(code: string, size: string | null, bibs: (string | null)[]): PickerBin {
  return {
    code,
    size,
    count: bibs.length,
    picked: 0,
    opened: false,
    empty: false,
    lines: bibs.map((b, i) => ({ lineId: `${code}-${i}`, size, bib: b, picked: false })),
  };
}

function sample(kind: Kind): PickerTask {
  const bins =
    kind === "tshirt"
      ? [bin("TS-L", "L", [null]), bin("TS-M", "M", [null, null])]
      : kind === "bib"
        ? [bin("BF-42001-42100", null, ["42017", "42033"])]
        : [bin("PACK", null, [null, null])];
  return { id: `preview-${kind}`, kind, status: "accepted", offerExpiresAt: null, orderCode: "O-0042", crate: "D1-S2", bins, allPicked: false };
}

function fakeScan(t: PickerTask, code: string): { task: PickerTask | null; alert: Alert; ok: boolean } {
  const task: PickerTask = structuredClone(t);
  const all = task.bins.every((b) => b.picked === b.count);
  if (code === task.crate) {
    return all
      ? { task: null, ok: true, alert: { tone: "done", title: "Task done", text: `Dropped in pigeonhole ${task.crate}. The next task comes to this screen.` } }
      : { task, ok: false, alert: { tone: "warn", title: "Pick everything first", text: `Then scan ${task.crate} again.` } };
  }
  const b = task.bins.find((x) => x.code === code);
  if (b) {
    const left = b.count - b.picked;
    if (left === 0) return { task, ok: false, alert: { tone: "warn", title: `Bin ${code} is already picked`, text: "Nothing more to take from it." } };
    b.opened = true;
    if (task.kind === "bib") return { task, ok: true, alert: { tone: "done", title: `Bin ${code} open`, text: "Now scan each BIB as you take it." } };
    b.picked = b.count;
    b.lines.forEach((l) => (l.picked = true));
    const what = task.kind === "tshirt" ? `${left} × size ${b.size}` : `${left} ${left === 1 ? "pack" : "packs"}`;
    return { task, ok: true, alert: { tone: "done", title: `Picked ${what} from ${code}` } };
  }
  for (const x of task.bins) {
    const line = x.lines.find((l) => l.bib === code);
    if (!line) continue;
    if (line.picked) return { task, ok: false, alert: { tone: "warn", title: `BIB ${code} is already picked`, text: "Carry on with the next step." } };
    if (!x.opened) return { task, ok: false, alert: { tone: "warn", title: "Scan the bin label first", text: `Bin ${x.code}, then BIB ${code}.` } };
    line.picked = true;
    x.picked += 1;
    return { task, ok: true, alert: { tone: "done", title: `BIB ${code} picked` } };
  }
  if (/^D\d+-[SL]\d+$/.test(code)) return { task, ok: false, alert: { tone: "error", title: `Wrong pigeonhole: ${code}`, text: `This task goes in ${task.crate}.` } };
  if (task.kind === "bib" && task.bins.some((x) => x.opened))
    return { task, ok: false, alert: { tone: "error", title: `Wrong BIB: ${code}`, text: "It isn't in this order. Put it back." } };
  return { task, ok: false, alert: { tone: "error", title: `Wrong bin: ${code}`, text: "It isn't in this task. Put back anything you took from it." } };
}

export default function TaskPreviewPage() {
  const [task, setTask] = useState<PickerTask | null>(() => sample("tshirt"));
  const [alert, setAlert] = useState<Alert | null>(null);
  const [note, setNote] = useState<Alert | null>({
    tone: "note",
    title: "Your items are now T-shirt · Pack",
    text: "Set by the supervisor. A task already on your screen carries on.",
  });

  return (
    <div className="min-h-dvh bg-surface-page">
      {/* Stand-ins for the /v header and hint, so the layout matches the real screen. */}
      <div className="sticky top-0 z-30 h-14 bg-dark" />
      <main className="mx-auto max-w-lg px-3 pb-8 pt-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {(["tshirt", "bib", "pack"] as const).map((k) => (
            <button
              key={k}
              type="button"
              className="rounded-6 border border-line bg-white px-3 py-1.5 text-14"
              onClick={() => {
                setTask(sample(k));
                setAlert(null);
              }}
            >
              {k}
            </button>
          ))}
          <button
            type="button"
            className="rounded-6 border border-line bg-white px-3 py-1.5 text-14"
            onClick={() => setTask((t) => t && { ...t, bins: t.bins.map((b, i) => (i === 0 ? { ...b, empty: !b.empty } : b)) })}
          >
            Toggle first bin empty
          </button>
        </div>
        <p className="mb-4 text-14 text-ink-tertiary">Tap Start to receive tasks. Scan each bin or BIB as you pick, then scan the pigeonhole.</p>
        {task ? (
          <TaskScreen
            key={task.id}
            task={task}
            alert={alert}
            note={note}
            onDismissNote={() => setNote(null)}
            connError={false}
            busy={false}
            onScan={async (code) => {
              const r = fakeScan(task, code);
              setAlert(r.alert);
              setTask(r.task);
              return r.ok;
            }}
            onBinEmpty={(b) => setAlert({ tone: "note", title: `Would flag ${b.code} empty`, text: "Preview only: nothing is sent." })}
            onGiveBack={() => {
              setTask(null);
              setAlert({ tone: "note", title: "Given back", text: "It goes to another picker." });
            }}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <ResultBanner banner={alert} />
            <p className="text-14 text-ink-muted">Task ended. Pick a sample above.</p>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint everything changed**

Run: `npx tsc --noEmit -p .`
Expected: no output.
Run: `npx eslint src/lib/expo.ts src/app/api/admin/kit/expo/route.ts "src/app/(app)/admin/(protected)/kit" "src/app/(app)/v"`
Expected: no output.

- [ ] **Step 3: Look at the task screen (no writes)**

Start `npm run dev` if it isn't running. Sign in as an admin and open `http://localhost:3000/v/task-preview`, with DevTools' device toolbar at 390 × 844. Allow the webcam when asked. It only reads frames; nothing is sent. Type codes in the box and press Enter. Check:
1. T-shirt sample: the camera fills just over half the screen, with "Take 1 × size L, then scan the label on bin TS-L" across its top and a "Camera off" button. The code box is under it. The step card reads "Take / 1 × size L / from bin TS-L", with "Bin is empty" (red text) and "Give task back". The progress bar is pinned to the bottom: "Step 1 of 3 · 0 of 3 T-shirts picked · O-0042 → D1-S2". The step card's main line is visible above the progress bar without scrolling.
2. Type `ts-l`: a green "Picked 1 × size L from TS-L" shows over the camera's bottom edge and disappears after about 3 s. The step becomes TS-M ("2 × size M", "picks them"), and the bar shows "Step 2 of 3 · 1 of 3".
3. Type `TS-XL`: a red "Wrong bin: TS-XL" (larger title) with the line under it. It stays until the next scan.
4. Type `TS-M`: the step becomes the green "All picked / Drop everything in pigeonhole / D1-S2", with only "Can't finish: give this task back".
5. Type `D1-S5`: red "Wrong pigeonhole: D1-S5" / "This task goes in D1-S2." Type `d1-s2`: the task ends, and a green "Task done" shows, then clears after 3 s.
6. BIB sample: "Go to bin BF-42001-42100". Type `42017`: amber "Scan the bin label first". Type the bin code: green "Bin … open", and the step becomes "Take BIB 42017". Type `42033` (a later step): green, the step stays on 42017, and the bar moves to "Step 3 of 4". Type `99999`: red "Wrong BIB: 99999". Type `42017`: the drop step.
7. Pack sample: "Take 2 packs". "Toggle first bin empty" shows the amber "Bin marked empty" inside the step card, hides "Bin is empty", and "Give task back" spans the row.
8. Press "Camera off": a grey bar, "Camera off: type the code below", and scan results now show under the code box. Reload: the camera stays off. Press "Turn camera on": the camera comes back.
9. The blue "Your items are now T-shirt · Pack" note sits above the step card. Its × removes it.
10. In Chrome's site settings, block the camera for localhost and reload. The camera half is replaced by "Camera access is blocked. Allow the camera…". Allow it again afterwards.
11. On the laptop, the code box has focus as soon as the screen opens, so a USB scanner can type into it.

- [ ] **Step 4: Read-only checks on the real screens**

Still signed in as an admin:
1. `/v?as=picker`: the between-task screen looks as before (Start / Pause card, "I pick" ticks, admin hint). **Don't press Start** (it writes `kit_pickers`).
2. `/v?as=desk`: the hint says "scan the pigeonhole". The desk row says "Free pigeonholes: …", and the scan box label says "or a pigeonhole label". Type `ZZZ` + Enter: a red alert, `No paid runner for "ZZZ"` (desk-lookup only reads). Type `D1-S99` + Enter: a red "No open order for D1-S99" (order-preview only reads). **Don't create an order.**
3. On the desk screen, press the camera button and close it within a second, while it still says "Starting camera…". The browser's camera indicator goes off within a couple of seconds (the leak fix). Open it again and let it start: it reads one code and closes.
4. `/admin/kit`: the link says "Print pigeonhole labels". `/admin/kit/labels?type=crates`: the title is "Pigeonhole labels", and each label says "Desk D1 pigeonhole" / "Small: one runner" (or "Large: group order") with nothing cut off, on screen and in the print preview (Ctrl+P, then Cancel).
5. `/v?as=handover` and `/v?as=restock` render as before.
6. The browser console shows no errors on these pages.

- [ ] **Step 5: Delete the preview**

Run: `rm -r "src/app/(app)/v/task-preview"`
Run: `git status --short`
Expected: `task-preview` is not listed. The changes are exactly these:
```
 M src/app/(app)/admin/(protected)/kit/CameraScanner.tsx
 M src/app/(app)/admin/(protected)/kit/ScanInput.tsx
 M src/app/(app)/admin/(protected)/kit/desk/DeskStation.tsx
 M src/app/(app)/admin/(protected)/kit/desk/page.tsx
 M src/app/(app)/admin/(protected)/kit/labels/page.tsx
 M src/app/(app)/admin/(protected)/kit/page.tsx
 M src/app/(app)/admin/(protected)/kit/picker/PickerStation.tsx
 M src/app/(app)/v/VolunteerApp.tsx
D  src/app/(app)/admin/(protected)/kit/AssignmentNote.tsx
?? src/app/(app)/admin/(protected)/kit/picker/TaskCamera.tsx
?? src/app/(app)/admin/(protected)/kit/picker/TaskScreen.tsx
?? src/app/(app)/admin/(protected)/kit/picker/steps.ts
?? src/app/(app)/admin/(protected)/kit/useBarcodeCamera.ts
```
(Git may quote paths with parentheses; the list is what matters. If `AGENTS.md` shows up as modified, `next dev` re-added its block. Leave it out of this commit.)

- [ ] **Step 6: Full type-check and build**

Run: `npx tsc --noEmit -p .`
Expected: no output.
Run: `npx next build`
Expected: ends with the route table and no errors, and `/v/task-preview` is not in it. A local build deploys nothing.

- [ ] **Step 7: Commit the screens (ask the user first)**

Ask: "OK to commit the Part 2 screens (task screen, camera hook, new alerts, pigeonhole wording)?" Only on a yes:
```bash
git add "src/app/(app)/admin/(protected)/kit/useBarcodeCamera.ts" "src/app/(app)/admin/(protected)/kit/CameraScanner.tsx" "src/app/(app)/admin/(protected)/kit/ScanInput.tsx" "src/app/(app)/admin/(protected)/kit/picker" "src/app/(app)/admin/(protected)/kit/desk" "src/app/(app)/admin/(protected)/kit/page.tsx" "src/app/(app)/admin/(protected)/kit/labels/page.tsx" "src/app/(app)/v/VolunteerApp.tsx"
git commit -m "Volunteer assignments: scan-to-pick task screen, new alerts, crate becomes pigeonhole" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(The deletion of `AssignmentNote.tsx` is already staged by `git rm` in Task 9.)

---

### Task 12: Hand over, then deploy

**Files:** none changed.

- [ ] **Step 1: Report to the user, with the checks that need writes**

Tell the user what passed in Task 11. Then list the checks that write to production, which the user should do (or approve) after deploying. They need the spare Google account as a test picker with T-shirt assigned, on a phone at the https:// site:
1. Press Start on the test phone. On a laptop as admin, open the desk (D1) and create an order for one paid expo runner the user picks. **This creates a real order; it gets cancelled in step 6.**
2. Accept the T-shirt offer on the phone. The screen splits: camera on top with "Take 1 × size M, then scan the label on bin TS-M", the step card, and the progress bar at the bottom. The Start / Pause card is gone.
3. Scan a wrong label (or type `TS-XL`): red alert, and the phone buzzes. Scan the TS-M bin label (or type it): green "Picked 1 × size M from TS-M", and the step becomes "Drop everything in pigeonhole D1-S…".
4. Type a wrong pigeonhole: red "Wrong pigeonhole". Scan the right one: "Task done", and the normal screen returns.
5. The BIB and pack tasks wait. After 90 s one may be offered to the test phone with "Not one of your items". Decline it (blue "Declined").
6. As admin, cancel the order at the desk (Cancel, reason "test"). **Never press Hand over.** Pause the test phone, and remove the test volunteer if it's no longer needed.
7. At the first pilot, run the camera half on a real Android phone and an iPhone, with the other deferred phone checks.

- [ ] **Step 2: Deploy (only with a yes)**

0035 must already be applied (Task 1, Step 4). Run `git fetch`. If `origin/main` has new commits, ask before `git pull --rebase origin main`, then run `npx next build` again.
Ask: "OK to push `main` (deploys Part 2 to production)?" Only on a yes: `git push origin main`.
