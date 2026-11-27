import type { Metadata } from "next";
import { raigarh } from "@/site/content/raigarh";
import RacesView from "@/site/views/RacesView";

export const metadata: Metadata = { title: "Races, Schedule & Fees" };

export default function Page() {
  return <RacesView e={raigarh} />;
}
