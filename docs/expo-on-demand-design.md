# Expo on-demand kit flow: FINAL PLAN

## Answers received and what they changed (these override the sections below)

- **Q1** 20+ volunteers, all with Google accounts → `admin_allowlist.role` (admin | desk |
  picker). Do NOT add desk/picker rows until step 2 ships: until then the app ignores the
  role and anyone on the allowlist is a full admin.
- **Q2** BIBs in files of 100 → no `kit_bins` table. The file label is computed:
  `BF-42001-42100` (prefix + range, same numbering as the old shelf labels). T-shirt bins
  stay `TS-M` etc., accessories `PACK`.
- **Q3** Crates belong to a desk: 5-6 small + 2-3 large per desk → `kit_pigeonholes` has
  `station` and `size`. A single runner gets a small crate at that desk (a large one if no
  small is free); a group gets a large one only. Labels `D1-S1`, `D1-L1`. If the desk has no
  suitable free crate the order is refused with "wait for one to be handed over" (no hidden
  queue: the desk sees it and retries). Seeded with `kit_seed_pigeonholes`.
- **Q4** QR is enough.
- **Q5** SQL straight on production, so the test script runs everything in one
  transaction and ends with a deliberate error that rolls it all back.
- Also decided while writing 0030: a picker who lets an offer lapse is **paused** (set
  inactive) so tasks stop landing on someone who walked away; they tap Active again.

Status: migration 0030 and its test script are written, not run. Replaces pre-packed expo bags for the **expo** channel only.
Corporate group boxes (day-0 rep handover) are unchanged. Migrations 0025-0029 are never
edited; everything below is 0030+.

## 0. What the critical review changed (vs the first draft)

| # | Problem found in the draft | Resolution |
|---|---|---|
| 1 | Picker flow assumed a BIB scan only; the requirement is "scan the box first, then see the item". BIB storage layout (which box holds which BIB) is unknown. | Added a bin model (section 5). Q2 asks for the layout. |
| 2 | If no free picker has the right specialty (e.g. all T-shirt pickers busy), the order stalls forever. | Fallback: after 90 s queued, any free picker may take it. Floor board shows it. |
| 3 | Many desks/pickers polling would all run the dispatch sweep at once (races, double offers). | Single dispatcher guarded by `pg_try_advisory_xact_lock`; offers use `for update skip locked`. |
| 4 | "Idle longest" ordering had no column behind it. | `kit_pickers.free_since`. |
| 5 | Pigeonholes are the real throughput limit and I had no sizing. | Sizing rule in section 7; count is Q3. |
| 6 | An accepted task whose picker silently vanishes would hang an order. | 5-min soft timeout flags it red; supervisor one-tap "release" re-queues. |
| 7 | Existing flow clashes: `kit_generate_boxes` still creates expo bags; `kit_swap_size` and `kit_desk_collect` only know `kit_items`/`kit_boxes`; the dry run may have left expo bags. | 0030 redefines those three functions (new migration, `create or replace`) and adds a reset of leftover expo bags. Counter screen retired for expo. |
| 8 | A QR shown on a phone is the only authorisation; a screenshot could be used by anyone. | Handover screen shows name + BIB large; support can require ID. Accept the residual risk (same as a paper ticket); decision in Q4. |
| 9 | Auth: volunteers must not get the full admin (it shows PII). | `role` on the allowlist; picker role sees BIB + size only, no phone/email. Q1. |
| 10 | Venue network is unreliable. | Every scan RPC is idempotent (re-scan = same result, never a double effect); clear retry UI. |
| 11 | Scope too big for a first release (slots, photo, realtime). | Phased: MVP is desk + picker + pigeonhole + handover + board. Slots, photo later. |
| 12 | Testing: I cannot reach a database. | Each RPC ships with a SQL test script; Supabase branching (a throwaway DB branch) offered for the dry run (Q5). |

Decisions I took as defaults (say if you disagree): polling (2-3 s) not Realtime; lazy sweep
plus pg_cron backstop; support-only handling of lost QR; one open order per runner; order
cap 10 runners; pre-packed expo bags removed (not kept as a mode).

## 1. Flow

1. Runner shows QR (registration_code). Desk scans.
2. Desk sees that runner plus other uncollected paid expo runners in the same booking;
   ticks who is being collected (bulk for groups). Creates the **order**.
3. System assigns a free **pigeonhole** and creates up to three **tasks** (bib, tshirt,
   pack), one per kind per order, covering every runner in the order.
4. Each task is offered to a free, active picker with that specialty. 60 s to accept, else
   it goes to a different picker.
5. Picker accepts, scans each source bin, picks, walks to the pigeonhole, scans it, puts away.
6. When every task is done the order turns **Ready**; the creating desk is notified.
7. Desk scans the pigeonhole, hands over, optional photo, order **Fulfilled**, hole freed.

Stations: D1-D3 collection desks, S = support (the existing Exceptions screen).

## 2. Roles and screens

| Role | Screen | Sees |
|---|---|---|
| Desk (D1-D3) | /admin/kit/desk | runner name, BIB, size; booking group |
| Picker | /admin/kit/picker (phone) | task, bin labels, item and size; no names or contact info |
| Support (S) | existing Exceptions + order cancel | full runner details |
| Supervisor | /admin/kit/floor | all orders, pickers, holes, stuck items |

Pickers have `specialties` (any of bib, tshirt, pack) and an Active/Inactive toggle.
Free = `active and current_task_id is null`.

## 3. Data model (0030)

- `kit_orders`: id, event_id, code (O-0001), station, created_by, status
  (open | ready | fulfilled | cancelled), pigeonhole_id, created_at, ready_at,
  fulfilled_at, fulfilled_by, photo_path.
- `kit_order_lines`: id, order_id, registration_id, kind (bib|tshirt|pack), size, bin_id,
  status (pending | done), done_at. Partial unique index: one non-cancelled line per
  (registration, kind), so a runner can never be issued twice.
- `kit_tasks`: id, order_id, kind, status (queued | offered | accepted | done | cancelled),
  picker_id, queued_at, offered_at, offer_expires_at, accepted_at, declined_by uuid[],
  done_at.
- `kit_pickers`: id, email, name, specialties text[], active, current_task_id, free_since.
- `kit_pigeonholes`: id, label, status (free | busy), order_id.
- `kit_bins`: id, code (scan label), kind, size (tshirt), bib_from, bib_to (bib boxes).
  Bin counts and stock stay "not built"; this table is only the label registry.
- `registrations.pickup_slot_id` and `kit_slots`: phase 3, advisory only, never blocks.
- `admin_allowlist.role` (admin | desk | picker), default admin so nobody is locked out.

All tables RLS on, no policies, service role only.

## 4. Order rules (RPCs, all single-transaction and idempotent)

`kit_create_order(reg_ids, station, admin)`
- rejects unpaid, corporate, already collected, or already in an open order
- takes a free pigeonhole with `for update skip locked`; if none, the order waits `open`
  and is first in line when one frees
- scanning an already-ordered runner returns that order, never a second one
- bulk = same function with many reg_ids (cap 10)

`kit_dispatch()`: sweeps expired offers, then offers queued tasks (oldest first) to the
free picker with the right specialty who has been free longest and is not in `declined_by`.
The picker is marked busy at offer time so nobody gets two offers. Fallback to any free
picker after 90 s. Guarded by an advisory lock so only one sweep runs at a time.

Timer: every desk/picker/board poll calls `kit_dispatch()`; pg_cron runs it every 10 s as a
backstop. The 60 s is accurate to about 10 s in the worst case.

`kit_accept_task`, `kit_decline_task`, `kit_release_task` (supervisor).
`kit_put_away(task, hole_code, admin)`: checks the right hole, marks lines done, frees the
picker, and if it was the last task sets the order Ready in the same transaction.
`kit_fulfil_order(order, photo_path, admin)`: order Fulfilled, `checked_in = true`, hole
freed, logged. `kit_cancel_order(order, reason, admin)`: support only.

## 5. Picker flow and bins

For each item the picker scans the **bin label** first; only then the app reveals what to
take (item, size, count). Wrong bin = rejected.
- T-shirt: size bin (e.g. TS-M). No barcode on the shirt, the bin scan is the check.
- Pack: PACK bin.
- BIB: the BIB box covering that number (needs Q2), then scan the BIB itself to confirm it
  matches the runner.
Then walk to the pigeonhole, scan its label, confirm put-away.

## 6. Interaction with what exists

- `kit_generate_boxes`: redefined to create group boxes for corporate only.
- Reset action: also clears leftover expo bags from earlier dry runs.
- `kit_swap_size`: also updates open-order lines; blocked once a tshirt task is picked.
- `kit_desk_collect`: for expo now creates and immediately fulfils an order with a reason
  (support only).
- Counter screen: retired for expo (the desk screen replaces it). Dashboard shows orders.
- Vinay's mixed channel only matters for the corporate boxes now.

## 7. Capacity: why the pigeonhole count matters

Holes are busy from order creation to handover. Holes needed is roughly
orders per minute at peak times average minutes from creation to handover. Example: 3
orders/min at peak and 8 minutes average means about 24 holes in use. Fewer holes than
that and the desks queue even with idle pickers. Pick the count from your expected
expo-day arrival rate (Q3).

## 8. Edge cases covered

Size change while an order is open (blocked); picker phone dies (supervisor release); no
free hole (queues FIFO); same QR at two desks (second sees the existing order); child
runner (no bib or pack lines); bin empty (picker flags it, task pauses and shows on the
board); duplicate scans (idempotent); runner not paid (cannot order).

## 9. Build order (each step shippable)

1. Migration 0030 plus SQL test script (you run it, results back to me).
2. Auth roles (desk/picker) and the picker-safe data view.
3. Desk screen: scan, group select, create order, ready list, handover.
4. Picker screen: toggle, inbox with countdown, scan flow.
5. Floor board and stuck handling.
6. Bin and pigeonhole labels on the labels screen.
7. Dry run with 2 pickers and 2 holes.
8. Later: pickup slots plus WhatsApp pass, handover photo, batching one picker over
   several orders of the same kind, stock counts.

Every step: tsc and eslint, and I state plainly that nothing has run against real data.

## 10. Four answers needed before step 1

- **Q1 Volunteer login.** How many volunteers, and do they have Google accounts? If not,
  I use a badge-QR/PIN login limited to desk/picker routes.
- **Q2 BIB storage.** How are BIBs stored: boxes by number range (give the ranges), or
  loose? This decides the BIB bin scan.
- **Q3 Pigeonholes.** How many, and is a label like P-01 fine?
- **Q4 Handover identity.** Is the QR enough, or should desk check an ID for the person
  collecting (at least for group orders)?
- **Q5 Testing.** Use a Supabase branch (separate DB, may incur cost) for the dry run, or
  run SQL against production with the test script?
