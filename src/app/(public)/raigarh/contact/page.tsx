import type { Metadata } from "next";
import { raigarh } from "@/site/content/raigarh";
import ContactView from "@/site/views/ContactView";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  return <ContactView e={raigarh} />;
}
