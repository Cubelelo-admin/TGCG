import type { Metadata } from "next";
import { raigarh } from "@/site/content/raigarh";
import RaceInfoView from "@/site/views/RaceInfoView";

export const metadata: Metadata = { title: "Race Information" };

export default function Page() {
  return <RaceInfoView e={raigarh} />;
}
