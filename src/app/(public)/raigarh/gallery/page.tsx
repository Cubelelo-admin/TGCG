import type { Metadata } from "next";
import { raigarh } from "@/site/content/raigarh";
import GalleryView from "@/site/views/GalleryView";

export const metadata: Metadata = { title: "Gallery" };

export default function Page() {
  return <GalleryView e={raigarh} />;
}
