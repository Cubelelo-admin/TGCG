import type { Metadata } from "next";
import { raipur } from "@/site/content/raipur";
import ContactView from "@/site/views/ContactView";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  return <ContactView e={raipur} />;
}
