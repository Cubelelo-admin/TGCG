import type { Metadata } from "next";
import EventShell from "@/site/components/EventShell";
import { raigarh } from "@/site/content/raigarh";

export const metadata: Metadata = {
  title: { default: `${raigarh.name} ${raigarh.edition}`, template: "%s | TGCG Raigarh" },
  description: `${raigarh.name}: ${raigarh.dateLabel}, Raigarh, Chhattisgarh. Register for TGCG Raigarh.`,
};

export default function RaigarhLayout({ children }: { children: React.ReactNode }) {
  return <EventShell e={raigarh}>{children}</EventShell>;
}
