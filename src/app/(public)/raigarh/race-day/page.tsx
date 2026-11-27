import type { Metadata } from "next";
import { raigarh } from "@/site/content/raigarh";
import RaceDayView from "@/site/views/RaceDayView";

export const metadata: Metadata = { title: "Race-day Guide" };

export default function Page() {
  return <RaceDayView e={raigarh} />;
}
