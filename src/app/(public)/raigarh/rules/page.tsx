import type { Metadata } from "next";
import { raigarh } from "@/site/content/raigarh";
import RulesView from "@/site/views/RulesView";

export const metadata: Metadata = {
  title: "Rules & FAQ",
  description: "Rules, BIB collection and frequently asked questions for TGCG Raigarh.",
};

export default function Page() {
  return <RulesView e={raigarh} />;
}
