import type { Metadata } from "next";
import { Suspense } from "react";
import { MapDemo } from "./map-demo";

export const metadata: Metadata = {
  title: "Map",
  robots: { index: false, follow: false },
};

export default function MapPage() {
  return (
    <Suspense fallback={null}>
      <MapDemo />
    </Suspense>
  );
}
