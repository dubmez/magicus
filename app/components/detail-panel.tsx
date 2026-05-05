"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSharesByWorkflowId } from "@/lib/shares";
import {
  X,
  Download,
  Zap,
  Link2,
  Trash2,
  Plus,
  Check,
  Clock,
  Hand,
  AlertTriangle,
  Pencil,
  Share2,
  MoreHorizontal,
} from "lucide-react";
import type { Workflow, Theme, Trigger, Step, StepClassification } from "@/lib/workflows";
import {
  THEME_META,
  CLASSIFICATION_META,
  calculateAutomationScore,
} from "@/lib/workflows";
import { useAuth } from "@/lib/auth-context";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };

const CLASSIFICATION_ORDER: StepClassification[] = [
  "automate",
  "human_review",
  "security_risk",
  "needs_standardisation",
];

// ─── Lightweight inline inputs (kept from previous panel) ──────────────────

function InlineInput({
  value,
  onChange,
  placeholder,
  readOnly = false,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        background: "transparent",
        border: "none",
        borderBottom: `1px solid ${focused && !readOnly ? "#547863" : "#EBF4DD"}`,
        outline: "none",
        fontFamily: "inherit",
        color: "inherit",
        fontSize: "inherit",
        lineHeight: "inherit",
        width: "100%",
        padding: "2px 0",
        cursor: readOnly ? "default" : "text",
        ...style,
      }}
    />
  );
}

function InlineNameInput({
  value,
  onChange,
  placeholder,
  readOnly = false,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => { resize(); }, [value, resize]);

  // Layout settles asynchronously when the parent panel slides open or
  // resizes — without observing width, scrollHeight is computed against an
  // intermediate width and the textarea stays artificially tall. ResizeObserver
  // catches every layout change and re-runs resize.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [resize]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => { onChange(e.target.value); resize(); }}
      placeholder={placeholder}
      readOnly={readOnly}
      rows={1}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        background: "transparent",
        border: "none",
        borderBottom: `1px solid ${focused && !readOnly ? "#547863" : "transparent"}`,
        outline: "none",
        fontFamily: "inherit",
        color: "inherit",
        width: "100%",
        padding: "2px 0",
        resize: "none",
        overflow: "hidden",
        cursor: readOnly ? "default" : "text",
        ...style,
      }}
    />
  );
}

function InlineTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  readOnly = false,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
  style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  const showFocus = focused && !readOnly;
  const showAffordance = !readOnly && !focused && value.length === 0;
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      rows={rows}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        background: showFocus ? "#F7FAF2" : "transparent",
        border: showFocus
          ? "1px solid #547863"
          : showAffordance
          ? "1px dashed #90AB8B"
          : "1px solid transparent",
        borderRadius: 8,
        outline: "none",
        fontFamily: "inherit",
        color: "#3B4953",
        fontSize: 13,
        width: "100%",
        padding: showFocus || showAffordance ? "8px 10px" : "0",
        resize: "none",
        lineHeight: 1.55,
        transition: "background 0.12s, border 0.12s, padding 0.12s",
        cursor: readOnly ? "default" : "text",
        ...style,
      }}
    />
  );
}

function AddToolInput({ onAdd }: { onAdd: (tool: string) => void }) {
  const [val, setVal] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const commit = () => {
    const t = val.trim();
    if (t) { onAdd(t); setVal(""); }
  };
  return (
    <div
      className="flex items-center gap-1"
      style={{
        background: "#F7FAF2",
        border: "1px dashed #90AB8B",
        borderRadius: 999,
        padding: "2px 8px",
        minWidth: 80,
      }}
    >
      <input
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
        placeholder="Add tool…"
        style={{
          background: "transparent",
          border: "none",
          outline: "none",
          fontSize: 11,
          color: "#547863",
          width: val.length > 0 ? `${val.length + 2}ch` : "7ch",
          fontFamily: "inherit",
        }}
      />
      {val.trim().length > 0 && (
        <button onClick={commit} style={{ color: "#547863", display: "flex" }}>
          <Check size={10} />
        </button>
      )}
    </div>
  );
}

// ─── Section heading helper ───────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "#547863",
          letterSpacing: 1.4,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Score badge (animated count) ──────────────────────────────────────────
function useAnimatedNumber(target: number, durationMs = 600): number {
  const [display, setDisplay] = useState(target);
  const startRef = useRef(target);
  useEffect(() => {
    if (display === target) return;
    const start = startRef.current;
    const startTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(start + (target - start) * eased);
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // We deliberately depend only on `target` — startRef is updated below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  // Track the current value as the next animation's start point.
  useEffect(() => { startRef.current = display; }, [display]);
  return display;
}

function ScoreBadge({ score }: { score: number }) {
  const display = useAnimatedNumber(score);
  return (
    <div
      className="flex items-center gap-1"
      style={{
        background: "#3B4953",
        color: "#EBF4DD",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: 0.2,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <Zap size={11} fill="#EBF4DD" strokeWidth={0} />
      {display}%
    </div>
  );
}

function ThemeBadge({ theme }: { theme: Theme }) {
  // Compact form: dot only, theme name available on hover. Saves horizontal
  // space in the header so the score badge doesn't squeeze the title.
  const meta = THEME_META[theme];
  return (
    <span
      title={meta.label}
      aria-label={`Theme: ${meta.label}`}
      style={{
        width: 12,
        height: 12,
        borderRadius: 999,
        background: meta.dot,
        flexShrink: 0,
        border: "2px solid #FFFFFF",
        boxShadow: `0 0 0 1px ${meta.dot}33`,
      }}
    />
  );
}

function ReadinessBar({ score, rationale }: { score: number; rationale?: string }) {
  return (
    <div>
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
            // Amber on the left (low scores show only amber); green on the
            // right (high scores reveal more sage). Reads as 'good = green'.
            background: "linear-gradient(90deg, #C99461 0%, #547863 100%)",
            transition: "width 600ms ease",
          }}
        />
      </div>
      {rationale && (
        <div
          style={{
            ...dmSerif,
            fontSize: 12,
            color: "#90AB8B",
            marginTop: 8,
            lineHeight: 1.4,
          }}
        >
          {rationale}
        </div>
      )}
    </div>
  );
}

// ─── Trigger display + (click-to-edit) picker ──────────────────────────────
function TriggerDisplay({
  trigger,
  incomingNames,
  readOnly,
  onChange,
}: {
  trigger: Trigger | null;
  incomingNames: string[];
  readOnly: boolean;
  onChange: (t: Trigger | null) => void;
}) {
  const [editing, setEditing] = useState(false);

  const Icon =
    trigger?.type === "schedule"
      ? Clock
      : trigger?.type === "event"
      ? Zap
      : trigger?.type === "manual"
      ? Hand
      : trigger?.type === "chained"
      ? Link2
      : AlertTriangle;

  const label =
    trigger?.type === "schedule"
      ? trigger.description || "On a schedule"
      : trigger?.type === "event"
      ? trigger.description || "On an event"
      : trigger?.type === "manual"
      ? trigger.description || "Triggered manually"
      : trigger?.type === "chained"
      ? incomingNames.length > 0
        ? `Triggered by ${incomingNames.join(", ")}`
        : "Triggered by an upstream workflow"
      : "Trigger not set";

  const isMissing = !trigger;

  if (editing && !readOnly && trigger?.type !== "chained") {
    return (
      <TriggerEditor
        trigger={trigger}
        onChange={(t) => { onChange(t); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <button
      onClick={() => { if (!readOnly && trigger?.type !== "chained") setEditing(true); }}
      disabled={readOnly || trigger?.type === "chained"}
      className="flex items-center gap-2 transition-colors"
      style={{
        background: isMissing ? "#FEF3E2" : "transparent",
        border: isMissing ? "1px solid #F5C28C" : "1px solid transparent",
        padding: "4px 10px",
        borderRadius: 8,
        fontSize: 13,
        color: isMissing ? "#8A4B0F" : "#547863",
        cursor: readOnly || trigger?.type === "chained" ? "default" : "pointer",
        textAlign: "left",
        width: "fit-content",
        maxWidth: "100%",
      }}
    >
      <Icon size={13} style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
    </button>
  );
}

function TriggerEditor({
  trigger,
  onChange,
  onCancel,
}: {
  trigger: Trigger | null;
  onChange: (t: Trigger | null) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<Trigger["type"]>(trigger?.type ?? "manual");
  const [desc, setDesc] = useState(trigger?.description ?? "");
  const types: { type: Trigger["type"]; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
    { type: "schedule", icon: Clock, label: "Schedule" },
    { type: "event", icon: Zap, label: "Event" },
    { type: "manual", icon: Hand, label: "Manual" },
  ];
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #547863",
        borderRadius: 10,
        padding: 10,
      }}
    >
      <div className="flex gap-1.5" style={{ marginBottom: 8 }}>
        {types.map(({ type: t, icon: I, label }) => {
          const active = type === t;
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                flex: 1,
                padding: "6px 4px",
                borderRadius: 6,
                background: active ? "#3B4953" : "#F7FAF2",
                color: active ? "#EBF4DD" : "#547863",
                border: `1px solid ${active ? "#3B4953" : "#90AB8B"}`,
                fontSize: 11,
                fontWeight: 500,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                cursor: "pointer",
              }}
            >
              <I size={13} />
              {label}
            </button>
          );
        })}
      </div>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder={
          type === "schedule" ? "e.g. Every Monday at 9am" :
          type === "event" ? "e.g. New row in Airtable" :
          "e.g. Run on demand from Slack"
        }
        rows={2}
        style={{
          width: "100%",
          fontSize: 12,
          color: "#3B4953",
          padding: "6px 8px",
          background: "#F7FAF2",
          border: "1px solid #EBF4DD",
          borderRadius: 6,
          outline: "none",
          resize: "none",
          fontFamily: "inherit",
          lineHeight: 1.4,
        }}
      />
      <div className="flex justify-end gap-2" style={{ marginTop: 8 }}>
        <button
          onClick={onCancel}
          style={{
            background: "transparent",
            border: "none",
            fontSize: 12,
            color: "#90AB8B",
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onChange({ type, description: desc.trim() || undefined })}
          style={{
            background: "#3B4953",
            color: "#EBF4DD",
            border: "none",
            borderRadius: 999,
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Classification tag + popover ──────────────────────────────────────────
function ClassificationTag({
  classification,
  overridden,
  readOnly,
  onPick,
}: {
  classification?: StepClassification;
  overridden?: boolean;
  readOnly: boolean;
  onPick: (next: StepClassification) => void;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const wrapRef = useRef<HTMLDivElement>(null);

  // Choose above/below based on which side has more space.
  useEffect(() => {
    if (!open) return;
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setPlacement(spaceBelow < 220 && rect.top > 220 ? "above" : "below");
  }, [open]);

  // Click-outside closes the popover without changes.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const meta = classification ? CLASSIFICATION_META[classification] : null;

  return (
    <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => { if (!readOnly) setOpen((v) => !v); }}
        disabled={readOnly}
        className="flex items-center gap-1 transition-colors"
        style={{
          background: meta ? meta.bg : "#F7FAF2",
          color: meta ? meta.fg : "#90AB8B",
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: 0.2,
          cursor: readOnly ? "default" : "pointer",
          // Solid border when LLM-generated, dashed when user-overridden.
          // Border colour matches text colour at ~30% opacity for a subtle look.
          border: meta
            ? overridden
              ? `1.5px dashed ${meta.fg}`
              : `1px solid ${meta.fg}4D`
            : "1px dashed #90AB8B",
          whiteSpace: "nowrap",
        }}
      >
        {overridden && <Pencil size={8} />}
        {meta?.label ?? "Classify…"}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            [placement === "below" ? "top" : "bottom"]: "calc(100% + 6px)",
            background: "#FFFFFF",
            border: "1px solid #EBF4DD",
            borderRadius: 10,
            padding: 6,
            boxShadow: "0 12px 32px rgba(59, 73, 83, 0.16)",
            zIndex: 60,
            width: 280,
          }}
        >
          {CLASSIFICATION_ORDER.map((c) => {
            const m = CLASSIFICATION_META[c];
            const selected = classification === c;
            return (
              <button
                key={c}
                onClick={(e) => {
                  e.stopPropagation();
                  onPick(c);
                  setOpen(false);
                }}
                className="w-full flex items-start gap-2 transition-colors"
                style={{
                  background: selected ? "#EBF4DD" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 10px",
                  textAlign: "left",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!selected) (e.currentTarget as HTMLElement).style.background = "#F7FAF2";
                }}
                onMouseLeave={(e) => {
                  if (!selected) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: m.dot,
                    flexShrink: 0,
                    marginTop: 4,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#3B4953", fontWeight: 500 }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 11, color: "#90AB8B", lineHeight: 1.4, marginTop: 1 }}>
                    {m.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Step row ──────────────────────────────────────────────────────────────
function StepRow({
  step,
  index,
  readOnly,
  onUpdate,
  onRemove,
}: {
  step: Step;
  index: number;
  readOnly: boolean;
  onUpdate: (changes: Partial<Step>) => void;
  onRemove: () => void;
}) {
  return (
    <li
      className="group"
      style={{
        background: "#F7FAF2",
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          style={{
            background: "#3B4953",
            color: "#EBF4DD",
            fontSize: 10,
            fontWeight: 600,
            width: 20,
            height: 20,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          {step.n}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <InlineInput
            value={step.text}
            onChange={(v) => onUpdate({ text: v })}
            placeholder="Step description"
            readOnly={readOnly}
            style={{ fontSize: 13, color: "#3B4953", fontWeight: 500 }}
          />
          <InlineInput
            value={step.note ?? ""}
            onChange={(v) => onUpdate({ note: v || undefined })}
            placeholder="Add a note…"
            readOnly={readOnly}
            style={{
              ...dmSerif,
              fontSize: 11,
              color: "#90AB8B",
              marginTop: 4,
              fontStyle: "italic",
            }}
          />
          {step.owner && (
            <div
              style={{
                display: "inline-block",
                marginTop: 6,
                fontSize: 11,
                color: "#547863",
                background: "#EBF4DD",
                padding: "2px 8px",
                borderRadius: 999,
              }}
            >
              {step.owner}
            </div>
          )}
        </div>

        <div className="flex items-start gap-2" style={{ marginTop: 2 }}>
          <ClassificationTag
            classification={step.classification}
            overridden={step.classificationOverridden}
            readOnly={readOnly}
            onPick={(c) =>
              onUpdate({ classification: c, classificationOverridden: true })
            }
          />
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
          {!readOnly && (
            <button
              onClick={onRemove}
              className="opacity-0 group-hover:opacity-100 hover:bg-[#EBF4DD] rounded p-0.5"
              style={{ color: "#90AB8B", flexShrink: 0, marginTop: 2 }}
              aria-label="Remove step"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      {/* Suppress unused index warning while keeping the prop available */}
      <span style={{ display: "none" }}>{index}</span>
    </li>
  );
}

// ─── Legend ────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1"
      style={{ marginTop: 16, fontSize: 11, color: "#90AB8B" }}
    >
      {CLASSIFICATION_ORDER.map((c, i) => {
        const m = CLASSIFICATION_META[c];
        return (
          <span key={c} className="flex items-center gap-1.5">
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
            {i < CLASSIFICATION_ORDER.length - 1 && (
              <span style={{ marginLeft: 6, color: "#EBF4DD" }}>·</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────
// Three-tier action set: primary (Automate it), secondary (Share), and an
// overflow menu for tertiary actions (Chain, Export, Delete). Keeps the
// footer scannable without losing capability.
function DetailFooter({
  workflow,
  effectiveReadOnly,
  onAutomate,
  onShare,
  onChain,
  onExport,
  onDelete,
}: {
  workflow: Workflow;
  effectiveReadOnly: boolean;
  onAutomate?: (id: string) => void;
  onShare?: (id: string) => void;
  onChain: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overflowOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [overflowOpen]);

  return (
    <div
      style={{
        borderTop: "1px solid #EBF4DD",
        padding: "12px 20px",
        display: "flex",
        gap: 8,
        background: "#FFFFFF",
        flexShrink: 0,
        alignItems: "center",
      }}
    >
      {onAutomate && (
        <button
          onClick={() => onAutomate(workflow.id)}
          className="flex-1 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          style={{
            background: "#3B4953",
            color: "#EBF4DD",
            padding: "10px 14px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Zap size={13} fill="#EBF4DD" strokeWidth={0} />
          Automate it
        </button>
      )}
      {onShare && !effectiveReadOnly && (
        <button
          onClick={() => onShare(workflow.id)}
          className="flex items-center justify-center gap-2 hover:bg-[#EBF4DD] transition-colors"
          style={{
            background: "transparent",
            color: "#547863",
            padding: "10px 14px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
            border: "1px solid #547863",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          title="Share this workflow"
        >
          <Share2 size={13} />
          Share
        </button>
      )}
      <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={() => setOverflowOpen((v) => !v)}
          className="flex items-center justify-center hover:bg-[#EBF4DD] transition-colors"
          style={{
            background: "transparent",
            color: "#547863",
            width: 36,
            height: 36,
            padding: 0,
            borderRadius: 999,
            border: "1px solid #EBF4DD",
            cursor: "pointer",
          }}
          aria-label="More actions"
          title="More actions"
        >
          <MoreHorizontal size={16} />
        </button>
        {overflowOpen && (
          <div
            style={{
              position: "absolute",
              right: 0,
              bottom: "calc(100% + 6px)",
              minWidth: 180,
              background: "#FFFFFF",
              border: "1px solid #EBF4DD",
              borderRadius: 10,
              padding: 4,
              boxShadow: "0 12px 32px rgba(59, 73, 83, 0.16)",
              zIndex: 60,
            }}
          >
            {!effectiveReadOnly && (
              <button
                onClick={() => { setOverflowOpen(false); onChain(workflow.id); }}
                className="w-full flex items-center gap-2 hover:bg-[#F7FAF2] rounded-md transition-colors"
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "8px 10px",
                  fontSize: 13,
                  color: "#3B4953",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <Link2 size={13} style={{ color: "#547863" }} />
                Chain into another
              </button>
            )}
            <button
              onClick={() => { setOverflowOpen(false); onExport(workflow.id); }}
              className="w-full flex items-center gap-2 hover:bg-[#F7FAF2] rounded-md transition-colors"
              style={{
                background: "transparent",
                border: "none",
                padding: "8px 10px",
                fontSize: 13,
                color: "#3B4953",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Download size={13} style={{ color: "#547863" }} />
              Export .md
            </button>
            {!effectiveReadOnly && (
              <>
                <div style={{ height: 1, background: "#EBF4DD", margin: "4px 6px" }} />
                <button
                  onClick={() => {
                    setOverflowOpen(false);
                    if (window.confirm(`Delete "${workflow.name}"? This can't be undone.`)) {
                      onDelete(workflow.id);
                    }
                  }}
                  className="w-full flex items-center gap-2 hover:bg-[#FDECEC] rounded-md transition-colors"
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: "8px 10px",
                    fontSize: 13,
                    color: "#8B2A2A",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Trash2 size={13} />
                  Delete workflow
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DetailPanel ───────────────────────────────────────────────────────────
export function DetailPanel({
  workflow,
  incomingWorkflows = [],
  readOnly = false,
  onClose,
  onExport,
  onChain,
  onDelete,
  onUpdate,
  onAutomate,
  onShare,
}: {
  workflow: Workflow | null;
  incomingWorkflows?: Workflow[];
  readOnly?: boolean;
  onClose: () => void;
  onExport: (id: string) => void;
  onChain: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, changes: Partial<Workflow>) => void;
  onAutomate?: (id: string) => void;
  onShare?: (id: string) => void;
}) {
  const { user, openGate } = useAuth();
  const unauthReadOnly = !user && !readOnly;
  const effectiveReadOnly = readOnly || unauthReadOnly;

  const update = useCallback(
    (changes: Partial<Workflow>) => {
      if (effectiveReadOnly || !workflow) return;
      onUpdate(workflow.id, changes);
    },
    [workflow, onUpdate, effectiveReadOnly]
  );

  const updateStep = useCallback(
    (i: number, changes: Partial<Step>) => {
      if (!workflow) return;
      const steps = [...workflow.steps];
      steps[i] = { ...steps[i], ...changes };
      update({ steps });
    },
    [workflow, update]
  );

  const removeStep = useCallback(
    (i: number) => {
      if (!workflow) return;
      const steps = workflow.steps
        .filter((_, j) => j !== i)
        .map((s, j) => ({ ...s, n: j + 1 }));
      update({ steps });
    },
    [workflow, update]
  );

  // Score is derived from the steps' classifications. Whenever steps change,
  // the score recomputes; the badge animates to the new value.
  const derivedScore = useMemo(
    () => (workflow ? calculateAutomationScore(workflow.steps) : 0),
    [workflow]
  );

  // Remix count — shown on the *original* sharer's view of their workflow.
  // Best-effort: looks up share entries with this workflow id in this
  // browser's localStorage. Cross-device counts will require a backend.
  const remixCount = useMemo(() => {
    if (!workflow) return 0;
    const shares = getSharesByWorkflowId(workflow.id);
    return shares.reduce((sum, s) => sum + s.remixCount, 0);
  }, [workflow]);

  const open = !!workflow;
  return (
    <div
      // Full-width on mobile so a workflow's details aren't clipped at narrow
      // viewports; fixed 440px on md+ as the side panel users know.
      className={open ? "w-full md:w-[440px]" : "w-0"}
      style={{
        flexShrink: 0,
        height: "100%",
        background: "#FFFFFF",
        borderLeft: open ? "1px solid #EBF4DD" : "none",
        overflow: "hidden",
        transition: "width 220ms ease",
        fontFamily: "var(--font-dm-sans), sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {workflow && (
        <>
          {/* HEADER */}
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid #EBF4DD",
              background: "#F7FAF2",
              flexShrink: 0,
            }}
          >
            {/* Top row: name | theme + score | close */}
            <div className="flex items-start gap-3" style={{ marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <InlineNameInput
                  value={workflow.name}
                  onChange={(v) => update({ name: v })}
                  placeholder="Workflow name"
                  readOnly={effectiveReadOnly}
                  style={{ ...dmSerif, fontSize: 18, color: "#3B4953", lineHeight: 1.3 }}
                />
              </div>
              <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                <ThemeBadge theme={workflow.theme} />
                <ScoreBadge score={derivedScore} />
                <button
                  onClick={onClose}
                  className="hover:bg-[#EBF4DD] rounded-md p-1.5"
                  style={{ color: "#547863" }}
                  aria-label="Close"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Read-only banners surface BEFORE the trigger/readiness so the
                user knows the context before reading the metrics. */}
            {readOnly && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "6px 10px",
                  fontSize: 11,
                  color: "#90AB8B",
                  background: "#FFFFFF",
                  border: "1px solid #EBF4DD",
                  borderRadius: 8,
                  fontStyle: "italic",
                }}
              >
                Read-only — workflows on the Examples canvas can&apos;t be edited.
              </div>
            )}
            {unauthReadOnly && (
              <div
                className="flex items-center justify-between gap-3"
                style={{
                  marginBottom: 12,
                  padding: "8px 10px",
                  fontSize: 12,
                  color: "#3B4953",
                  background: "#FFFFFF",
                  border: "1px solid #EBF4DD",
                  borderRadius: 8,
                }}
              >
                <span>Sign in to edit your workflows.</span>
                <button
                  onClick={() => openGate()}
                  className="hover:opacity-90 transition-opacity"
                  style={{
                    background: "#3B4953",
                    color: "#EBF4DD",
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 500,
                    flexShrink: 0,
                  }}
                >
                  Sign in
                </button>
              </div>
            )}

            {/* Trigger row */}
            <div style={{ marginBottom: 14 }}>
              <TriggerDisplay
                trigger={workflow.trigger}
                incomingNames={incomingWorkflows.map((w) => w.name)}
                readOnly={effectiveReadOnly}
                onChange={(t) => update({ trigger: t })}
              />
            </div>

            {/* Readiness bar + rationale */}
            <ReadinessBar score={derivedScore} rationale={workflow.automationRationale} />

            {/* Provenance footer — Remixed-from / Remixed-by, both subtle */}
            {(workflow.remixedFrom || remixCount > 0) && (
              <div
                className="flex flex-wrap items-center gap-x-3 gap-y-1"
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: "#90AB8B",
                }}
              >
                {workflow.remixedFrom && (
                  <span className="flex items-center gap-1">
                    <Link2 size={11} style={{ flexShrink: 0 }} />
                    Remixed from {workflow.remixedFrom.sharedBy}&apos;s workflow
                  </span>
                )}
                {remixCount > 0 && (
                  <span>Remixed by {remixCount} {remixCount === 1 ? "person" : "people"}</span>
                )}
              </div>
            )}
          </div>

          {/* SCROLLABLE BODY */}
          <fieldset
            disabled={effectiveReadOnly}
            className="flex-1 overflow-y-auto"
            style={{
              padding: "20px 24px",
              border: "none",
              minWidth: 0,
              opacity: effectiveReadOnly ? 0.92 : 1,
            }}
          >
            {/* Steps */}
            <Section label="Steps">
              <ol className="flex flex-col gap-2" style={{ listStyle: "none", padding: 0 }}>
                {workflow.steps.map((s, i) => (
                  <StepRow
                    key={s.n}
                    step={s}
                    index={i}
                    readOnly={effectiveReadOnly}
                    onUpdate={(changes) => updateStep(i, changes)}
                    onRemove={() => removeStep(i)}
                  />
                ))}
              </ol>
              {!effectiveReadOnly && (
                <button
                  onClick={() => {
                    update({
                      steps: [
                        ...workflow.steps,
                        { n: workflow.steps.length + 1, text: "" },
                      ],
                    });
                  }}
                  className="flex items-center gap-1 hover:bg-[#EBF4DD] rounded-md transition-colors"
                  style={{ fontSize: 12, color: "#547863", marginTop: 8, padding: "4px 8px" }}
                >
                  <Plus size={12} />
                  Add step
                </button>
              )}
              <Legend />
            </Section>

            {/* Purpose */}
            <Section label="Purpose">
              <InlineTextarea
                value={workflow.why}
                onChange={(v) => update({ why: v })}
                placeholder="Why does this workflow exist?"
                rows={2}
                readOnly={effectiveReadOnly}
              />
            </Section>

            {/* Inputs */}
            <Section label="Inputs">
              <div className="flex flex-col gap-1.5">
                {workflow.inputs.map((inp, i) => (
                  <div
                    key={i}
                    className="group flex items-center gap-2"
                    style={{
                      background: "#F7FAF2",
                      border: "1px solid #EBF4DD",
                      borderRadius: 8,
                      padding: "6px 10px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <InlineInput
                        value={inp.name}
                        onChange={(v) => {
                          const inputs = [...workflow.inputs];
                          inputs[i] = { ...inputs[i], name: v };
                          update({ inputs });
                        }}
                        placeholder="Input name"
                        readOnly={effectiveReadOnly}
                        style={{ fontSize: 12, color: "#3B4953", fontWeight: 500 }}
                      />
                      <InlineInput
                        value={inp.source}
                        onChange={(v) => {
                          const inputs = [...workflow.inputs];
                          inputs[i] = { ...inputs[i], source: v };
                          update({ inputs });
                        }}
                        placeholder="Source"
                        readOnly={effectiveReadOnly}
                        style={{ fontSize: 11, color: "#90AB8B" }}
                      />
                    </div>
                    {!effectiveReadOnly && (
                      <button
                        onClick={() =>
                          update({ inputs: workflow.inputs.filter((_, j) => j !== i) })
                        }
                        className="opacity-0 group-hover:opacity-100 hover:bg-[#EBF4DD] rounded p-0.5"
                        style={{ color: "#90AB8B", flexShrink: 0 }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {!effectiveReadOnly && (
                  <button
                    onClick={() =>
                      update({ inputs: [...workflow.inputs, { name: "", source: "" }] })
                    }
                    className="flex items-center gap-1 hover:bg-[#EBF4DD] rounded-md transition-colors"
                    style={{ fontSize: 12, color: "#547863", padding: "4px 8px" }}
                  >
                    <Plus size={12} />
                    Add input
                  </button>
                )}
              </div>
            </Section>

            {/* Outputs */}
            <Section label="Outputs">
              <div className="flex flex-col gap-1.5">
                {workflow.outputs.map((out, i) => (
                  <div
                    key={i}
                    className="group flex items-center gap-2"
                    style={{
                      background: "#F7FAF2",
                      border: "1px solid #EBF4DD",
                      borderRadius: 8,
                      padding: "6px 10px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <InlineInput
                        value={out.name}
                        onChange={(v) => {
                          const outputs = [...workflow.outputs];
                          outputs[i] = { ...outputs[i], name: v };
                          update({ outputs });
                        }}
                        placeholder="Output name"
                        readOnly={effectiveReadOnly}
                        style={{ fontSize: 12, color: "#3B4953", fontWeight: 500 }}
                      />
                      <InlineInput
                        value={out.source}
                        onChange={(v) => {
                          const outputs = [...workflow.outputs];
                          outputs[i] = { ...outputs[i], source: v };
                          update({ outputs });
                        }}
                        placeholder="Destination"
                        readOnly={effectiveReadOnly}
                        style={{ fontSize: 11, color: "#90AB8B" }}
                      />
                    </div>
                    {!effectiveReadOnly && (
                      <button
                        onClick={() =>
                          update({ outputs: workflow.outputs.filter((_, j) => j !== i) })
                        }
                        className="opacity-0 group-hover:opacity-100 hover:bg-[#EBF4DD] rounded p-0.5"
                        style={{ color: "#90AB8B", flexShrink: 0 }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {!effectiveReadOnly && (
                  <button
                    onClick={() =>
                      update({ outputs: [...workflow.outputs, { name: "", source: "" }] })
                    }
                    className="flex items-center gap-1 hover:bg-[#EBF4DD] rounded-md transition-colors"
                    style={{ fontSize: 12, color: "#547863", padding: "4px 8px" }}
                  >
                    <Plus size={12} />
                    Add output
                  </button>
                )}
              </div>
            </Section>

            {/* Tools */}
            <Section label="Tools">
              <div className="flex flex-wrap gap-1.5">
                {workflow.tools.map((t, i) => (
                  <span
                    key={i}
                    className="group flex items-center gap-1"
                    style={{
                      background: "#3B4953",
                      color: "#FFFFFF",
                      fontSize: 11,
                      padding: "3px 9px",
                      borderRadius: 999,
                    }}
                  >
                    {t}
                    {!effectiveReadOnly && (
                      <button
                        onClick={() =>
                          update({ tools: workflow.tools.filter((_, j) => j !== i) })
                        }
                        className="opacity-0 group-hover:opacity-60 transition-opacity"
                        style={{ color: "#EBF4DD", display: "flex", marginLeft: 2 }}
                        aria-label={`Remove ${t}`}
                      >
                        <X size={10} />
                      </button>
                    )}
                  </span>
                ))}
                {!effectiveReadOnly && (
                  <AddToolInput onAdd={(tool) => update({ tools: [...workflow.tools, tool] })} />
                )}
              </div>
            </Section>
          </fieldset>

          <DetailFooter
            workflow={workflow}
            effectiveReadOnly={effectiveReadOnly}
            onAutomate={onAutomate}
            onShare={onShare}
            onChain={onChain}
            onExport={onExport}
            onDelete={onDelete}
          />
        </>
      )}
    </div>
  );
}
