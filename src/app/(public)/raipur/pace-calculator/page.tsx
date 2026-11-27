import type { Metadata } from "next";
import { raipur } from "@/site/content/raipur";
import PaceView from "@/site/views/PaceView";

export const metadata: Metadata = { title: "Pace Calculator" };

export default function Page() {
  return <PaceView e={raipur} />;
}
