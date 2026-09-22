"use client";

import { DemoHeader } from "@/app/components/demo-header";

export function MapDemo() {
  return (
    <div style={{ minHeight: "100vh", background: "#F7FAF2" }}>
      <DemoHeader zone="map" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 32px" }}>
        <h1 style={{ fontFamily: "var(--font-dm-serif), serif", fontWeight: 400, fontSize: 40, color: "#3B4953" }}>
          Three workflows. One to automate first.
        </h1>
      </main>
    </div>
  );
}
