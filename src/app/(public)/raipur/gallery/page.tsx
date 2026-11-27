import type { Metadata } from "next";
import { raipur } from "@/site/content/raipur";
import GalleryView from "@/site/views/GalleryView";

export const metadata: Metadata = { title: "Gallery" };

export default function Page() {
  return <GalleryView e={raipur} />;
}
