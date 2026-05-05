"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  Clock,
  Zap,
  Hand,
  Link2,
  AlertTriangle,
  Lock,
} from "lucide-react";
import {
  type Workflow,
  type Step,
  THEME_META,
  POTENTIAL_META,
  SENSITIVE_META,
  calculateAutomationScore,
} from "@/lib/workflows";
import { ButterflyCard } from "@/app/components/butterfly-card";
import { type ShareSettings } from "@/lib/shares";
import { storage } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { workflowToMarkdown } from "@/lib/markdown";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };
const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

// Set or update a `<meta>` tag in <head>. We use this to swap in the
// actual workflow title/description after reading from storage.
// Crawlers see the static stub from layout.tsx; humans pasting the URL
// into a fresh tab still get a sensible title in their tab strip.
function upsertMeta(attr: "name" | "property", key: string, value: string) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

// Build content-aware title + description from the actual workflow and
// inject them into <head>. Falls back to a templated summary when
// `automationRationale` is empty so meta is never blank.
function applySharePageMeta(found: ShareSettings) {
  const w = found.workflow;
  const title = `${w.name} — Magicus`;
  const fallbackDesc = `A ${w.theme} workflow by ${found.sharedBy.name} — ${w.automationScore}% automatable. Built on Magicus.`;
  const description = (w.automationRationale || "").trim() || fallbackDesc;

  document.title = title;
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
}

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

// ─── Readiness legend (3 potential tiers + sensitive) ─────────────────────
function ReadinessLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1"
      style={{ fontSize: 11, color: "#90AB8B" }}
    >
      {(["high", "medium", "low"] as const).map((p) => {
        const m = POTENTIAL_META[p];
        return (
          <span key={p} className="flex items-center gap-1.5">
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: m.dot,
                display: "inline-block",
              }}
            />
            {m.label}
            <span style={{ marginLeft: 6, color: "#EBF4DD" }}>·</span>
          </span>
        );
      })}
      <span className="flex items-center gap-1.5" style={{ color: SENSITIVE_META.fg }}>
        <Lock size={10} />
        {SENSITIVE_META.label}
      </span>
    </div>
  );
}

// ─── Scribe-style step card ───────────────────────────────────────────────
// Full-width card with the screenshot as a hero image. Number, text, and
// metadata stack underneath.
function PublicStepRow({
  step,
  hidden,
  showPotential,
}: {
  step: Step;
  hidden: boolean;
  showPotential: boolean;
}) {
  if (hidden) {
    return (
      <li
        style={{
          background: "#F1EFE8",
          borderRadius: 12,
          padding: "14px 16px",
          color: "#90AB8B",
          fontStyle: "italic",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 12,
          filter: "blur(0.4px)",
        }}
      >
        <span
          style={{
            background: "#90AB8B",
            color: "#FFFFFF",
            fontSize: 11,
            fontWeight: 600,
            width: 24,
            height: 24,
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

  const meta = step.automationPotential ? POTENTIAL_META[step.automationPotential] : null;

  return (
    <li
      style={{
        background: "#FFFFFF",
        borderRadius: 12,
        border: "1px solid #EBF4DD",
        overflow: "hidden",
      }}
    >
      {step.screenshot && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={step.screenshot}
          alt={`Step ${step.n} screenshot`}
          style={{
            width: "100%",
            display: "block",
            background: "#F1EFE8",
            borderBottom: "1px solid #EBF4DD",
          }}
        />
      )}
      <div style={{ padding: "16px 18px" }}>
        <div className="flex items-start gap-3">
          <span
            style={{
              background: "#3B4953",
              color: "#EBF4DD",
              fontSize: 12,
              fontWeight: 600,
              width: 26,
              height: 26,
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
            <div
              style={{
                fontSize: 15,
                color: "#3B4953",
                fontWeight: 500,
                lineHeight: 1.4,
              }}
            >
              {step.text}
            </div>
            {step.note && (
              <div
                style={{
                  ...dmSerif,
                  fontSize: 12,
                  color: "#90AB8B",
                  marginTop: 6,
                  fontStyle: "italic",
                  lineHeight: 1.5,
                }}
              >
                {step.note}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 10 }}>
              {step.owner && (
                <span
                  style={{
                    fontSize: 11,
                    color: "#547863",
                    background: "#EBF4DD",
                    padding: "2px 9px",
                    borderRadius: 999,
                  }}
                >
                  {step.owner}
                </span>
              )}
              {step.isSensitive && (
                <span
                  className="flex items-center gap-1"
                  title={SENSITIVE_META.description}
                  style={{
                    fontSize: 10,
                    color: SENSITIVE_META.fg,
                    background: "#FBE8E8",
                    border: `1px solid ${SENSITIVE_META.fg}33`,
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontWeight: 500,
                  }}
                >
                  <Lock size={10} />
                  {SENSITIVE_META.label}
                </span>
              )}
              {showPotential && meta && (
                <span
                  style={{
                    background: meta.bg,
                    color: meta.fg,
                    border: `1px solid ${meta.fg}4D`,
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {meta.label}
                </span>
              )}
            </div>
          </div>
        </div>
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

  const visibleInputs = workflow.inputs.filter(
    (_, i) => !redactions.hiddenInputIndices.includes(i)
  );
  const visibleOutputs = workflow.outputs.filter(
    (_, i) => !redactions.hiddenOutputIndices.includes(i)
  );

  // The hero butterfly card mirrors what the recipient would see on the
  // canvas: it must respect redactions, so we hide redacted steps/IO from
  // the hero rendering rather than blanking them in place (since the card is
  // a glanceable summary, not a stepwise transcript).
  const heroData = useMemo(
    () => ({
      name: workflow.name,
      inputs: visibleInputs,
      outputs: visibleOutputs,
      tools: redactions.tools ? [] : workflow.tools,
      steps: workflow.steps.filter(
        (s) => !redactions.hiddenStepNumbers.includes(s.n)
      ),
      automationScore: redactions.classifications ? 0 : score,
    }),
    [
      workflow,
      visibleInputs,
      visibleOutputs,
      redactions.tools,
      redactions.hiddenStepNumbers,
      redactions.classifications,
      score,
    ]
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
          // Strip automation potential and sensitive flag if redacted in the
          // share so the remixer starts fresh on a hidden classification.
          automationPotential: redactions.classifications ? undefined : s.automationPotential,
          isSensitive: redactions.classifications ? undefined : s.isSensitive,
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

    try {
      localStorage.setItem("magicus:pending-remix", JSON.stringify(cloned));
    } catch { /* localStorage refused — proceed anyway */ }

    void storage.incrementRemixCount(settings.token);
    setRemixed(true);
    setTimeout(() => router.push("/"), 600);
  };

  const handleExport = () => {
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

  const visibleStepCount = workflow.steps.filter(
    (s) => !redactions.hiddenStepNumbers.includes(s.n)
  ).length;

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
          maxWidth: 880,
          margin: "0 auto",
          padding: "40px 24px 64px",
        }}
      >
        {/* Contributor byline — establishes provenance up top */}
        <div
          className="flex items-center gap-2"
          style={{ fontSize: 13, color: "#90AB8B", marginBottom: 24 }}
        >
          {sharedBy.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sharedBy.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              style={{ width: 26, height: 26, borderRadius: 999, border: "1px solid #EBF4DD" }}
            />
          ) : (
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                background: "#547863",
                color: "#FFFFFF",
                fontSize: 12,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {sharedBy.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          )}
          <span>
            <strong style={{ color: "#3B4953", fontWeight: 600 }}>{sharedBy.name}</strong>
            {" "}shared this workflow
          </span>
          {remixCount > 0 && (
            <>
              <span style={{ color: "#EBF4DD" }}>·</span>
              <span>
                Remixed by {remixCount} {remixCount === 1 ? "person" : "people"}
              </span>
            </>
          )}
        </div>

        {/* Workflow header */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              ...dmSerif,
              fontSize: 38,
              color: "#3B4953",
              lineHeight: 1.1,
              letterSpacing: -0.6,
              marginBottom: 14,
            }}
          >
            {workflow.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 6 }}>
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
            <span
              className="flex items-center gap-1.5"
              style={{
                fontSize: 13,
                color: "#547863",
              }}
            >
              <TriggerIcon size={13} style={{ flexShrink: 0 }} />
              <span>{triggerLabel}</span>
            </span>
          </div>
        </div>

        {/* Hero butterfly card — full width within the page max-width */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 36,
          }}
        >
          <ButterflyCard data={heroData} />
        </div>

        {/* Readiness section */}
        {!redactions.classifications && (
          <section
            style={{
              background: "#FFFFFF",
              border: "1px solid #EBF4DD",
              borderRadius: 14,
              padding: "20px 22px",
              marginBottom: 36,
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <h2
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#547863",
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                }}
              >
                Readiness
              </h2>
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
            </div>
            <div
              style={{
                height: 6,
                background: "#EBF4DD",
                borderRadius: 999,
                overflow: "hidden",
                marginBottom: 14,
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
            <ReadinessLegend />
            {workflow.automationRationale && (
              <p
                style={{
                  ...dmSerif,
                  fontSize: 13,
                  color: "#90AB8B",
                  marginTop: 14,
                  lineHeight: 1.6,
                }}
              >
                {workflow.automationRationale}
              </p>
            )}
          </section>
        )}

        {/* Steps — Scribe-style */}
        <section style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#547863",
              letterSpacing: 1.4,
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Steps · {visibleStepCount}
          </h2>
          <ol className="flex flex-col gap-3" style={{ listStyle: "none", padding: 0 }}>
            {workflow.steps.map((s) => (
              <PublicStepRow
                key={s.n}
                step={s}
                hidden={redactions.hiddenStepNumbers.includes(s.n)}
                showPotential={!redactions.classifications}
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
            <p style={{ fontSize: 15, color: "#3B4953", lineHeight: 1.6 }}>
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
    let cancelled = false;
    void storage.loadShare(token).then((found) => {
      if (cancelled) return;
      setSettings(found ?? "missing");
      if (found) {
        applySharePageMeta(found);
      } else {
        document.title = "Workflow not found — Magicus";
      }
    });
    return () => { cancelled = true; };
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
