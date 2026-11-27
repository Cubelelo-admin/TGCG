import type { Metadata } from "next";
import { raipur } from "@/site/content/raipur";
import RaceDayView from "@/site/views/RaceDayView";

export const metadata: Metadata = { title: "Race-day Guide" };

export default function Page() {
  return <RaceDayView e={raipur} />;
}
