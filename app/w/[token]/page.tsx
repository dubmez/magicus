"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Download, Clock, Zap, Hand, Link2, AlertTriangle } from "lucide-react";
import {
  type Workflow,
  type Step,
  THEME_META,
  CLASSIFICATION_META,
  calculateAutomationScore,
} from "@/lib/workflows";
import {
  getShare,
  incrementRemixCount,
  type ShareSettings,
} from "@/lib/shares";
import { useAuth } from "@/lib/auth-context";
import { workflowToMarkdown } from "@/lib/markdown";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };
const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

// ─── Header ────────────────────────────────────────────────────────────────
function PublicHeader() {
  return (
    <header
      className="flex items-center justify-between"
      style={{
        padding: "20px 32px",
        borderBottom: "1px solid #EBF4DD",
        background: "#FFFFFF",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <Link href="/" className="flex items-center gap-3" style={{ textDecoration: "none" }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "#3B4953",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#EBF4DD",
            ...dmSerif,
            fontSize: 16,
          }}
        >
          m
        </div>
        <span style={{ ...dmSerif, fontSize: 22, color: "#3B4953", letterSpacing: -0.2 }}>
          magicus
        </span>
      </Link>
      <Link
        href="/"
        className="hover:opacity-90 transition-opacity"
        style={{
          background: "#3B4953",
          color: "#EBF4DD",
          padding: "8px 16px",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 500,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        Sign up free →
      </Link>
    </header>
  );
}

// ─── Step row (read-only) ─────────────────────────────────────────────────
function PublicStepRow({
  step,
  hidden,
  showClassification,
}: {
  step: Step;
  hidden: boolean;
  showClassification: boolean;
}) {
  if (hidden) {
    return (
      <li
        style={{
          background: "#F1EFE8",
          borderRadius: 10,
          padding: "12px 14px",
          color: "#90AB8B",
          fontStyle: "italic",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 10,
          filter: "blur(0.4px)",
        }}
      >
        <span
          style={{
            background: "#90AB8B",
            color: "#FFFFFF",
            fontSize: 10,
            fontWeight: 600,
            width: 20,
            height: 20,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {step.n}
        </span>
        [Hidden by author]
      </li>
    );
  }
  const meta = step.classification ? CLASSIFICATION_META[step.classification] : null;
  return (
    <li
      style={{
        background: "#F7FAF2",
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          style={{
            background: "#3B4953",
            color: "#EBF4DD",
            fontSize: 11,
            fontWeight: 600,
            width: 22,
            height: 22,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          {step.n}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: "#3B4953", fontWeight: 500, lineHeight: 1.4 }}>
            {step.text}
          </div>
          {step.note && (
            <div
              style={{
                ...dmSerif,
                fontSize: 12,
                color: "#90AB8B",
                marginTop: 4,
                fontStyle: "italic",
              }}
            >
              {step.note}
            </div>
          )}
          {step.owner && (
            <div
              style={{
                display: "inline-block",
                marginTop: 8,
                fontSize: 11,
                color: "#547863",
                background: "#EBF4DD",
                padding: "2px 9px",
                borderRadius: 999,
              }}
            >
              {step.owner}
            </div>
          )}
        </div>
        {showClassification && meta && (
          <span
            style={{
              background: meta.bg,
              color: meta.fg,
              border: `1px solid ${meta.fg}4D`,
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 500,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {meta.label}
          </span>
        )}
        {step.screenshot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={step.screenshot}
            alt={`Frame for step ${step.n}`}
            style={{
              width: 80,
              height: 50,
              objectFit: "cover",
              borderRadius: 6,
              border: "1px solid #EBF4DD",
              flexShrink: 0,
            }}
          />
        )}
      </div>
    </li>
  );
}

// ─── Page body ─────────────────────────────────────────────────────────────
function ShareBody({ settings }: { settings: ShareSettings }) {
  const { user, openGate } = useAuth();
  const router = useRouter();
  const { workflow, redactions, sharedBy, remixCount } = settings;
  const [remixed, setRemixed] = useState(false);

  const score = useMemo(() => calculateAutomationScore(workflow.steps), [workflow.steps]);
  const themeMeta = THEME_META[workflow.theme];

  const visibleSteps = workflow.steps; // We show all, but mark redacted as [Hidden]
  const visibleInputs = workflow.inputs.filter(
    (_, i) => !redactions.hiddenInputIndices.includes(i)
  );
  const visibleOutputs = workflow.outputs.filter(
    (_, i) => !redactions.hiddenOutputIndices.includes(i)
  );

  const triggerLabel = workflow.trigger
    ? workflow.trigger.type === "chained"
      ? "Triggered by an upstream workflow"
      : redactions.triggerDescription
      ? "Trigger details hidden"
      : workflow.trigger.description ?? `On ${workflow.trigger.type}`
    : "Trigger not set";

  const TriggerIcon =
    workflow.trigger?.type === "schedule"
      ? Clock
      : workflow.trigger?.type === "event"
      ? Zap
      : workflow.trigger?.type === "manual"
      ? Hand
      : workflow.trigger?.type === "chained"
      ? Link2
      : AlertTriangle;

  const handleRemix = () => {
    if (!user) {
      openGate(() => doRemix());
      return;
    }
    doRemix();
  };

  // Build a non-redacted clone, write it through to localStorage, navigate
  // to the canvas. We don't have direct access to page.tsx state from a
  // separate route, so we set a 'pending remix' key that page.tsx picks up
  // on mount.
  const doRemix = () => {
    const cloned: Workflow = {
      id: `wf-${Date.now()}`,
      theme: workflow.theme,
      name: workflow.name,
      trigger: redactions.triggerDescription ? null : workflow.trigger,
      why: redactions.purpose ? "" : workflow.why,
      inputs: workflow.inputs.filter((_, i) => !redactions.hiddenInputIndices.includes(i)),
      outputs: workflow.outputs.filter((_, i) => !redactions.hiddenOutputIndices.includes(i)),
      steps: workflow.steps
        .filter((s) => !redactions.hiddenStepNumbers.includes(s.n))
        .map((s, i) => ({
          ...s,
          n: i + 1,
          // Strip classification if it was redacted in the share
          classification: redactions.classifications ? undefined : s.classification,
        })),
      tools: redactions.tools ? [] : workflow.tools,
      automationScore: 0,
      automationRationale: redactions.classifications ? "" : workflow.automationRationale,
      x: 0,
      y: 0,
      remixedFrom: {
        workflowName: workflow.name,
        sharedBy: sharedBy.name,
        shareToken: settings.token,
      },
    };

    // Hand off to page.tsx via a localStorage 'inbox' the canvas reads on
    // mount. This avoids cross-route state plumbing.
    try {
      localStorage.setItem("magicus:pending-remix", JSON.stringify(cloned));
    } catch { /* localStorage refused — proceed anyway */ }

    incrementRemixCount(settings.token);
    setRemixed(true);
    // Brief moment so the user sees the toast register before navigating.
    setTimeout(() => router.push("/"), 600);
  };

  const handleExport = () => {
    // Build a redacted-respecting clone, export as markdown.
    const cloned: Workflow = {
      ...workflow,
      trigger: redactions.triggerDescription ? null : workflow.trigger,
      why: redactions.purpose ? "" : workflow.why,
      tools: redactions.tools ? [] : workflow.tools,
      inputs: workflow.inputs.filter((_, i) => !redactions.hiddenInputIndices.includes(i)),
      outputs: workflow.outputs.filter((_, i) => !redactions.hiddenOutputIndices.includes(i)),
      steps: workflow.steps.filter((s) => !redactions.hiddenStepNumbers.includes(s.n)),
    };
    const md = workflowToMarkdown(cloned);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflow.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "workflow"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main
      style={{
        ...dmSans,
        background: "#F7FAF2",
        minHeight: "calc(100vh - 70px)",
        paddingBottom: 100, // sticky footer clearance
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 24px 64px",
        }}
      >
        {/* Header section */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              ...dmSerif,
              fontSize: 32,
              color: "#3B4953",
              lineHeight: 1.15,
              letterSpacing: -0.5,
              marginBottom: 12,
            }}
          >
            {workflow.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 14 }}>
            <span
              className="flex items-center gap-1.5"
              style={{
                background: "#FFFFFF",
                border: "1px solid #EBF4DD",
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: 11,
                color: "#547863",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 999, background: themeMeta.dot }} />
              {themeMeta.label}
            </span>
            {!redactions.classifications && (
              <span
                className="flex items-center gap-1"
                style={{
                  background: "#3B4953",
                  color: "#EBF4DD",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 500,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <Zap size={11} fill="#EBF4DD" strokeWidth={0} />
                {score}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-2" style={{ fontSize: 14, color: "#547863", marginBottom: 20 }}>
            <TriggerIcon size={14} style={{ flexShrink: 0 }} />
            <span>{triggerLabel}</span>
          </div>

          {/* Shared by */}
          <div className="flex items-center gap-2" style={{ fontSize: 13, color: "#90AB8B" }}>
            {sharedBy.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sharedBy.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                style={{ width: 22, height: 22, borderRadius: 999, border: "1px solid #EBF4DD" }}
              />
            ) : (
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: "#547863",
                  color: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {sharedBy.name?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
            <span>Shared by {sharedBy.name}</span>
            {remixCount > 0 && (
              <>
                <span style={{ color: "#EBF4DD" }}>·</span>
                <span>Remixed by {remixCount} {remixCount === 1 ? "person" : "people"}</span>
              </>
            )}
          </div>
        </div>

        {/* Readiness bar (hidden if classifications redacted) */}
        {!redactions.classifications && (
          <div style={{ marginBottom: 36 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: "#90AB8B",
                letterSpacing: 1.4,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Readiness
            </div>
            <div
              style={{
                height: 5,
                background: "#EBF4DD",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${score}%`,
                  background: "linear-gradient(90deg, #C99461 0%, #547863 100%)",
                }}
              />
            </div>
            {workflow.automationRationale && (
              <div
                style={{
                  ...dmSerif,
                  fontSize: 13,
                  color: "#90AB8B",
                  marginTop: 8,
                  lineHeight: 1.5,
                }}
              >
                {workflow.automationRationale}
              </div>
            )}
          </div>
        )}

        {/* Steps */}
        <section style={{ marginBottom: 36 }}>
          <h2
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#547863",
              letterSpacing: 1.4,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Steps
          </h2>
          <ol className="flex flex-col gap-2" style={{ listStyle: "none", padding: 0 }}>
            {visibleSteps.map((s) => (
              <PublicStepRow
                key={s.n}
                step={s}
                hidden={redactions.hiddenStepNumbers.includes(s.n)}
                showClassification={!redactions.classifications}
              />
            ))}
          </ol>
        </section>

        {/* Purpose */}
        {workflow.why && !redactions.purpose && (
          <section style={{ marginBottom: 36 }}>
            <h2
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#547863",
                letterSpacing: 1.4,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Purpose
            </h2>
            <p style={{ fontSize: 14, color: "#3B4953", lineHeight: 1.6 }}>
              {workflow.why}
            </p>
          </section>
        )}

        {/* Inputs */}
        {visibleInputs.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#547863",
                letterSpacing: 1.4,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Inputs
            </h2>
            <div className="flex flex-wrap gap-2">
              {visibleInputs.map((inp, i) => (
                <span
                  key={i}
                  style={{
                    background: "#EBF4DD",
                    color: "#3B4953",
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                  }}
                >
                  {inp.name}
                  {inp.source && (
                    <span style={{ color: "#90AB8B", marginLeft: 6 }}>· {inp.source}</span>
                  )}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Outputs */}
        {visibleOutputs.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#547863",
                letterSpacing: 1.4,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Outputs
            </h2>
            <div className="flex flex-wrap gap-2">
              {visibleOutputs.map((out, i) => (
                <span
                  key={i}
                  style={{
                    background: "#EBF4DD",
                    color: "#3B4953",
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                  }}
                >
                  {out.name}
                  {out.source && (
                    <span style={{ color: "#90AB8B", marginLeft: 6 }}>· {out.source}</span>
                  )}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Tools */}
        {!redactions.tools && workflow.tools.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#547863",
                letterSpacing: 1.4,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Tools
            </h2>
            <div className="flex flex-wrap gap-2">
              {workflow.tools.map((t, i) => (
                <span
                  key={i}
                  style={{
                    background: "#3B4953",
                    color: "#FFFFFF",
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Sticky footer */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          borderTop: "1px solid #EBF4DD",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          zIndex: 30,
          boxShadow: "0 -8px 24px rgba(59, 73, 83, 0.06)",
        }}
      >
        <div
          className="hidden sm:block"
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            color: "#90AB8B",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {workflow.name}
        </div>
        <div className="flex items-center gap-2 sm:flex-none flex-1 justify-end">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 hover:bg-[#EBF4DD] transition-colors"
            style={{
              background: "transparent",
              color: "#547863",
              padding: "10px 16px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              border: "1px solid #547863",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <Download size={13} />
            Export .md
          </button>
          <button
            onClick={handleRemix}
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
            style={{
              background: "#3B4953",
              color: "#EBF4DD",
              padding: "10px 16px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Remix this workflow
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {remixed && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#547863",
            color: "#EBF4DD",
            padding: "10px 18px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 8px 32px rgba(59, 73, 83, 0.20)",
            zIndex: 50,
          }}
          role="status"
        >
          Workflow added to your canvas
        </div>
      )}
    </main>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function SharePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [settings, setSettings] = useState<ShareSettings | null | "missing">(null);

  useEffect(() => {
    if (!token) return;
    const found = getShare(token);
    setSettings(found ?? "missing");
    if (found) {
      // Bump document.title for browser tabs / share previews on social.
      document.title = `${found.workflow.name} — Magicus`;
    } else {
      document.title = "Workflow not found — Magicus";
    }
  }, [token]);

  if (settings === null) {
    // Hydrating — render nothing for a beat to avoid flicker.
    return null;
  }

  if (settings === "missing") {
    return (
      <div style={{ ...dmSans, background: "#F7FAF2", minHeight: "100vh" }}>
        <PublicHeader />
        <div
          style={{
            maxWidth: 480,
            margin: "0 auto",
            padding: "120px 24px 64px",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              ...dmSerif,
              fontSize: 28,
              color: "#3B4953",
              lineHeight: 1.2,
              letterSpacing: -0.4,
              marginBottom: 14,
            }}
          >
            This workflow isn&apos;t available
          </h1>
          <p style={{ fontSize: 14, color: "#547863", lineHeight: 1.55, marginBottom: 28 }}>
            The share link may have expired, been revoked, or never existed on
            this device. Magicus stores share data locally for now, so links
            are bound to the browser they were created in.
          </p>
          <Link
            href="/"
            className="hover:opacity-90 transition-opacity inline-flex items-center gap-2"
            style={{
              background: "#3B4953",
              color: "#EBF4DD",
              padding: "12px 22px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Go to Magicus
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#F7FAF2", minHeight: "100vh" }}>
      <PublicHeader />
      <ShareBody settings={settings} />
    </div>
  );
}
