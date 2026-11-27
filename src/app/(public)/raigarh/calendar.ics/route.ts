import { raigarh } from "@/site/content/raigarh";
import { buildIcs, SITE_URL } from "@/site/lib/event";

export const dynamic = "force-static";

export function GET() {
  return new Response(buildIcs(raigarh, SITE_URL), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="raigarh-${raigarh.edition}.ics"`,
    },
  });
}
