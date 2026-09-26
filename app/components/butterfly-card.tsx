"use client";

import { Zap, Link2, AlertCircle, Lock } from "lucide-react";
import type { IOItem, Step } from "@/lib/workflows";
import { calculateAutomationScore, SENSITIVE_META } from "@/lib/workflows";

/** Colours that tell a card's outputs apart when it has more than one way out. */
export const OUTPUT_COLOURS = ["#547863", "#D9492F", "#B7791F", "#3B4953"];

/** The attribute a connector looks for to join an output or input chip. */
export function ioAnchor(side: "in" | "out", name: string): string {
  return `${side}:${name.trim().toLowerCase()}`;
}

/** A mark on one step, e.g. where value sits. Keyed by step number. */
export type StepMark = { label: string; fg: string; bg: string };

export type ButterflyData = {
  name: string;
  inputs: IOItem[];
  steps: Step[];
  outputs: IOItem[];
  tools: string[];
  automationScore?: number;
};

const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };
const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };

function IOCard({ item, align, dot }: { item: IOItem; align: "left" | "right"; dot?: string }) {
  return (
    <div
      className="bg-white rounded-[10px] px-3 py-2"
      data-io={ioAnchor(align === "left" ? "in" : "out", item.name)}
      style={{
        ...dmSans,
        textAlign: align === "left" ? "left" : "right",
        boxShadow: "0px 1px 2px rgba(59, 73, 83, 0.06)",
      }}
    >
      <div style={{ fontSize: 12, color: "#3B4953", fontWeight: 500, lineHeight: 1.3 }}>
        {dot ? (
          <span
            aria-hidden
            style={{ display: "inline-block", width: 7, height: 7, borderRadius: 99, background: dot, marginRight: 5, verticalAlign: 1 }}
          />
        ) : null}
        {item.name}
      </div>
      {item.when ? (
        <div style={{ fontSize: 10, color: "#547863", marginTop: 2, lineHeight: 1.3, fontStyle: "italic" }}>
          when {item.when}
        </div>
      ) : null}
      <div style={{ fontSize: 10, color: "#90AB8B", marginTop: 2, lineHeight: 1.3 }}>
        {item.source}
      </div>
    </div>
  );
}

/** A short dashed line from one step box to the next, ending in a small arrowhead. */
function StepConnector({ compact }: { compact: boolean }) {
  const h = compact ? 8 : 14
  return (
    <div aria-hidden style={{ display: "flex", flexDirection: "column", alignItems: "center", height: h }}>
      <div style={{ flex: 1, borderLeft: "1.5px dashed #90AB8B" }} />
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: `${compact ? 3 : 4}px solid transparent`,
          borderRight: `${compact ? 3 : 4}px solid transparent`,
          borderTop: `${compact ? 3 : 4}px solid #90AB8B`,
        }}
      />
    </div>
  );
}

/**
 * One wing: as tall as what it holds, level with the middle of the body, and joined
 * to it by a dashed line, so inputs read as flowing in and outputs as flowing out.
 */
function Wing({
  side,
  label,
  items,
  compact,
}: {
  side: "left" | "right";
  label: string;
  items: IOItem[];
  compact: boolean;
}) {
  const left = side === "left";
  const outer = compact ? 18 : 28;
  const inner = compact ? 8 : 12;
  const wing = (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: "#EBF4DD",
        borderRadius: left ? `${outer}px ${inner}px ${inner}px ${outer}px` : `${inner}px ${outer}px ${outer}px ${inner}px`,
        padding: compact ? "10px 8px" : "16px 16px",
      }}
    >
      <div
        style={{
          fontSize: compact ? 8 : 10,
          fontWeight: 600,
          color: "#547863",
          letterSpacing: 1.4,
          textTransform: "uppercase",
          marginBottom: compact ? 6 : 10,
          textAlign: left ? "left" : "right",
        }}
      >
        {label}
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <IOCard
            key={item.name}
            item={item}
            align={side}
            // Several ways out: tell them apart at a glance.
            dot={!left && items.filter((i) => i.when).length > 1 && item.when ? OUTPUT_COLOURS[index % OUTPUT_COLOURS.length] : undefined}
          />
        ))}
      </div>
    </div>
  );
  const joint = (
    <div aria-hidden style={{ width: compact ? 8 : 14, borderTop: "1.5px dashed #90AB8B", flexShrink: 0 }} />
  );
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
      {left ? (
        <>
          {wing}
          {joint}
        </>
      ) : (
        <>
          {joint}
          {wing}
        </>
      )}
    </div>
  );
}

export function ButterflyCard({
  data,
  selected = false,
  multiSelected = false,
  hovered = false,
  compact = false,
  shared = false,
  incomplete = false,
  maxSteps,
  marks,
  hideScore = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  data: ButterflyData;
  selected?: boolean;
  multiSelected?: boolean;
  hovered?: boolean;
  compact?: boolean;
  shared?: boolean;
  incomplete?: boolean;
  maxSteps?: number;
  marks?: Record<number, StepMark>;
  /** Leave the automation score pill off, for a view that says it another way. */
  hideScore?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const shadow = selected || multiSelected
    ? "drop-shadow(0px 0px 0px rgba(84, 120, 99, 0.9)) drop-shadow(0px 8px 32px rgba(59, 73, 83, 0.18))"
    : hovered
    ? "drop-shadow(0px 6px 28px rgba(59, 73, 83, 0.18))"
    : "drop-shadow(0px 4px 24px rgba(59, 73, 83, 0.12))";

  // Score is derived from step automation potentials when present; falls back
  // to any stored value (kept around for legacy workflows that haven't been
  // classified yet).
  const derivedScore = calculateAutomationScore(data.steps);
  const effectiveScore = derivedScore > 0 ? derivedScore : (data.automationScore ?? 0);
  const showAutomatable = effectiveScore >= 70;
  const steps = maxSteps ? data.steps.slice(0, maxSteps) : data.steps;

  return (
    <div
      className="relative transition-all"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        width: compact ? 280 : 560,
        filter: shadow,
        cursor: "pointer",
        transform: hovered && !selected && !multiSelected ? "translateY(-2px)" : "translateY(0)",
        outline: multiSelected ? "2.5px solid #547863" : selected ? "2px solid #547863" : "none",
        outlineOffset: 6,
        borderRadius: 24,
        ...dmSans,
      }}
    >
      {multiSelected && (
        <div
          className="absolute z-20 flex items-center justify-center"
          style={{
            top: -8,
            left: -8,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "#547863",
            border: "2px solid #FFFFFF",
            boxShadow: "0 1px 4px rgba(59,73,83,0.2)",
          }}
        >
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="#EBF4DD" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {incomplete && (
        <>
          <div
            aria-hidden
            className="absolute"
            style={{
              inset: 0,
              borderRadius: 24,
              border: "2.5px dashed #C99461",
              pointerEvents: "none",
              zIndex: 30,
            }}
          />
          <div
            className="absolute z-20 flex items-center gap-1"
            style={{
              top: 0,
              left: 0,
              background: "#C99461",
              color: "#FFFFFF",
              fontSize: compact ? 9 : 10,
              fontWeight: 500,
              padding: compact ? "3px 8px" : "5px 10px",
              borderRadius: 999,
              letterSpacing: 0.3,
            }}
          >
            <AlertCircle size={compact ? 10 : 12} />
            Set trigger
          </div>
        </>
      )}

      {effectiveScore > 0 && !hideScore && (
        // Continuous score pill — no threshold cliff. Sage when ≥70 (the
        // workflow is mostly automatable), muted neutral below so users see
        // the gradient as they classify rather than a binary jump.
        <div
          className="absolute z-20 flex items-center gap-1"
          style={{
            top: 0,
            right: 0,
            background: showAutomatable ? "#547863" : "#FFFFFF",
            color: showAutomatable ? "#EBF4DD" : "#547863",
            border: showAutomatable ? "none" : "1px solid #EBF4DD",
            fontSize: compact ? 9 : 10,
            fontWeight: 500,
            padding: compact ? "3px 8px" : "5px 10px",
            borderRadius: 999,
            letterSpacing: 0.3,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <Zap
            size={compact ? 10 : 12}
            fill={showAutomatable ? "#EBF4DD" : "#547863"}
            strokeWidth={0}
          />
          {effectiveScore}%
        </div>
      )}

      {/* HEAD */}
      <div className="flex justify-center">
        <div
          style={{
            background: "#3B4953",
            borderRadius: compact ? 12 : 16,
            padding: compact ? "9px 14px" : "14px 22px",
            width: compact ? 160 : 240,
            textAlign: "center",
            position: "relative",
            zIndex: 10,
          }}
        >
          <div style={{ ...dmSerif, color: "#FFFFFF", fontSize: compact ? 12 : 19, lineHeight: 1.2 }}>
            {data.name}
          </div>
          {!compact && shared && (
            <div className="flex justify-center mt-2">
              <span
                className="flex items-center gap-1"
                style={{
                  background: "rgba(235, 244, 221, 0.12)",
                  color: "#90AB8B",
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                <Link2 size={8} />
                shared
              </span>
            </div>
          )}
        </div>
      </div>

      {/* TOOLS — under the head, where the reader starts: what this work runs on */}
      {data.tools.length > 0 && (
        <div className="flex justify-center" style={{ marginTop: compact ? -4 : -6, position: "relative", zIndex: 9 }}>
          <div
            style={{
              background: "#547863",
              borderRadius: compact ? 10 : 14,
              padding: compact ? "4px 8px" : "6px 12px",
              display: "flex",
              gap: compact ? 4 : 6,
              zIndex: 10,
              position: "relative",
            }}
          >
            {data.tools.map((tool) => (
              <span
                key={tool}
                style={{
                  background: "rgba(255, 255, 255, 0.18)",
                  color: "#FFFFFF",
                  fontSize: compact ? 8 : 10,
                  fontWeight: 500,
                  padding: compact ? "2px 6px" : "3px 9px",
                  borderRadius: 999,
                }}
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* WINGS + BODY
          The body is the process: its steps joined box to box, top to bottom. The
          wings are short, and sit level with the middle of the body, joined to it by
          a dashed line: inputs flow in on the left, outputs flow out on the right. */}
      <div
        className="flex items-center"
        style={{ marginTop: compact ? -6 : -8, gap: 0 }}
      >
        <Wing side="left" label="Inputs" items={data.inputs} compact={compact} />

        <div
          style={{
            width: compact ? 126 : 252,
            background: "#FFFFFF",
            borderRadius: compact ? 12 : 18,
            padding: compact ? "14px 6px 10px" : "24px 14px 18px",
            alignSelf: "stretch",
            boxShadow: "0 0 0 1px #EBF4DD",
          }}
        >
          <div className="flex flex-col">
            {steps.map((t, i) => (
              <div key={t.n}>
                <div
                  style={{
                    background: marks?.[t.n] ? marks[t.n].bg : "#F7FAF2",
                    boxShadow: marks?.[t.n] ? `inset 0 0 0 1.5px ${marks[t.n].fg}` : "inset 0 0 0 1px #E3EAD8",
                    borderRadius: 10,
                    padding: compact ? "5px 7px" : "8px 10px",
                    display: "flex",
                    gap: compact ? 5 : 8,
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      background: "#547863",
                      color: "#FFFFFF",
                      fontSize: compact ? 8 : 11,
                      fontWeight: 600,
                      width: compact ? 14 : 22,
                      height: compact ? 14 : 22,
                      borderRadius: 999,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {t.n}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: compact ? 9 : 11, color: "#3B4953", lineHeight: 1.35 }}>
                      {t.text}
                    </div>
                    {t.owner && !compact && (
                      <div style={{ fontSize: 9, color: "#90AB8B", marginTop: 2, lineHeight: 1.3 }}>
                        {t.owner}
                      </div>
                    )}
                    {/* Marks and notes live inside the box, so the line between boxes stays clean. */}
                    {marks?.[t.n] && !compact && (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          marginTop: 4,
                          fontSize: 9.5,
                          fontWeight: 600,
                          color: marks[t.n].fg,
                        }}
                      >
                        <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: marks[t.n].fg }} />
                        {marks[t.n].label}
                      </div>
                    )}
                    {t.note && !compact && (
                      <div style={{ ...dmSerif, fontSize: 10, color: "#547863", marginTop: 4, lineHeight: 1.35 }}>
                        {t.note}
                      </div>
                    )}
                  </div>
                  {t.isSensitive && (
                    <span
                      title={SENSITIVE_META.description}
                      aria-label={SENSITIVE_META.label}
                      style={{
                        display: "inline-flex",
                        color: SENSITIVE_META.fg,
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <Lock size={compact ? 9 : 11} />
                    </span>
                  )}
                </div>
                {i < steps.length - 1 && <StepConnector compact={compact} />}
              </div>
            ))}
          </div>
        </div>

        <Wing side="right" label="Outputs" items={data.outputs} compact={compact} />
      </div>

    </div>
  );
}
