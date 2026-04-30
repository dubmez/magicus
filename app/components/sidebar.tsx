"use client";

import { Zap } from "lucide-react";
import type { Theme, Workflow } from "@/lib/workflows";
import { THEME_META } from "@/lib/workflows";

export function Sidebar({
  workflows,
  selectedId,
  themeFilter,
  onSelect,
  onThemeFilter,
}: {
  workflows: Workflow[];
  selectedId: string | null;
  themeFilter: Theme | null;
  onSelect: (id: string) => void;
  onThemeFilter: (t: Theme | null) => void;
}) {
  const themes: Theme[] = ["sales", "marketing", "operations", "finance"];
  const visible = themeFilter ? workflows.filter((w) => w.theme === themeFilter) : workflows;

  const themesToRender = themeFilter ? [themeFilter] : themes;
  const grouped = themesToRender.map((t) => ({
    theme: t,
    items: visible.filter((w) => w.theme === t),
  }));

  return (
    <div
      className="h-full overflow-y-auto"
      style={{
        width: 260,
        background: "#FFFFFF",
        borderRight: "1px solid #EBF4DD",
        fontFamily: "var(--font-dm-sans), sans-serif",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: "18px 18px 10px",
          fontSize: 11,
          fontWeight: 600,
          color: "#547863",
          letterSpacing: 1.4,
          textTransform: "uppercase",
        }}
      >
        Workflow library
      </div>

      <div className="flex flex-wrap gap-1.5" style={{ padding: "0 14px 14px" }}>
        <FilterChip
          label="All"
          count={workflows.length}
          active={themeFilter === null}
          onClick={() => onThemeFilter(null)}
        />
        {themes.map((t) => {
          const count = workflows.filter((w) => w.theme === t).length;
          return (
            <FilterChip
              key={t}
              label={THEME_META[t].label}
              count={count}
              dot={THEME_META[t].dot}
              active={themeFilter === t}
              onClick={() => onThemeFilter(themeFilter === t ? null : t)}
            />
          );
        })}
      </div>

      <div style={{ padding: "0 12px 24px" }}>
        {grouped.map(({ theme, items }) => (
          <div key={theme} style={{ marginTop: 8 }}>
            {!themeFilter && (
              <div
                style={{
                  fontSize: 11,
                  color: "#90AB8B",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  padding: "10px 8px 6px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: THEME_META[theme].dot,
                  }}
                />
                {THEME_META[theme].label}
              </div>
            )}
            {items.length === 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: "#90AB8B",
                  padding: "4px 14px 6px",
                  fontStyle: "italic",
                }}
              >
                No workflows yet
              </div>
            )}
            {items.map((w) => {
              const active = selectedId === w.id;
              const automatable = w.automationScore >= 70;
              return (
                <button
                  key={w.id}
                  onClick={() => onSelect(w.id)}
                  className="w-full flex items-center gap-2 transition-colors text-left"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: active ? "#EBF4DD" : "transparent",
                    color: "#3B4953",
                    fontSize: 13,
                    marginBottom: 1,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: THEME_META[theme].dot,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {w.name}
                  </span>
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
                      }}
                    >
                      <Zap size={9} fill="#EBF4DD" strokeWidth={0} />
                      auto
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  dot,
  active,
  onClick,
}: {
  label: string;
  count: number;
  dot?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 transition-colors"
      style={{
        background: active ? "#3B4953" : "#F7FAF2",
        color: active ? "#EBF4DD" : "#547863",
        border: active ? "1px solid #3B4953" : "1px solid #EBF4DD",
        padding: "4px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: 999, background: dot }} />
      )}
      {label}
      <span style={{ opacity: 0.7, fontSize: 10 }}>{count}</span>
    </button>
  );
}
