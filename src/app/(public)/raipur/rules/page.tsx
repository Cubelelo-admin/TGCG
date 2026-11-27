import type { Metadata } from "next";
import { raipur } from "@/site/content/raipur";
import RulesView from "@/site/views/RulesView";

export const metadata: Metadata = {
  title: "Rules & FAQ",
  description: "Rules, prize money conditions, BIB collection and frequently asked questions for TGCG Raipur.",
};

export default function Page() {
  return <RulesView e={raipur} />;
}
