# tgcg.run content audit (2026-09-12)

Raw content pulled from the old Taplink site (tgcg.run) and its sub-pages, for
rebuilding as structured pages on the new site (Home / Registration / Race
Information / Gallery / Rules & Regulations / FAQs). User said: don't copy the
old page's visual design (messy Taplink typography) — just reuse this content
and the links, in our own clean design.

**Known stale data**: the two PDFs below are dated for the **2025** edition
(event date "7th Dec 2025", reg deadline "27th Nov 2025", prices
₹1600/₹1300). User decision: reuse the substantive policy text, swap every
2025-specific date/price for the confirmed 2026 value. Confirmed 2026 values
are in the "Confirmed 2026 facts" section below.

## Confirmed 2026 facts (use these, not the stale PDF dates)

- Event date: **Sunday 20 December 2026**
- Venue: Ekatma Path Park, Ekatma Path (road towards Mantralaya), Sector 21,
  Atal Nagar–Nava Raipur, CG 492001. Map: https://maps.google.com/?q=21.1663205,81.77265215&z=15
- Last date for registration: **10 December 2026**
- BIB collection: **18 Dec 2026, 11 AM–5 PM** and **19 Dec 2026, 10 AM–3 PM**,
  at Vrindavan Hall, Civil Lines, Raipur CG. Map: https://maps.app.goo.gl/W2gAj4VL5e9mHaE78
- Contact: letsrunteam@gmail.com · WhatsApp +91 8305387786 (830-LETSRUN)
- Tagline: "The Great Chhattisgarh Run" (not "Games"), 9th edition, RFID
  timed, first run in Central India certified by AIMS/IAAF.
- Theme this year: **river conservation** — "Run With The Flow" /
  "Rivers Run Through Us — Run for Cleaner Greener Rivers"
- Sponsors seen on page: HIRA, Sky TM

## PRICING — unresolved, currently NOT changed

Three different price lists were found across sources:
1. **Townscript checkout (live, verified 2026-09-12)** — currently seeded in
   Supabase and what the site charges: Competitive (21K/10K/42K) ₹1,454;
   Non-Competitive (42K/21K/10K/6K) ₹1,205. Page noted "excluding GST and
   booking fees."
2. **tgcg.run event page "Fee" section** (looks current, 2026-dated page):
   Competitive ₹1,750; Non-Competitive ₹1,450.
3. **Stale 2025 Race Information PDF**: Competitive ₹1,600; Non-Competitive
   ₹1,300–1,600 (do not use — wrong edition).

User's decision (2026-09-12): keep the Townscript-verified prices (#1) live
for now; don't reconcile with #2. Building a configurable catalog-editing UI
in the admin dashboard is a deferred fast-follow, not blocking launch.

## Race Information (from tgcg.run event page + PDF, policy parts still valid)

**Distances**: 6KM Dream Run (new/leisure runners, families) · 10KM
Beginners Delight (competitive + non-competitive) · 21KM Half Marathon ·
42KM Marathon (AIMS/IAAF certified, first in Central India, rolled out 2022).

**Age eligibility** (as of race day): 6KM 12+ · 10KM 14+ · 21KM 16+ · 42KM 18+.

**Race timings**:
| Category | Assemble | Warm-up Zumba | Start | Cut-off | End by |
|---|---|---|---|---|---|
| 42.195KM Marathon | 3:30 AM | 3:40 AM | 4:00 AM | 6:30 hrs | 10:30 AM |
| 21.09KM Half Marathon | 5:00 AM | 5:10 AM | 5:30 AM | 3:30 hrs | 9:00 AM |
| 10KM Beginners Delight | 6:00 AM | 6:10 AM | 6:30 AM | 2:00 hrs | 8:30 AM |
| 6KM Dream Run | 6:30 AM | 6:40 AM | 7:30 AM | 1:30 hrs | 9:00 AM |

**Prize money age groups**: Open (race-minimum age–34), 35–45, 46+. Equal
prize money for men and women in each age group. Cash prizes for 1st/2nd/3rd
in 42KM, 21KM, 10KM only (not 6KM). Minimum 10 finishers required in a
category for prizes to be awarded. (Exact rupee amounts were only found in
the stale 2025 PDF and a 2026-dated banner graphic on tgcg.run that wasn't
machine-readable — get current prize amounts from the organizer before
publishing a prize table.)

**Race tracks** (external route-map links, still referenced from the 2026
page): Marathon https://www.plotaroute.com/route/2027134?units=km · 21K
https://www.plotaroute.com/route/2082962?units=km · 10K
https://www.plotaroute.com/route/2080162?units=km · 6K
https://www.plotaroute.com/route/2080164?units=km

**What's included**: Medal, chip-timed BIB, DryFit event T-shirt, bag,
napkin, BIB clips, other goodies, internationally recognized online timing
certificate, post-run hot breakfast, physio, entertainment/games, water on
course, professional event photos.

**Hospitality** (2025 PDF, verify current rates before publishing): Courtyard
Marriott ₹7,243/night (+91 7714330000) · Hyatt Raipur rack rate
(+91 8370009064) · Ariena ₹2,800/night (+91 7714054056) · Tulip Arena
₹2,000/night (+91 7223058886). Hotels-near-venue list:
https://maps.app.goo.gl/DqvNrUkrCBEdKjzy9

**Comrades Marathon qualifier angle** (separate sub-page, worth a mention on
Race Information): TGCG's marathon track has been World Athletics
measurement-certified since 2019, pitched as India's best course for
qualifying times ahead of the Comrades Marathon (South Africa). Runners who
register, then show proof of their Comrades registration, get their TGCG
entry fee refunded in full.

## Rules & Regulations + FAQ

Full text (37 numbered general rules, prize-distribution rules, BIB
collection rules, protest/appeals process, medical-advice note, refund and
transfer policy, and a structured FAQ) was extracted from the stale 2025 PDF
and saved during this session but NOT committed to the repo (extraction was
done in a temp scratchpad dir that no longer exists). It is substantially
generic year-over-year policy — re-extract from
https://pdfhost.io/pdf/6b10f690-2bc3-46a1-aa05-e94c49c65e14.pdf (Rules) and
https://pdfhost.io/pdf/a7b008ac-f17a-49f4-aa74-ed406f7c81f0.pdf (Race Info)
if needed again, or ask the organizer for an updated 2026 version — and swap
every "2025"/date reference for the confirmed 2026 facts above. Key policy
points worth keeping verbatim: entries are non-transferable and
non-refundable; no wheeled vehicles/pets/pacers on course; disqualification
for bib tampering or running under someone else's bib; cut-off times are
hard; a ₹1,000 non-refundable fee applies to appeal a result, submitted
within 30 minutes of results, replied to within 15 days; prize money paid by
cheque/bank transfer within 30 working days of ratified results, subject to
TDS; max 2 race kits collectible per person (self + one authorized other with
ID proof).

## Embeds and links to reuse

**YouTube videos**:
- Opening teaser 2026: https://www.youtube.com/shorts/CvWD1hgjuMk
- Anthem: https://www.youtube.com/watch?v=miD3QQCGSN8 ("HIRA TGCG.run Anthem — A Decade of Heart, Spirit & Run!")
- Gallery: 2024 recap https://www.youtube.com/watch?v=6QFGF42GMA8 · 2023 recap https://www.youtube.com/watch?v=d7iIxBuqxXY · 2022 film https://www.youtube.com/watch?v=swm8nJZSOlo · 2021 https://www.youtube.com/watch?v=danL7Q5fsXY · 2020 https://www.youtube.com/watch?v=O0OGxkx0yVg · 2025 recap https://www.youtube.com/watch?v=W-ekY87Mds8
- Track discussion with Amir: https://www.youtube.com/watch?v=2HkaVO2LAhM

**Social / contact**: Facebook https://www.facebook.com/letsrun.us/ ·
Instagram (LetsRun) https://instagram.com/letsrun.us/ · Instagram (TGCG)
https://instagram.com/tgcg.run/ · YouTube channel
https://www.youtube.com/@letsrunteam1317 · WhatsApp helpline
whatsapp://send?phone=918305387786

**Gallery photo carousel images** (taplink-hosted JPGs/PNGs, reusable as-is
or as a reference for what to ask the organizer to re-supply at higher res):
https://p.taplink.st/p/e/7/6/6/63562344.jpg
https://p.taplink.st/p/4/f/7/5/63562347.jpg
https://p.taplink.st/p/a/6/4/0/63562350.jpg
https://p.taplink.st/p/a/1/7/d/63562353.jpg
https://p.taplink.st/p/2/b/9/8/63562366.jpg
https://p.taplink.st/p/e/8/8/7/63562370.jpg
https://p.taplink.st/p/f/b/5/b/63562372.jpg
https://p.taplink.st/p/e/6/0/d/63562374.jpg
https://p.taplink.st/p/0/e/0/5/63608018.jpg
https://p.taplink.st/p/0/1/1/b/63608029.jpg
https://p.taplink.st/p/6/6/e/5/63608049.jpg

**Legal entity** (for footer): LetsRun Team, Raipur CG 492001. Formally:
Runmatics OPC PVT LTD. CIN: U92490CT2016OPC007591.
