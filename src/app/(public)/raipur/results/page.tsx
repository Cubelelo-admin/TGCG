import type { Metadata } from "next";
import { raipur } from "@/site/content/raipur";
import ResultsView from "@/site/views/ResultsView";

export const metadata: Metadata = { title: "Results & Certificates" };

export default function Page() {
  return <ResultsView e={raipur} />;
}
