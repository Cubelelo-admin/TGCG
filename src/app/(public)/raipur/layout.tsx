import type { Metadata } from "next";
import EventShell from "@/site/components/EventShell";
import { raipur } from "@/site/content/raipur";

export const metadata: Metadata = {
  title: { default: `${raipur.name} ${raipur.edition}`, template: "%s | TGCG Raipur" },
  description: `${raipur.name}: ${raipur.dateLabel}, ${raipur.venue.name}, Naya Raipur. Marathon, Half Marathon, 10K and 6K Dream Run on a World Athletics measured course and Comrades qualifier.`,
  // Link-preview image comes from ./opengraph-image.tsx
};

export default function RaipurLayout({ children }: { children: React.ReactNode }) {
  return <EventShell e={raipur}>{children}</EventShell>;
}
