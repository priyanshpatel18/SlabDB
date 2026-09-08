import type { Metadata } from "next";
import { Console } from "@/components/console";

export const metadata: Metadata = {
  title: "Console · Slab",
  description: "SQL workstation for Slab. Local preview of the v0 subset.",
};

export default function ConsolePage() {
  return <Console />;
}
