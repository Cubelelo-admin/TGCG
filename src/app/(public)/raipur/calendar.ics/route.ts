import { raipur } from "@/site/content/raipur";
import { buildIcs, SITE_URL } from "@/site/lib/event";

export const dynamic = "force-static";

export function GET() {
  return new Response(buildIcs(raipur, SITE_URL), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="raipur-${raipur.edition}.ics"`,
    },
  });
}
