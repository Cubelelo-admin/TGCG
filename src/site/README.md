# TGCG.run

Website for The Great Chhattisgarh Run events by LetsRun. Built with Next.js; it deploys to Vercel as-is.

## Run locally

```
npm install
npm run dev      # http://localhost:3000
npm run build    # production build check
```

## How it's organised

| URL | What |
| --- | --- |
| `/` | Event chooser — runners pick Raipur or Raigarh |
| `/raipur/...` | TGCG Raipur |
| `/raigarh/...` | TGCG Raigarh. Fully separate, with no links to Raipur |

Both events have the same general pages, so each can grow on its own:
`races`, `race-info`, `race-day`, `register`, `gallery`, `training`, `pace-calculator`, `results`, `contact`,
plus `calendar.ics` (add-to-calendar file) and an auto-generated link-preview image (`opengraph-image`).
Raipur also has `comrades-qualifier`.

**Content lives in one file per event — edit these, not the pages:**

- `src/site/content/raipur/index.ts` — dates, races, fees, prize money, BIB collection, hotels, videos, gallery, Instagram
- `src/site/content/raigarh/index.ts` — currently the date and Instagram handle. Fill in the rest as it's finalised.
- `src/site/content/organiser.ts` — LetsRun contact details shared by both events
- `src/site/content/events.ts` — the list shown on the chooser page (add future events here)

Any section that's empty shows "announcing soon" (or hides) automatically. Optional fields worth filling in:

| Field | Shows |
| --- | --- |
| `links.register` | Registration form. Without it, buttons become "Notify me on WhatsApp" |
| `registrationDeadlineDate` | "Registration closes in N days" chip (turns red in the last week) |
| `links.results` | BIB lookup on the Results page, e.g. `https://timing.example/results?bib={bib}` |
| `instagram.posts` | Embeds those Instagram posts/reels (paste post URLs) |
| `images.hero` / `images.card` | Photo behind the home hero / on the chooser card |
| `images.medal` | Medal showcase on the home page (needs a real medal photo) |
| `stats` | Count-up numbers on the home page (e.g. total finishers) |
| `testimonials` | Runner quotes on the home page |
| `sponsors` | Logo wall (falls back to `images.sponsors` poster) |
| `raceDay.parking` / `raceDay.bagDrop` | Race-day guide logistics |
| `training.points` | "What you get" list on the Training page |
| `venue.lat` / `venue.lng` | Map, directions and race-morning weather forecast |

Pages are shared templates in `src/site/views/`, so a new event only needs a content file plus a folder under `src/app/(public)/<city>/`
(copy `src/app/(public)/raigarh/`). Each event's colours are set in `src/app/(public)/globals.css` under `[data-event="..."]` and in `src/site/lib/og.tsx`.
Images go in `public/images/<city>/`.

Language: the EN / हिंदी / EN+हि switch in the header shows English, Hindi, or both. Use the `<Bi en="…" hi="…" />`
component (or a `className="hi"` span) for bilingual text.

Registration is embedded from the existing app (`tgcg.vercel.app/register`). When the Raigarh form exists, set
`links.register` in `raigarh.ts`.
