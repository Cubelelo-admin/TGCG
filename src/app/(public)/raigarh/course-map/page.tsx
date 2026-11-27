import type { Metadata } from "next";
import { raigarh } from "@/site/content/raigarh";
import CourseMapView from "@/site/views/CourseMapView";

export const metadata: Metadata = { title: "Course Map" };

export default function Page() {
  return <CourseMapView e={raigarh} />;
}
