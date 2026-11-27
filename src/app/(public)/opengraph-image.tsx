import { renderChooserOg } from "@/site/lib/og";

export const alt = "The Great Chhattisgarh Run — choose your run";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderChooserOg();
}
