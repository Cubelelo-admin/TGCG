# Volunteer assignments: design

Status: agreed design, 26 Nov 2026. Not built yet.
Mockup: `docs/mockups/volunteer-assignments.html` (open it in a browser; its Decisions list is part of this spec).
Background: `docs/expo-on-demand-design.md` (the expo order flow this changes).

## 1. Why

Today each volunteer sets up their own screen: a desk laptop picks its desk (D1 / D2 / D3), and a picker ticks the items they pick. The server trusts whatever the phone sends. On the day, the supervisor needs to decide who works where, and a volunteer must not be able to move themselves to another desk or pick items they weren't given.

So the admin assigns each desk volunteer a desk and each picker their items, in Configuration → Volunteers. The server enforces it. The volunteer screens show the assignment but can't change it.

The picker's task screen is redesigned at the same time: a live camera on top, one instruction at a time below it, scanning instead of tapping.

Built in two parts. Each part works on its own and ships separately:

- **Part 1, assignments (migration 0033):** store and edit the assignments, enforce them on the server, and show them on the desk and picker screens.
- **Part 2, picking by scanning (migration 0034):** the split task screen, one server action for every scan, the new alerts, and the crate → pigeonhole rename.

## 2. Rules

1. The admin assigns a desk to each desk volunteer and items (BIB, T-shirt, Pack; any mix) to each picker, in Configuration → Volunteers, in the table and in the add form. Handover and restock volunteers need nothing.
2. A picker with no items can't Start. They see "No items assigned yet" until the admin assigns some.
3. A desk volunteer with no desk gets no scan box, only "No desk assigned yet".
4. Two desk logins can share one desk (two laptops at D1): both see D1's orders.
5. Changes reach the volunteer's screen by themselves, with a note saying what changed. A task already accepted carries on; new items apply from the next offer.
6. The 90 s overflow stays: a task waiting over 90 s can go to any free picker. Its offer says "Not one of your items".
7. Pickers keep Start / Pause.
8. Admins are not assigned. Previewing /v, they keep the desk switcher and the item ticks, for testing.
9. On every volunteer screen the word "crate" becomes "pigeonhole".

## 3. Part 1: assignments

### 3.1 Data: migration 0033

`admin_allowlist` gets two columns:

| Column | Type | Rule |
|---|---|---|
| `desk` | `text`, null | Only for role `desk`; otherwise null. A station name such as `D1` (1 to 10 characters). |
| `picker_items` | `text[]`, not null, default `'{}'` | Only for role `picker`; otherwise empty. Each value is `bib`, `tshirt` or `pack`. |

Check constraints enforce both rules, so a role change must clear the other role's assignment in the same write.

Desks aren't a fixed list in the database: they are the stations of the current event's pigeonholes (`kit_pigeonholes.station`, seeded by `kit_seed_pigeonholes`). The Volunteers screen offers those stations, and the server checks the value against them when saving.

0033 also adds `kit_picker_items_changed` (section 3.4).

No backfill: after 0033 every picker has no items and every desk volunteer has no desk until the admin assigns them. 0033 also pauses every picker who is active with no task in hand, so everyone starts again under the new rules. Apply it while nobody is picking (the same advice as 0031 and 0032). Applied migrations 0025–0032 are not edited.

### 3.2 Reading the assignment

The role lookup in `src/lib/admin-auth.ts` (cached for 60 s, tag `admin-allowlist`) also reads `desk` and `picker_items`. The session gains `desk` and `items`. The Volunteers route already clears that cache on every change, so an assignment takes effect on the volunteer's next request, with no extra database query per poll.

### 3.3 Configuration → Volunteers

`VolunteersCard` gets a "Desk or items" column:

- Desk volunteer: a select with "Not assigned" and the current event's desks.
- Picker: three toggle chips (BIB, T-shirt, Pack). With none on, a "Not assigned" label.
- Handover / restock: "Not needed".

The add form shows the same control for the chosen role. A change saves straight away, like a role change does today.

`/api/admin/volunteers`, action `set`, takes optional `desk` and `items` with the role. It stores the assignment only for the matching role and clears the rest. It refuses a desk that isn't one of the current event's stations. Admin rows still can't be changed here.

### 3.4 Pickers: server

- **Start (`set-active`, active true):** for role `picker`, the server uses the assigned items and ignores any `specialties` in the body. No items: refused with "No items assigned yet: ask the supervisor". For admins, the body's ticks are used as today.
- **Pause:** unchanged.
- **The admin changes a picker's items** (or changes their role away from picker, or removes them): the route calls a new function, `kit_picker_items_changed(email, items)`, which updates every `kit_pickers` row for that email at once:
  - It sets `specialties` to the new items. Dispatch already reads `specialties`, so the next offer follows the new items.
  - An offer on screen stays; the picker can still accept it.
  - **No items left:** the picker is paused. An offer on screen is handed back (as Pause does since 0032). An accepted task stays theirs to finish; after the put-away they stay paused.
- `picker-state` returns the assigned items (or nothing for an admin), so the phone shows them and notices a change within one poll (2 s).

### 3.5 Desks: server

For role `desk`, the server uses the assigned desk and ignores any `station` in the body:

| Action | Rule |
|---|---|
| `desk-board` | Shows the assigned desk's orders. No desk: an empty board marked "no desk assigned". The response includes the assigned desk, so the screen notices a change within one poll (3 s). |
| `create-order` | The order goes to the assigned desk. No desk: refused. |
| `order-preview`, `fulfil` | An order at another desk is refused: "O-0041 is at desk D2: send the runner there". |
| `desk-lookup` | Unchanged: any desk can look up a runner. |

Admins are not restricted: the station in the body is used, as today.

### 3.6 Picker screen, between tasks

- "Your items" shows the assigned items read-only, with "Set by the supervisor. A task waiting over 90 s can go to anyone free." The "I pick" ticks stay only in admin previews.
- No items: a warning, "No items assigned yet", and Start disabled.
- When the admin changes the items, a note appears: "Your items are now T-shirt · Pack". If all items are removed, a warning appears instead: "Your items were removed: you're paused until the supervisor assigns new ones". That warning replaces the generic "You were paused" message in this case.
- An overflow offer has a warning line: "Not one of your items · It has waited over 90 s, so any free picker can take it."
- Start / Pause work as today.

### 3.7 Desk screen

- A desk volunteer works at their assigned desk. The header shows "Collection desk · D1" and the screen shows "This desk: D1 · Set by the supervisor". There is no switcher, and the browser's saved choice is ignored for them.
- No desk: "No desk assigned yet. Ask the supervisor to assign you a desk. This screen updates by itself." There is no scan box, and the screen keeps checking.
- When the admin moves them, a note appears: "You're now at desk D2". When they're taken off, a warning appears: "You were taken off your desk".
- A stored desk that isn't one of this event's desks counts as no desk.
- Admin previews keep today's switcher.

Notes and warnings about assignment changes stay until dismissed (×). Part 1 shows them in the current banner style; Part 2 restyles every alert (section 4.3).

## 4. Part 2: picking by scanning

### 4.1 Picker, during a task (after Accept)

The screen splits. The Start / Pause card is hidden until the task ends.

**Top: the larger part, over half the screen.**

- A live camera fills the top. Across its top edge: what to scan now, for example "Take 1 × size M, then scan the label on bin TS-M".
- A "Camera off" button folds the camera away and leaves the code box. The phone remembers the choice. If the camera is blocked or missing, the screen starts with it off and says why.
- Under the camera: a box to type a code ("Camera can't read it? Type the code") with an Enter button. It also takes a hardware scanner.
- The camera keeps running for the whole task. It reuses the detection in `CameraScanner` (native BarcodeDetector, zxing fallback, the same code ignored for 2.5 s). That code moves into a piece both the full-screen scanner and this inline camera can use.

**Below: one instruction at a time.**

- The task is a list of steps, and only the first step not done yet is shown, in large type:
  - T-shirts and packs: one step per bin: "Take 1 × size M, from bin TS-M, then scan the bin label".
  - BIBs: "Go to bin BF-42001-42100, scan its label to open it", then one step per BIB: "Take BIB 42017, then scan the BIB".
  - Last: "Drop everything in pigeonhole D1-S2", with the label in very large type, finished by scanning or typing that label.
- Under the step: "Bin is empty" and "Give task back", each with its confirm dialog as today. On the last step, only "Give task back".
- When a scan finishes a step, the next step replaces it. A scan for a later step still counts, and that step is skipped when its turn comes.
- To show "size M" before the bin is scanned, `loadPickerState` returns a T-shirt bin's size from the start. That reveals nothing new: the bin code (TS-M) already says it. BIB numbers still show only after the bin scan.

**Bottom edge: a progress bar,** pinned. For example: "Step 2 of 3 · 1 of 2 T-shirts picked · O-0042 → D1-S2". It counts finished steps, so a scan that skips ahead still moves it.

After the pigeonhole scan, the task ends and the normal screen returns, with a green "Task done".

### 4.2 One server action for every scan: migration 0034

There is no Picked button. Every scan during a task (camera, typed or hardware) goes to one new action, `task-scan`, backed by a new function `kit_task_scan(task, code, email)` in 0034. Its answer says what the scan did. The screen builds its alert from that answer, and one scan is one round trip.

| The code is | Answer |
|---|---|
| A bin of this task (T-shirt / pack) | Opens it and picks every line this task needs from it: "Picked 1 × size M from TS-M". |
| A bin of this task (BIB) | Opens it: "Bin BF-42001-42100 open". |
| A bin already fully picked | Warning: "Bin TS-M is already picked". |
| A BIB of this task, bin open | Picks it: "BIB 42017 picked". |
| A BIB of this task, bin not open yet | Warning: "Scan the bin label first: bin BF-42001-42100, then BIB 42017". |
| This order's pigeonhole, all picked | Puts it away (same as `kit_put_away`; the order turns Ready when it was the last task): "Task done". |
| This order's pigeonhole, not all picked | Warning: "Pick everything first". |
| Another pigeonhole label | Error: "Wrong pigeonhole: D1-S5. This task goes in D1-S2." |
| Anything else, BIB task with a bin open | Error: "Wrong BIB: 42099. It isn't in this order. Put it back." |
| Anything else | Error: "Wrong bin: TS-XL. It isn't in this task. Put back anything you took from it." |

It refuses a task that isn't accepted or isn't the caller's ("Accept the task first"), like the existing pick functions. The existing `pick-bin`, `pick-item` and `put-away` actions stay, so a phone still on the old screen keeps working during the deploy. The new screen doesn't use them.

### 4.3 Alerts

`ResultBanner` (in `kit/ScanInput.tsx`) becomes the one alert for every volunteer screen. It has an icon, a bold title (what happened) and at most one line under it (what to do now). The colour says how serious it is:

| Colour | Used for |
|---|---|
| Red (error) | A wrong scan: bin, BIB, pigeonhole; an order at another desk. Larger title; the phone buzzes. |
| Amber (warning) | No items, not one of your items, bin empty, taken off your desk, scan the bin first. |
| Blue (note) | Items or desk changed, declined, given back. |
| Green (done) | Picked, task done, order created. Clears itself after 3 s. |

- Red and amber scan results stay until the next scan.
- Amber is only for warnings: ordinary "to do" labels use the grey tone.
- While picking, scan results show over the bottom of the camera, where the picker is looking.
- Messages use sentence case ("Wrong bin", not "WRONG BIN:").

### 4.4 Crate → pigeonhole

On the desk, picker and label screens and in the /v hints, every "crate" in the visible text becomes "pigeonhole". For example: "Scan a pigeonhole label to hand over", "Free pigeonholes: 9/10 small", "Small pigeonhole: one runner". Code names (`crate` fields, `type=crates`, `loadCrateLabels`) stay as they are.

One exception: when every pigeonhole at a desk is busy, the refusal "No free crate at D1: wait for one to be handed over" comes from `kit_create_order` (0030). Changing that text would mean replacing the function. Instead the desk screen recognises that refusal (it starts "No free") and shows its own wording.

## 5. Edge cases

- **The desk changes while the volunteer is mid-order:** the order is created at the new desk. The "Order → pigeonhole D2-S1" message shows where it went.
- **A picker is removed or changed to another role with an accepted task:** the task stays with them, but they lose the picker screen. The supervisor releases it from the floor board, as today.
- **The event's pigeonholes change after desks are assigned:** a stored desk that is no longer a station counts as no desk (section 3.7). Saving a new one checks the current stations.
- **Two admins edit the same volunteer:** the last save wins, as with roles today.

## 6. Testing

Both migrations get a test in `supabase/tests/`, run after the migration in the SQL editor. They follow the 0031 / 0032 pattern: build test data at a test desk, check everything, then raise an error on purpose so nothing is kept. The error text is the report ("TEST REPORT: 0 failed").

- **`0033_volunteer_assignments_test.sql`:**
  - The constraints: a desk on a picker row, items on a desk row, and an unknown item are each refused.
  - `kit_picker_items_changed`: specialties are updated on every event's row; no items pauses the picker and hands an offer back; an accepted task stays theirs.
- **`0034_task_scan_test.sql`:** every row of the table in section 4.2, including "order turns Ready" when the last task is put away, and "Accept the task first".
- **TypeScript:** `npx tsc --noEmit -p .`, `npx eslint` on the changed files, `npx next build`.
- **On screen:** desk and picker flows in an admin preview and with a test volunteer login. The dev server uses the production database, so anything that creates an order needs the user's approval first. Never press Hand over in tests.
- **Phones:** the camera half and scanning on a real Android phone and an iPhone at the first pilot (first week of December), with the other deferred phone tests.

## 7. Rollout

1. The user applies 0033 in the SQL editor while nobody is picking, runs its test and pastes the report.
2. Part 1 is deployed (push to `main`, only with the user's yes).
3. The admin assigns desks and items in Configuration → Volunteers.
4. The user applies 0034 and runs its test.
5. Part 2 is deployed (again only with a yes).

Each migration goes in before its part's deploy: Part 1 reads 0033's columns, and Part 2 calls 0034's function. A phone left open on the old screen keeps working after either deploy: the server overrides the desk or ticks it sends, and the old pick actions remain.

## 8. Not in this work

- Assigning per event (assignments are per person, across events).
- Shifts or time-based assignments.
- Removing the old `pick-bin`, `pick-item` and `put-away` actions.
- The handover and restock screens, apart from the shared alert in section 4.3.
