import type { Metadata } from "next";
import { raipur } from "@/site/content/raipur";
import RegisterView from "@/site/views/RegisterView";

export const metadata: Metadata = { title: "Register" };

export default function Page() {
  return <RegisterView e={raipur} extraLinks={[{ href: "/comrades-qualifier", label: "Running Comrades? Get your fee back" }]} />;
}
