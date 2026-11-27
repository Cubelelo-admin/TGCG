import type { Metadata } from "next";
import { raigarh } from "@/site/content/raigarh";
import RegisterView from "@/site/views/RegisterView";

export const metadata: Metadata = { title: "Register" };

export default function Page() {
  return <RegisterView e={raigarh} />;
}
