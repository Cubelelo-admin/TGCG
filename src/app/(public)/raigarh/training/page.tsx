import type { Metadata } from "next";
import { raigarh } from "@/site/content/raigarh";
import TrainingView from "@/site/views/TrainingView";

export const metadata: Metadata = { title: "Training Program" };

export default function Page() {
  return <TrainingView e={raigarh} />;
}
