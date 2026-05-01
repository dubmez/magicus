"use client";

import { useCallback, useRef, useState } from "react";
import { X, Download, Zap, Link2, Trash2, Plus, Check, Clock, Hand } from "lucide-react";
import type { Workflow, Theme, Trigger } from "@/lib/workflows";
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
        border: `1px solid ${showFocus ? "#547863" : "transparent"}`,
        borderRadius: 8,
        outline: "none",
        fontFamily: "inherit",
        color: "#3B4953",
        fontSize: 13,
        width: "100%",
        padding: showFocus ? "8px 10px" : "0",
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

function TriggerPicker({
  trigger,
  incomingWorkflows,
  onChange,
}: {
  trigger: Trigger | null;
  incomingWorkflows: Workflow[];
  onChange: (t: Trigger | null) => void;
}) {
  const isChained = trigger?.type === "chained";

  if (isChained) {
    return (
      <div
        style={{
          background: "#F7FAF2",
          border: "1px solid #EBF4DD",
          borderRadius: 10,
          padding: "10px 12px",
        }}
      >
        <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
          <Link2 size={13} style={{ color: "#547863" }} />
          <span style={{ fontSize: 12, color: "#3B4953", fontWeight: 500 }}>
            Triggered by upstream workflow
          </span>
        </div>
        {incomingWorkflows.length > 0 && (
          <div style={{ fontSize: 11, color: "#547863", lineHeight: 1.4 }}>
            {incomingWorkflows.map((w) => w.name).join(", ")}
          </div>
        )}
        <div style={{ fontSize: 10, color: "#90AB8B", marginTop: 6, fontStyle: "italic" }}>
          Disconnect on the canvas to change.
        </div>
      </div>
    );
  }

  const types: { type: Trigger["type"]; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
    { type: "schedule", icon: Clock, label: "Schedule" },
    { type: "event", icon: Zap, label: "Event" },
    { type: "manual", icon: Hand, label: "Manual" },
  ];

  return (
    <div>
      <div className="flex gap-2" style={{ marginBottom: 10 }}>
        {types.map(({ type, icon: Icon, label }) => {
          const active = trigger?.type === type;
          return (
            <button
              key={type}
              onClick={() => onChange({ type, description: trigger?.description ?? "" })}
              style={{
                flex: 1,
                padding: "8px 6px",
                borderRadius: 8,
                background: active ? "#3B4953" : "#F7FAF2",
                color: active ? "#EBF4DD" : "#547863",
                border: `1px solid ${active ? "#3B4953" : "#EBF4DD"}`,
                fontSize: 11,
                fontWeight: 500,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
                transition: "background 0.12s, color 0.12s",
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>
      {trigger && (
        <InlineTextarea
          value={trigger.description ?? ""}
          onChange={(v) => onChange({ type: trigger.type, description: v })}
          placeholder={
            trigger.type === "schedule"
              ? "e.g. Every Monday at 9am"
              : trigger.type === "event"
              ? "e.g. New row added in Airtable"
              : "e.g. Run on demand from Slack"
          }
          rows={2}
        />
      )}
      {!trigger && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "#90AB8B",
            fontStyle: "italic",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: "#F59E0B",
              flexShrink: 0,
            }}
          />
          Pick a trigger type to complete this workflow.
        </div>
      )}
    </div>
  );
}

export function DetailPanel({
  workflow,
  incomingWorkflows = [],
  readOnly = false,
  onClose,
  onExport,
  onChain,
  onDelete,
  onUpdate,
}: {
  workflow: Workflow | null;
  incomingWorkflows?: Workflow[];
  readOnly?: boolean;
  onClose: () => void;
  onExport: (id: string) => void;
  onChain: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, changes: Partial<Workflow>) => void;
}) {
  const update = useCallback(
    (changes: Partial<Workflow>) => {
      if (readOnly || !workflow) return;
      onUpdate(workflow.id, changes);
    },
    [workflow, onUpdate, readOnly]
  );

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

          {/* Header */}
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
              {/* Theme picker */}
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                {(Object.keys(THEME_META) as Theme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => update({ theme: t })}
                    title={THEME_META[t].label}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: THEME_META[t].dot,
                      outline: workflow.theme === t ? `2px solid ${THEME_META[t].dot}` : "none",
                      outlineOffset: 2,
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                ))}
                <span style={{ fontSize: 11, color: "#547863", textTransform: "uppercase", letterSpacing: 1, marginLeft: 4 }}>
                  {THEME_META[workflow.theme].label}
                </span>
              </div>

              {/* Editable name */}
              <InlineInput
                value={workflow.name}
                onChange={(v) => update({ name: v })}
                placeholder="Workflow name"
                style={{ ...dmSerif, fontSize: 22, color: "#3B4953", lineHeight: "1.2" }}
              />
            </div>

            <div className="flex items-center gap-1" style={{ marginTop: 4 }}>
              {!readOnly && (
                <button
                  onClick={() => onDelete(workflow.id)}
                  className="hover:bg-[#EBF4DD] rounded-md p-1.5"
                  style={{ color: "#90AB8B" }}
                  aria-label="Delete workflow"
                >
                  <Trash2 size={15} />
                </button>
              )}
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

          {readOnly && (
            <div
              style={{
                padding: "8px 20px",
                fontSize: 11,
                color: "#90AB8B",
                background: "#F7FAF2",
                borderBottom: "1px solid #EBF4DD",
                fontStyle: "italic",
              }}
            >
              Read-only — workflows on the Examples canvas can&apos;t be edited.
            </div>
          )}

          {/* Scrollable body */}
          <fieldset
            disabled={readOnly}
            className="flex-1 overflow-y-auto"
            style={{
              padding: "20px",
              border: "none",
              minWidth: 0,
              opacity: readOnly ? 0.85 : 1,
            }}
          >

            {/* Trigger */}
            <Section label="Trigger">
              <TriggerPicker
                trigger={workflow.trigger}
                incomingWorkflows={incomingWorkflows}
                onChange={(t) => update({ trigger: t })}
              />
            </Section>

            <Section label="Purpose">
              <InlineTextarea
                value={workflow.why}
                onChange={(v) => update({ why: v })}
                placeholder="Why does this workflow exist?"
                rows={2}
              />
            </Section>

            {/* Steps */}
            <Section label="Steps">
              <ol className="flex flex-col gap-2" style={{ listStyle: "none", padding: 0 }}>
                {workflow.steps.map((t, i) => (
                  <li
                    key={t.n}
                    className="group"
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
                          marginTop: 2,
                        }}
                      >
                        {t.n}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <InlineInput
                          value={t.text}
                          onChange={(v) => {
                            const steps = [...workflow.steps];
                            steps[i] = { ...steps[i], text: v };
                            update({ steps });
                          }}
                          placeholder="Step description"
                          style={{ fontSize: 13, color: "#3B4953" }}
                        />
                        <InlineInput
                          value={t.note ?? ""}
                          onChange={(v) => {
                            const steps = [...workflow.steps];
                            steps[i] = { ...steps[i], note: v || undefined };
                            update({ steps });
                          }}
                          placeholder="Add a note…"
                          style={{ ...dmSerif, fontSize: 11, color: "#547863", marginTop: 4 }}
                        />
                        <InlineInput
                          value={t.owner ?? ""}
                          onChange={(v) => {
                            const steps = [...workflow.steps];
                            steps[i] = { ...steps[i], owner: v || undefined };
                            update({ steps });
                          }}
                          placeholder="Owner…"
                          style={{ fontSize: 11, color: "#90AB8B", marginTop: 2 }}
                        />
                      </div>
                      <button
                        onClick={() => {
                          const steps = workflow.steps
                            .filter((_, j) => j !== i)
                            .map((t, j) => ({ ...t, n: j + 1 }));
                          update({ steps });
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:bg-[#EBF4DD] rounded p-0.5"
                        style={{ color: "#90AB8B", flexShrink: 0 }}
                        aria-label="Remove step"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
              <button
                onClick={() => {
                  update({
                    steps: [...workflow.steps, { n: workflow.steps.length + 1, text: "" }],
                  });
                }}
                className="flex items-center gap-1 hover:bg-[#EBF4DD] rounded-md transition-colors"
                style={{ fontSize: 12, color: "#547863", marginTop: 8, padding: "4px 8px" }}
              >
                <Plus size={12} />
                Add step
              </button>
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
                        style={{ fontSize: 11, color: "#90AB8B" }}
                      />
                    </div>
                    <button
                      onClick={() => update({ inputs: workflow.inputs.filter((_, j) => j !== i) })}
                      className="opacity-0 group-hover:opacity-100 hover:bg-[#EBF4DD] rounded p-0.5"
                      style={{ color: "#90AB8B", flexShrink: 0 }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => update({ inputs: [...workflow.inputs, { name: "", source: "" }] })}
                  className="flex items-center gap-1 hover:bg-[#EBF4DD] rounded-md transition-colors"
                  style={{ fontSize: 12, color: "#547863", padding: "4px 8px" }}
                >
                  <Plus size={12} />
                  Add input
                </button>
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
                        style={{ fontSize: 11, color: "#90AB8B" }}
                      />
                    </div>
                    <button
                      onClick={() => update({ outputs: workflow.outputs.filter((_, j) => j !== i) })}
                      className="opacity-0 group-hover:opacity-100 hover:bg-[#EBF4DD] rounded p-0.5"
                      style={{ color: "#90AB8B", flexShrink: 0 }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => update({ outputs: [...workflow.outputs, { name: "", source: "" }] })}
                  className="flex items-center gap-1 hover:bg-[#EBF4DD] rounded-md transition-colors"
                  style={{ fontSize: 12, color: "#547863", padding: "4px 8px" }}
                >
                  <Plus size={12} />
                  Add output
                </button>
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
                    <button
                      onClick={() => update({ tools: workflow.tools.filter((_, j) => j !== i) })}
                      className="opacity-0 group-hover:opacity-60 transition-opacity"
                      style={{ color: "#EBF4DD", display: "flex", marginLeft: 2 }}
                      aria-label={`Remove ${t}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <AddToolInput
                  onAdd={(tool) => update({ tools: [...workflow.tools, tool] })}
                />
              </div>
            </Section>

            {/* Automation potential */}
            <Section label="Automation potential">
              <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={workflow.automationScore}
                  onChange={(e) => update({ automationScore: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: "#547863" }}
                />
                <span style={{ fontSize: 13, color: "#3B4953", fontWeight: 500, minWidth: 36, textAlign: "right" }}>
                  {workflow.automationScore}%
                </span>
                {workflow.automationScore >= 70 && (
                  <Zap size={14} fill="#547863" strokeWidth={0} />
                )}
              </div>
              <InlineTextarea
                value={workflow.automationRationale}
                onChange={(v) => update({ automationRationale: v })}
                placeholder="Why is this automatable?"
                rows={2}
                style={{ fontSize: 12, color: "#547863" }}
              />
            </Section>
          </fieldset>

          {/* Footer */}
          <div style={{ borderTop: "1px solid #EBF4DD", padding: 12, display: "flex", gap: 8 }}>
            {!readOnly && (
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
            )}
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
