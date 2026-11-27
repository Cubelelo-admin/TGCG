import type { Metadata } from "next";
import { raigarh } from "@/site/content/raigarh";
import PaceView from "@/site/views/PaceView";

export const metadata: Metadata = { title: "Pace Calculator" };

export default function Page() {
  return <PaceView e={raigarh} />;
}
