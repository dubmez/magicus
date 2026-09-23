"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DemoHeader } from "@/app/components/demo-header";
import { ButterflyCard, type StepMark } from "@/app/components/butterfly-card";
import { DetailPanel } from "@/app/components/detail-panel";
import { FRICTIONS, HOTSPOT_META, formatPounds, rankWorkflows, type RankedWorkflow } from "@/lib/demo-map";
import { MapEnquiry } from "./map-enquiry";
import { C, SANS, SERIF, button } from "./theme";

// Step two: here's how it runs today. The map as magicus draws it, with the
// places value sits marked on the steps and listed beside it: time, money
// leaking, risk. Money is named, never counted; the agent counts it.
// The agents live in another zone, so the way into one is a plain <a>.

const noop = () => {};

export function WorkflowMap({ slug }: { slug: string }) {
  const workflow = useMemo(() => rankWorkflows().find((w) => w.slug === slug)!, [slug]);
  const friction = FRICTIONS.find((f) => f.workflowId === workflow.id);
  const [scoring, setScoring] = useState(false);
  const [asking, setAsking] = useState(false);

  const marks: Record<number, StepMark> = Object.fromEntries(
    workflow.hotspots.map((h) => [h.step, { label: HOTSPOT_META[h.kind].label, fg: HOTSPOT_META[h.kind].fg, bg: HOTSPOT_META[h.kind].bg }]),
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: SANS }}>
      <DemoHeader zone="map" />
      <div style={{ display: "flex", minHeight: "calc(100vh - 65px)" }}>
        <main style={{ flex: 1, minWidth: 0, padding: "28px 32px 48px" }}>
          <Link href="/map" style={{ ...button.quiet, display: "inline-block", marginBottom: 20 }}>
            ← All frictions
          </Link>
          {friction ? (
            <div style={{ fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: C.sage, marginBottom: 10 }}>
              {friction.department} · {workflow.name}
            </div>
          ) : null}
          <h1 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 40, margin: "0 0 10px", letterSpacing: "-0.01em" }}>
            Here&apos;s how it runs today.
          </h1>
          <p style={{ fontSize: 18, color: C.ink, margin: "0 0 32px", maxWidth: 720, lineHeight: 1.5 }}>
            {workflow.summary}
          </p>
          <Butterflies workflow={workflow} marks={marks} />
        </main>

        {scoring ? (
          <DetailPanel
            workflow={workflow}
            readOnly
            hideFooter
            onClose={() => setScoring(false)}
            onExport={noop}
            onChain={noop}
            onDelete={noop}
            onUpdate={noop}
            readOnlyNote="Each step scored for how much of it an agent can take on. Close to return to the value."
          />
        ) : (
          <ValuePanel workflow={workflow} onScoring={() => setScoring(true)} onAsk={() => setAsking(true)} />
        )}
      </div>
      {asking ? <MapEnquiry friction={friction?.text ?? workflow.name} onClose={() => setAsking(false)} /> : null}
    </div>
  );
}

/**
 * The map: one butterfly, or a chain of them when the work waits part-way (the rule
 * is in lib/chaining.ts). Each link is labelled with the event the next one waits for.
 */
function Butterflies({ workflow, marks }: { workflow: RankedWorkflow; marks: Record<number, StepMark> }) {
  if (!workflow.chain) {
    return (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <ButterflyCard data={workflow} marks={marks} hideScore />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {workflow.chain.map((part, index) => (
        <div key={part.name} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <ButterflyCard
            data={{ ...part, steps: workflow.steps.filter((s) => s.n >= part.from && s.n <= part.to) }}
            marks={marks}
            hideScore
          />
          {part.handoff && index < workflow.chain!.length - 1 ? (
            <div aria-label={`Then: ${part.handoff}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "6px 0 14px" }}>
              <div style={{ height: 18, borderLeft: `1.5px dashed ${C.sageMid}` }} />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.sage,
                  background: C.white,
                  border: `1px solid ${C.rule}`,
                  borderRadius: 999,
                  padding: "4px 12px",
                }}
              >
                Waits for: {part.handoff}
              </span>
              <div style={{ height: 18, borderLeft: `1.5px dashed ${C.sageMid}` }} />
              <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `5px solid ${C.sageMid}` }} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ValuePanel({ workflow, onScoring, onAsk }: { workflow: RankedWorkflow; onScoring: () => void; onAsk: () => void }) {
  const hotspots = [...workflow.hotspots].sort((a, b) => a.step - b.step);
  return (
    <aside
      style={{
        width: 380,
        flexShrink: 0,
        borderLeft: `1px solid ${C.rule}`,
        background: C.white,
        padding: "32px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 28,
        alignSelf: "flex-start",
        position: "sticky",
        top: 65,
        minHeight: "calc(100vh - 65px)",
      }}
    >
      <section>
        <h2 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: C.sage, margin: "0 0 14px" }}>
          Where the value is
        </h2>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
          {hotspots.map((h) => {
            const meta = HOTSPOT_META[h.kind];
            return (
              <li key={h.step} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: meta.bg, borderRadius: 10, padding: "10px 12px" }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: C.sage,
                    color: C.white,
                    fontSize: 11,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 1,
                  }}
                  aria-label={`Step ${h.step}`}
                >
                  {h.step}
                </span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: meta.fg, marginBottom: 2 }}>{meta.label}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.4 }}>{h.label}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <h2 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: C.sage, margin: "0 0 12px" }}>
          What it costs now
        </h2>
        <dl style={{ margin: 0, display: "grid", gap: 8, fontSize: 15 }}>
          <Fact term={`${workflow.hoursPerMonth} hours a month`} detail={`about ${formatPounds(workflow.costPerMonth)} of ${workflow.owner.toLowerCase()} time`} />
          <Fact term={`~${workflow.hoursBack} hours back`} detail="each month, with an agent on it" strong />
        </dl>
        {workflow.teaser ? <p style={{ fontSize: 14, color: C.coral, margin: "12px 0 0", fontWeight: 500 }}>{workflow.teaser}</p> : null}
      </section>

      <div style={{ display: "grid", gap: 14 }}>
        {workflow.agentHref ? (
          <a href={workflow.agentHref} style={button.primary}>
            Put an agent on it →
          </a>
        ) : (
          <button type="button" onClick={onAsk} style={button.primary}>
            Map this in your audit →
          </button>
        )}
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <button type="button" onClick={onScoring} style={button.quiet}>
            How each step scores
          </button>
          <Link href="/map?screen=list" style={button.quiet}>
            Compare workflows
          </Link>
        </div>
      </div>
    </aside>
  );
}

function Fact({ term, detail, strong }: { term: string; detail: string; strong?: boolean }) {
  return (
    <div>
      <dt style={{ display: "inline", fontWeight: strong ? 600 : 500 }}>{term}</dt>{" "}
      <dd style={{ display: "inline", margin: 0, color: C.sage }}>{detail}</dd>
    </div>
  );
}
