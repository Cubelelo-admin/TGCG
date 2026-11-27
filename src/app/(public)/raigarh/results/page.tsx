import type { Metadata } from "next";
import { raigarh } from "@/site/content/raigarh";
import ResultsView from "@/site/views/ResultsView";

export const metadata: Metadata = { title: "Results & Certificates" };

export default function Page() {
  return <ResultsView e={raigarh} />;
}
