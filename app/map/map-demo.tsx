"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DemoHeader } from "@/app/components/demo-header";
import { DemoProcessing } from "@/app/components/demo-processing";
import { ButterflyCard } from "@/app/components/butterfly-card";
import { DetailPanel } from "@/app/components/detail-panel";
import {
  CAPTURE_VIDEO_SRC,
  PROCESSING_MESSAGES,
  PROCESSING_MS,
  formatPounds,
  rankWorkflows,
  type RankedWorkflow,
} from "@/lib/demo-map";

// Act 1 of the finance demo. A capture of someone doing their job, the steps
// magicus found in it, and a ranked answer to "what should we automate first?"
// The agents live in another zone of this domain, so every link into them is
// a plain <a>: a client-side hop across zones would load the wrong app.

type Screen = "capture" | "processing" | "list" | "detail";

const C = {
  bg: "#F7FAF2",
  ink: "#3B4953",
  sage: "#547863",
  sageMid: "#90AB8B",
  surface: "#EBF4DD",
  rule: "#E3EAD8",
  white: "#FFFFFF",
  coral: "#E8553E",
};
const SANS = "var(--font-dm-sans), system-ui, sans-serif";
const SERIF = "var(--font-dm-serif), Georgia, serif";

const noop = () => {};

export function MapDemo() {
  const params = useSearchParams();
  const ranked = useMemo(() => rankWorkflows(), []);
  // Cold opens for a presenter: ?screen=list skips the capture, ?open=<id>
  // goes straight to one workflow's map.
  const opened = ranked.find((w) => w.id === params.get("open"))?.id ?? null;
  const initial: Screen = opened ? "detail" : params.get("screen") === "list" ? "list" : "capture";
  const [screen, setScreen] = useState<Screen>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(opened);
  const selected = ranked.find((w) => w.id === selectedId) ?? null;

  const toList = useCallback(() => setScreen("list"), []);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: SANS }}>
      <DemoHeader zone="map" />
      {screen === "capture" ? <Capture onDone={() => setScreen("processing")} /> : null}
      {screen === "processing" ? (
        <DemoProcessing messages={PROCESSING_MESSAGES} durationMs={PROCESSING_MS} onDone={toList} />
      ) : null}
      {screen === "list" ? (
        <RankedList
          ranked={ranked}
          onOpen={(id) => {
            setSelectedId(id);
            setScreen("detail");
          }}
        />
      ) : null}
      {screen === "detail" && selected ? (
        <Detail workflow={selected} onBack={() => setScreen("list")} />
      ) : null}
    </div>
  );
}

function Capture({ onDone }: { onDone: () => void }) {
  const [missing, setMissing] = useState(false);
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px 64px" }}>
      <div style={{ fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: C.sage, marginBottom: 10 }}>
        The capture
      </div>
      <h1 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 40, margin: "0 0 24px", letterSpacing: "-0.01em" }}>
        A finance manager, doing the job.
      </h1>
      <div
        style={{
          position: "relative",
          aspectRatio: "16 / 9",
          maxWidth: "100%",
          borderRadius: 16,
          overflow: "hidden",
          background: C.surface,
          border: `1px solid ${C.rule}`,
        }}
      >
        {missing ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: C.sage,
              textAlign: "center",
              padding: 24,
            }}
          >
            <div style={{ fontFamily: SERIF, fontSize: 26, color: C.ink }}>Capture goes here</div>
            <div style={{ fontSize: 14 }}>60 to 90 seconds: Gmail, Google Drive, checking by eye, Slack.</div>
          </div>
        ) : (
          <video
            src={CAPTURE_VIDEO_SRC}
            autoPlay
            muted
            playsInline
            controls
            onEnded={onDone}
            onError={() => setMissing(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button
          type="button"
          onClick={onDone}
          style={{
            fontFamily: SANS,
            fontSize: 15,
            fontWeight: 500,
            height: 44,
            padding: "0 20px",
            borderRadius: 10,
            border: `1px solid ${C.rule}`,
            background: C.white,
            color: C.ink,
            cursor: "pointer",
          }}
        >
          Skip to the map →
        </button>
      </div>
    </main>
  );
}

function RankedList({ ranked, onOpen }: { ranked: RankedWorkflow[]; onOpen: (id: string) => void }) {
  const [top] = ranked;
  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 32px 72px" }}>
      <h1 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 44, margin: "0 0 10px", letterSpacing: "-0.01em" }}>
        Three workflows. One to automate first.
      </h1>
      <p style={{ fontSize: 17, color: C.sage, margin: "0 0 36px" }}>
        Ranked by the hours automating each one gives back. The first one is worth ~{top.hoursBack} hours back each
        month.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {ranked.map((workflow, index) => (
          <WorkflowCard key={workflow.id} workflow={workflow} first={index === 0} rank={index + 1} onOpen={onOpen} />
        ))}
      </div>
    </main>
  );
}

function WorkflowCard({
  workflow,
  first,
  rank,
  onOpen,
}: {
  workflow: RankedWorkflow;
  first: boolean;
  rank: number;
  onOpen: (id: string) => void;
}) {
  return (
    <article
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        background: C.white,
        borderRadius: 16,
        border: first ? `2px solid ${C.coral}` : `1px solid ${C.rule}`,
        padding: first ? 27 : 28,
        boxShadow: first ? "0 12px 32px rgba(232, 85, 62, 0.10)" : "0 1px 2px rgba(59, 73, 83, 0.05)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, minHeight: 26 }}>
        <span style={{ fontSize: 13, color: C.sageMid, fontVariantNumeric: "tabular-nums" }}>{rank}</span>
        {first ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: C.coral,
              background: "#FDEBE7",
              borderRadius: 999,
              padding: "4px 10px",
            }}
          >
            Automate this first
          </span>
        ) : null}
      </div>

      <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 26, margin: "0 0 4px", lineHeight: 1.15 }}>
        {workflow.name}
      </h2>
      <div style={{ fontSize: 14, color: C.sage, marginBottom: 22 }}>{workflow.owner}</div>

      <dl style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, margin: "0 0 18px" }}>
        <Stat label="Readiness" value={`${workflow.readiness}%`} />
        <Stat label="Hours per month" value={`${workflow.hoursPerMonth}`} />
        <Stat label="Cost per month" value={formatPounds(workflow.costPerMonth)} />
      </dl>

      <div style={{ fontSize: 15, color: C.ink, marginBottom: first ? 8 : 20 }}>
        <strong style={{ fontWeight: 600 }}>~{workflow.hoursBack} hours back</strong> each month
      </div>
      {first && workflow.reason ? (
        <p style={{ fontSize: 14, color: C.sage, lineHeight: 1.5, margin: "0 0 20px" }}>{workflow.reason}</p>
      ) : null}

      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        {workflow.agentHref ? (
          <a
            href={workflow.agentHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 44,
              padding: "0 18px",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 500,
              textDecoration: "none",
              background: first ? C.coral : C.white,
              color: first ? C.white : C.ink,
              border: first ? "none" : `1px solid ${C.rule}`,
            }}
          >
            Automate this →
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => onOpen(workflow.id)}
          style={{
            fontFamily: SANS,
            fontSize: 14,
            fontWeight: 500,
            color: C.sage,
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          See the map
        </button>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: C.bg, borderRadius: 10, padding: "10px 12px" }}>
      <dt style={{ fontSize: 11, color: C.sage, marginBottom: 4 }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</dd>
    </div>
  );
}

function Detail({ workflow, onBack }: { workflow: RankedWorkflow; onBack: () => void }) {
  return (
    <div style={{ display: "flex", height: "calc(100vh - 65px)" }}>
      <main style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "28px 32px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onBack}
            style={{ fontFamily: SANS, fontSize: 14, color: C.sage, background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            ← All three workflows
          </button>
          <div style={{ flex: 1 }} />
          {workflow.agentHref ? (
            <a
              href={workflow.agentHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 44,
                padding: "0 18px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 500,
                textDecoration: "none",
                background: C.coral,
                color: C.white,
              }}
            >
              Automate this →
            </a>
          ) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ButterflyCard data={workflow} />
        </div>
      </main>
      <DetailPanel
        workflow={workflow}
        readOnly
        onClose={onBack}
        onExport={noop}
        onChain={noop}
        onDelete={noop}
        onUpdate={noop}
        readOnlyNote="Mapped from the capture. Readiness is scored step by step."
      />
    </div>
  );
}
