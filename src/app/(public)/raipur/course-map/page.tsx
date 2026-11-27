import type { Metadata } from "next";
import { raipur } from "@/site/content/raipur";
import CourseMapView from "@/site/views/CourseMapView";

export const metadata: Metadata = {
  title: "Course Map",
  description: "Interactive course map for every TGCG Raipur race: route, km markers, U-turns, elevation and parking.",
};

export default function Page() {
  return <CourseMapView e={raipur} />;
}
