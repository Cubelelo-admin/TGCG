import type { Metadata } from "next";
import { raipur } from "@/site/content/raipur";
import RacesView from "@/site/views/RacesView";

export const metadata: Metadata = { title: "Races, Schedule & Fees" };

export default function Page() {
  return <RacesView e={raipur} />;
}
