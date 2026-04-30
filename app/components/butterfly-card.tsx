"use client";

import { Zap } from "lucide-react";

type IOItem = { name: string; source: string };
type Task = { n: number; text: string; note?: string };

export type ButterflyData = {
  name: string;
  owner: string;
  frequency: string;
  inputs: IOItem[];
  tasks: Task[];
  outputs: IOItem[];
  tools: string[];
  automationScore?: number;
};

const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };
const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };

function IOCard({ item, align }: { item: IOItem; align: "left" | "right" }) {
  return (
    <div
      className="bg-white rounded-[10px] px-3 py-2"
      style={{
        ...dmSans,
        textAlign: align === "left" ? "left" : "right",
        boxShadow: "0px 1px 2px rgba(59, 73, 83, 0.06)",
      }}
    >
      <div style={{ fontSize: 12, color: "#3B4953", fontWeight: 500, lineHeight: 1.3 }}>
        {item.name}
      </div>
      <div style={{ fontSize: 10, color: "#90AB8B", marginTop: 2, lineHeight: 1.3 }}>
        {item.source}
      </div>
    </div>
  );
}

export function ButterflyCard({
  data,
  selected = false,
  hovered = false,
  compact = false,
  maxTasks,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  data: ButterflyData;
  selected?: boolean;
  hovered?: boolean;
  compact?: boolean;
  maxTasks?: number;
  onClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const shadow = selected
    ? "drop-shadow(0px 0px 0px rgba(84, 120, 99, 0.9)) drop-shadow(0px 8px 32px rgba(59, 73, 83, 0.18))"
    : hovered
    ? "drop-shadow(0px 6px 28px rgba(59, 73, 83, 0.18))"
    : "drop-shadow(0px 4px 24px rgba(59, 73, 83, 0.12))";

  const showAutomatable = (data.automationScore ?? 0) >= 70;
  const tasks = maxTasks ? data.tasks.slice(0, maxTasks) : data.tasks;

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
        transform: hovered && !selected ? "translateY(-2px)" : "translateY(0)",
        outline: selected ? "2px solid #547863" : "none",
        outlineOffset: 6,
        borderRadius: 24,
        ...dmSans,
      }}
    >
      {showAutomatable && (
        <div
          className="absolute z-20 flex items-center gap-1"
          style={{
            top: -10,
            right: -8,
            background: "#547863",
            color: "#EBF4DD",
            fontSize: compact ? 9 : 10,
            fontWeight: 500,
            padding: compact ? "3px 8px" : "5px 10px",
            borderRadius: 999,
            letterSpacing: 0.3,
          }}
        >
          <Zap size={compact ? 10 : 12} fill="#EBF4DD" strokeWidth={0} />
          Automatable
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
          <div style={{ ...dmSerif, color: "#FFFFFF", fontSize: compact ? 12 : 16, lineHeight: 1.2 }}>
            {data.name}
          </div>
          {!compact && (
            <div className="flex gap-1.5 justify-center mt-2">
              <span
                style={{
                  background: "rgba(235, 244, 221, 0.12)",
                  color: "#90AB8B",
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                Owner · {data.owner}
              </span>
              <span
                style={{
                  background: "rgba(235, 244, 221, 0.12)",
                  color: "#90AB8B",
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                {data.frequency}
              </span>
            </div>
          )}
          {compact && (
            <div style={{ color: "#90AB8B", fontSize: 9, marginTop: 3 }}>
              {data.owner} · {data.frequency}
            </div>
          )}
        </div>
      </div>

      {/* WINGS + BODY */}
      <div className="flex items-stretch" style={{ marginTop: compact ? -6 : -8 }}>
        {/* LEFT WING */}
        <div
          style={{
            flex: 1,
            background: "#EBF4DD",
            borderTopLeftRadius: compact ? 14 : 20,
            borderBottomLeftRadius: compact ? 18 : 28,
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            padding: compact ? "12px 8px 12px 12px" : "20px 16px 20px 20px",
            borderRight: "1.5px dashed #90AB8B",
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
            }}
          >
            Inputs
          </div>
          <div className="flex flex-col gap-1.5">
            {data.inputs.map((i) => (
              <IOCard key={i.name} item={i} align="left" />
            ))}
          </div>
        </div>

        {/* BODY */}
        <div
          style={{
            width: compact ? 100 : 200,
            background: "#FFFFFF",
            padding: compact ? "10px 6px" : "18px 14px",
            position: "relative",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              top: 24,
              bottom: 24,
              width: 0,
              borderLeft: "1.5px dashed #90AB8B",
              transform: "translateX(-0.75px)",
              zIndex: 0,
            }}
          />
          <div className="relative flex flex-col gap-2" style={{ zIndex: 1 }}>
            {tasks.map((t) => (
              <div key={t.n}>
                <div
                  style={{
                    background: "#F7FAF2",
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
                      fontSize: compact ? 8 : 10,
                      fontWeight: 600,
                      width: compact ? 14 : 18,
                      height: compact ? 14 : 18,
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
                  <span style={{ fontSize: compact ? 9 : 11, color: "#3B4953", lineHeight: 1.35 }}>
                    {t.text}
                  </span>
                </div>
                {t.note && !compact && (
                  <div
                    style={{
                      ...dmSerif,
                      fontSize: 10,
                      color: "#547863",
                      marginTop: 4,
                      marginLeft: 28,
                    }}
                  >
                    {t.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT WING */}
        <div
          style={{
            flex: 1,
            background: "#EBF4DD",
            borderTopRightRadius: compact ? 14 : 20,
            borderBottomRightRadius: compact ? 18 : 28,
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            padding: compact ? "12px 12px 12px 8px" : "20px 20px 20px 16px",
            borderLeft: "1.5px dashed #90AB8B",
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
              textAlign: "right",
            }}
          >
            Outputs
          </div>
          <div className="flex flex-col gap-1.5">
            {data.outputs.map((o) => (
              <IOCard key={o.name} item={o} align="right" />
            ))}
          </div>
        </div>
      </div>

      {/* FOOT */}
      <div className="flex justify-center" style={{ marginTop: compact ? -6 : -8 }}>
        <div
          style={{
            background: "#547863",
            borderRadius: compact ? 10 : 14,
            padding: compact ? "5px 9px" : "8px 14px",
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
    </div>
  );
}
