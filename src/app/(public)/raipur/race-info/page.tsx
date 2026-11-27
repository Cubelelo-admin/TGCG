import type { Metadata } from "next";
import { raipur } from "@/site/content/raipur";
import RaceInfoView from "@/site/views/RaceInfoView";

export const metadata: Metadata = { title: "Race Information" };

export default function Page() {
  return <RaceInfoView e={raipur} />;
}
