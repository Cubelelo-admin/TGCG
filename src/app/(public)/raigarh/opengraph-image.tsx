import { raigarh } from "@/site/content/raigarh";
import { renderEventOg } from "@/site/lib/og";

export const alt = `${raigarh.shortName} ${raigarh.edition}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600; // label flips from REGISTER to RACE DAY after the deadline

export default function Image() {
  return renderEventOg(raigarh);
}
