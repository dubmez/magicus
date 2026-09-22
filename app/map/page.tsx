import type { Metadata } from "next";
import { MapDemo } from "./map-demo";

export const metadata: Metadata = {
  title: "Map",
  robots: { index: false, follow: false },
};

export default function MapPage() {
  return <MapDemo />;
}
