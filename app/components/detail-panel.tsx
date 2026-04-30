"use client";

import { X, Download, Zap, Link2, Trash2 } from "lucide-react";
import type { Workflow } from "@/lib/workflows";
import { THEME_META } from "@/lib/workflows";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };

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

function Tag({
  children,
  color = "#EBF4DD",
  text = "#3B4953",
}: {
  children: React.ReactNode;
  color?: string;
  text?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: color,
        color: text,
        fontSize: 11,
        padding: "3px 9px",
        borderRadius: 999,
      }}
    >
      {children}
    </span>
  );
}

export function DetailPanel({
  workflow,
  onClose,
  onExport,
  onChain,
  onDelete,
}: {
  workflow: Workflow | null;
  onClose: () => void;
  onExport: (id: string) => void;
  onChain: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const open = !!workflow;
  return (
    <div
      style={{
        width: open ? 420 : 0,
        flexShrink: 0,
        height: "100%",
        background: "#FFFFFF",
        borderLeft: open ? "1px solid #EBF4DD" : "none",
        overflow: "hidden",
        transition: "width 220ms ease",
        fontFamily: "var(--font-dm-sans), sans-serif",
      }}
    >
      {workflow && (
        <div className="h-full flex flex-col" style={{ width: 420 }}>
          <div
            style={{
              padding: "18px 20px 14px",
              borderBottom: "1px solid #EBF4DD",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <div style={{ flex: 1 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: THEME_META[workflow.theme].dot,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "#547863",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {THEME_META[workflow.theme].label}
                </span>
              </div>
              <div style={{ ...dmSerif, fontSize: 22, color: "#3B4953", lineHeight: 1.2 }}>
                {workflow.name}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDelete(workflow.id)}
                className="hover:bg-[#EBF4DD] rounded-md p-1.5"
                style={{ color: "#90AB8B" }}
                aria-label="Delete workflow"
                title="Delete workflow"
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={onClose}
                className="hover:bg-[#EBF4DD] rounded-md p-1.5"
                style={{ color: "#547863" }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ padding: "20px" }}>
            <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 22 }}>
              <Tag>Owner · {workflow.owner}</Tag>
              <Tag>{workflow.frequency}</Tag>
            </div>

            <Section label="Why">
              <div style={{ fontSize: 13, color: "#3B4953", lineHeight: 1.5 }}>{workflow.why}</div>
            </Section>

            <Section label="When">
              <div style={{ fontSize: 13, color: "#3B4953", lineHeight: 1.5 }}>{workflow.when}</div>
            </Section>

            <Section label="Tasks">
              <ol className="flex flex-col gap-2" style={{ listStyle: "none", padding: 0 }}>
                {workflow.tasks.map((t) => (
                  <li
                    key={t.n}
                    style={{ background: "#F7FAF2", borderRadius: 10, padding: "10px 12px" }}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        style={{
                          background: "#547863",
                          color: "#FFFFFF",
                          fontSize: 11,
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
                        {t.n}
                      </span>
                      <div style={{ fontSize: 13, color: "#3B4953", lineHeight: 1.4 }}>{t.text}</div>
                    </div>
                    {t.note && (
                      <div
                        style={{
                          ...dmSerif,
                          fontSize: 12,
                          color: "#547863",
                          marginTop: 6,
                          marginLeft: 28,
                        }}
                      >
                        {t.note}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </Section>

            <Section label="Inputs">
              <div className="flex flex-wrap gap-1.5">
                {workflow.inputs.map((i) => (
                  <Tag key={i.name}>
                    {i.name}
                    <span style={{ color: "#90AB8B" }}>· {i.source}</span>
                  </Tag>
                ))}
              </div>
            </Section>

            <Section label="Outputs">
              <div className="flex flex-wrap gap-1.5">
                {workflow.outputs.map((o) => (
                  <Tag key={o.name}>
                    {o.name}
                    <span style={{ color: "#90AB8B" }}>· {o.source}</span>
                  </Tag>
                ))}
              </div>
            </Section>

            <Section label="Tools">
              <div className="flex flex-wrap gap-1.5">
                {workflow.tools.map((t) => (
                  <Tag key={t} color="#3B4953" text="#FFFFFF">
                    {t}
                  </Tag>
                ))}
              </div>
            </Section>

            <Section label="Automation potential">
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    background: "#EBF4DD",
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${workflow.automationScore}%`,
                      height: "100%",
                      background: workflow.automationScore >= 70 ? "#547863" : "#90AB8B",
                      borderRadius: 999,
                      transition: "width 400ms ease",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 13,
                    color: "#3B4953",
                    fontWeight: 500,
                    minWidth: 36,
                    textAlign: "right",
                  }}
                >
                  {workflow.automationScore}%
                </span>
                {workflow.automationScore >= 70 && (
                  <Zap size={14} fill="#547863" strokeWidth={0} />
                )}
              </div>
              <div style={{ fontSize: 12, color: "#547863", lineHeight: 1.45 }}>
                {workflow.automationRationale}
              </div>
            </Section>
          </div>

          <div
            style={{
              borderTop: "1px solid #EBF4DD",
              padding: 12,
              display: "flex",
              gap: 8,
            }}
          >
            <button
              onClick={() => onChain(workflow.id)}
              className="flex items-center justify-center gap-2 hover:bg-[#EBF4DD] transition-colors"
              style={{
                background: "transparent",
                color: "#3B4953",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 500,
                border: "1px solid #EBF4DD",
                flex: "0 0 auto",
              }}
              title="Chain this workflow into another"
            >
              <Link2 size={14} />
              Chain →
            </button>
            <button
              onClick={() => onExport(workflow.id)}
              className="flex-1 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              style={{
                background: "#3B4953",
                color: "#EBF4DD",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <Download size={14} />
              Export .md
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
