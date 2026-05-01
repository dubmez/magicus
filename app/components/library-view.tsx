"use client";

import { useState } from "react";
import { Zap, ArrowUpDown, Trash2 } from "lucide-react";
import type { Workflow, Trigger } from "@/lib/workflows";
import { THEME_META } from "@/lib/workflows";


type SortKey = "name" | "theme" | "trigger" | "automation";

function triggerLabel(trigger: Trigger | null): string {
  if (!trigger) return "Not set";
  if (trigger.type === "chained") return "Chained";
  return trigger.type.charAt(0).toUpperCase() + trigger.type.slice(1);
}

export function LibraryView({
  workflows,
  onOpen,
  onDelete,
}: {
  workflows: Workflow[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("theme");
  const [asc, setAsc] = useState(true);

  const sorted = [...workflows].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name") cmp = a.name.localeCompare(b.name);
    else if (sortKey === "theme") cmp = a.theme.localeCompare(b.theme);
    else if (sortKey === "trigger") cmp = triggerLabel(a.trigger).localeCompare(triggerLabel(b.trigger));
    else if (sortKey === "automation") cmp = a.automationScore - b.automationScore;
    return asc ? cmp : -cmp;
  });

  const setSort = (k: SortKey) => {
    if (sortKey === k) setAsc(!asc);
    else { setSortKey(k); setAsc(true); }
  };

  return (
    <div
      className="w-full h-full overflow-y-auto"
      style={{ background: "#F7FAF2", fontFamily: "var(--font-dm-sans), sans-serif" }}
    >
      <div style={{ padding: "32px 40px", maxWidth: 1300, margin: "0 auto" }}>
        <div
          style={{
            fontFamily: "var(--font-dm-serif), serif",
            fontStyle: "italic",
            fontSize: 28,
            color: "#3B4953",
            marginBottom: 4,
          }}
        >
          Library
        </div>
        <div style={{ fontSize: 13, color: "#547863", marginBottom: 24 }}>
          {sorted.length} workflow{sorted.length === 1 ? "" : "s"}
        </div>

        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #EBF4DD",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 2fr) 130px 160px minmax(160px, 1.2fr) 180px 44px",
              gap: 12,
              padding: "14px 20px",
              fontSize: 11,
              color: "#547863",
              letterSpacing: 1.2,
              textTransform: "uppercase",
              fontWeight: 600,
              borderBottom: "1px solid #EBF4DD",
              background: "#FBFDF7",
            }}
          >
            <HeaderCell label="Workflow" sortKey="name" current={sortKey} asc={asc} onClick={setSort} />
            <HeaderCell label="Theme" sortKey="theme" current={sortKey} asc={asc} onClick={setSort} />
            <HeaderCell label="Trigger" sortKey="trigger" current={sortKey} asc={asc} onClick={setSort} />
            <div>Tools</div>
            <HeaderCell label="Automation" sortKey="automation" current={sortKey} asc={asc} onClick={setSort} />
            <div />
          </div>

          {sorted.length === 0 && (
            <div
              style={{
                padding: "60px 24px",
                textAlign: "center",
                color: "#90AB8B",
                fontSize: 13,
              }}
            >
              No workflows here yet. Try a different filter or map a new one.
            </div>
          )}

          {sorted.map((w) => {
            const automatable = w.automationScore >= 70;
            const incomplete = !w.trigger;
            return (
              <div
                key={w.id}
                onClick={() => onOpen(w.id)}
                className="cursor-pointer transition-colors hover:bg-[#FBFDF7]"
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 2fr) 130px 160px minmax(160px, 1.2fr) 180px 44px",
                  gap: 12,
                  padding: "14px 20px",
                  borderBottom: "1px solid #EBF4DD",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: THEME_META[w.theme].dot,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-dm-serif), serif",
                        fontStyle: "italic",
                        fontSize: 15,
                        color: "#3B4953",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {w.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#90AB8B", marginTop: 1 }}>
                      {w.steps.length} step{w.steps.length === 1 ? "" : "s"} · {w.inputs.length} in / {w.outputs.length} out
                    </div>
                  </div>
                  {automatable && (
                    <span
                      className="flex items-center gap-0.5"
                      style={{
                        background: "#547863",
                        color: "#EBF4DD",
                        fontSize: 9,
                        fontWeight: 500,
                        padding: "2px 6px",
                        borderRadius: 999,
                        flexShrink: 0,
                      }}
                    >
                      <Zap size={9} fill="#EBF4DD" strokeWidth={0} />
                      auto
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 12, color: "#547863", textTransform: "capitalize" }}>
                  {THEME_META[w.theme].label}
                </div>
                <div className="flex items-center" style={{ minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: incomplete ? "#90AB8B" : "#3B4953",
                      fontStyle: incomplete ? "italic" : "normal",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={incomplete ? "Trigger not yet defined" : undefined}
                  >
                    {triggerLabel(w.trigger)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1" style={{ minWidth: 0 }}>
                  {w.tools.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      style={{
                        background: "#EBF4DD",
                        color: "#3B4953",
                        fontSize: 10,
                        padding: "2px 7px",
                        borderRadius: 999,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                  {w.tools.length > 3 && (
                    <span style={{ fontSize: 10, color: "#90AB8B", padding: "2px 4px" }}>
                      +{w.tools.length - 3}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      background: "#EBF4DD",
                      borderRadius: 999,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${w.automationScore}%`,
                        height: "100%",
                        background: automatable ? "#547863" : "#90AB8B",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#3B4953",
                      fontWeight: 500,
                      minWidth: 28,
                      textAlign: "right",
                    }}
                  >
                    {w.automationScore}%
                  </span>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(w.id); }}
                  className="hover:bg-[#EBF4DD] rounded-md p-1.5"
                  style={{ color: "#90AB8B", justifySelf: "end" }}
                  aria-label="Delete workflow"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HeaderCell({
  label,
  sortKey,
  current,
  asc,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  asc: boolean;
  onClick: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button
      onClick={() => onClick(sortKey)}
      className="flex items-center gap-1 transition-colors hover:text-[#3B4953]"
      style={{
        color: active ? "#3B4953" : undefined,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        fontSize: 11,
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {label}
      <ArrowUpDown
        size={11}
        style={{
          opacity: active ? 1 : 0.4,
          transform: active && !asc ? "scaleY(-1)" : undefined,
        }}
      />
    </button>
  );
}
