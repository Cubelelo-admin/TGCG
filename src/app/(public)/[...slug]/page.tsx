import { notFound } from "next/navigation";

// Catch-all for URLs that match no other route, so they get the public site's branded 404
// (../not-found.tsx). Real routes (/register, /admin, /api, /raipur, ...) always take precedence
// over a catch-all. Used instead of app/global-not-found.tsx, which pulled the public site's fonts
// onto every page, including /register.
export default function CatchAll() {
  notFound();
}
