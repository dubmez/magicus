"use client";

import { useState } from "react";
import Link from "next/link";
import { setDemoMode } from "@/app/components/demo-mode";
import { DEMO_WORKFLOWS, DEPARTMENTS, FRICTIONS, LEAD_FRICTION, type Friction } from "@/lib/demo-map";
import { MapEnquiry } from "./map-enquiry";
import { C, SERIF, button } from "./theme";

// Step one: where does work get stuck? The whole business first, in the words an
// executive would use, so the one they pick is theirs. The mapped ones open their
// map; the rest are honest about it and offer to map them in the audit.

export function Frictions() {
  const [asking, setAsking] = useState<string | null>(null);

  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: "48px 32px 72px" }}>
      <div style={{ fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: C.sage, marginBottom: 10 }}>
        Where does work get stuck?
      </div>
      <h1 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 44, margin: "0 0 10px", letterSpacing: "-0.01em" }}>
        Pick the one that costs you most.
      </h1>
      <p style={{ fontSize: 17, color: C.sage, margin: "0 0 36px", maxWidth: 720, lineHeight: 1.5 }}>
        The frictions we hear most, department by department. Pick one and we&apos;ll show you how it runs today, and where
        the value is.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 20, alignItems: "start" }}>
        {DEPARTMENTS.map((department) => (
          <section key={department} aria-label={department}>
            <h2 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: C.sage, margin: "0 0 12px" }}>
              {department}
            </h2>
            <div style={{ display: "grid", gap: 12 }}>
              {FRICTIONS.filter((f) => f.department === department).map((friction) => (
                <FrictionCard key={friction.id} friction={friction} onAsk={() => setAsking(friction.text)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div style={{ marginTop: 40, display: "flex", gap: 24 }}>
        <Link href="/map?screen=list" style={button.quiet}>
          Compare the mapped workflows side by side
        </Link>
      </div>

      {asking ? <MapEnquiry friction={asking} onClose={() => setAsking(null)} /> : null}
    </main>
  );
}

function FrictionCard({ friction, onAsk }: { friction: Friction; onAsk: () => void }) {
  const workflow = DEMO_WORKFLOWS.find((w) => w.id === friction.workflowId);
  const lead = friction.id === LEAD_FRICTION;

  const body = (
    <>
      {lead ? (
        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, color: C.coral, background: C.coralWash, borderRadius: 999, padding: "3px 9px", marginBottom: 10 }}>
          Most teams start here
        </span>
      ) : null}
      <div style={{ fontFamily: SERIF, fontSize: 20, lineHeight: 1.25, color: C.ink, marginBottom: 8 }}>{friction.text}</div>
      <div style={{ fontSize: 13, color: C.sage, lineHeight: 1.45, marginBottom: 14 }}>{friction.cost}</div>
      {workflow ? (
        <span style={{ fontSize: 14, fontWeight: 500, color: lead ? C.coral : C.ink }}>See how it runs →</span>
      ) : (
        <span style={{ fontSize: 13, fontWeight: 500, color: C.sage }}>Map it in your audit</span>
      )}
    </>
  );

  const card = {
    display: "block",
    textAlign: "left" as const,
    width: "100%",
    borderRadius: 14,
    padding: lead ? 17 : 18,
    textDecoration: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    background: workflow ? C.white : "transparent",
    border: lead ? `2px solid ${C.coral}` : `1px ${workflow ? "solid" : "dashed"} ${workflow ? C.rule : C.sageMid}`,
    boxShadow: lead ? "0 12px 32px rgba(232, 85, 62, 0.10)" : workflow ? "0 1px 2px rgba(59, 73, 83, 0.05)" : "none",
  };

  return workflow ? (
    <Link
      href={`/map/${workflow.slug}`}
      // The agent at the end of this map leads the rest of the demo.
      onClick={() => setDemoMode(workflow.id === "demo-contract-review" ? "contracts" : "invoices")}
      style={card}
    >
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onAsk} style={card}>
      {body}
    </button>
  );
}
