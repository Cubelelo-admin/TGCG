import type { Metadata } from "next";
import { raipur } from "@/site/content/raipur";
import TrainingView from "@/site/views/TrainingView";

export const metadata: Metadata = { title: "Training Program" };

export default function Page() {
  return <TrainingView e={raipur} />;
}
