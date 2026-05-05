"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Copy, Check, Eye, EyeOff } from "lucide-react";
import type { Workflow, Step } from "@/lib/workflows";
import {
  generateShareToken,
  defaultRedactions,
  type ShareRedactions,
  type ShareSettings,
} from "@/lib/shares";
import { storage } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };
const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

const REDACTED = "█████████";

// Compact preview that mirrors the redaction settings live. Not pixel-perfect
// to the canvas butterfly — just enough to show 'this is what they'll see'.
function SharePreview({
  workflow,
  redactions,
}: {
  workflow: Workflow;
  redactions: ShareRedactions;
}) {
  const visibleSteps = workflow.steps.filter(
    (s) => !redactions.hiddenStepNumbers.includes(s.n)
  );
  const visibleInputs = workflow.inputs.filter(
    (_, i) => !redactions.hiddenInputIndices.includes(i)
  );
  const visibleOutputs = workflow.outputs.filter(
    (_, i) => !redactions.hiddenOutputIndices.includes(i)
  );
  const triggerLabel =
    workflow.trigger?.description && !redactions.triggerDescription
      ? workflow.trigger.description
      : workflow.trigger
      ? redactions.triggerDescription ? REDACTED : `On ${workflow.trigger.type}`
      : "No trigger";

  return (
    <div
      style={{
        ...dmSans,
        background: "#FFFFFF",
        border: "1px solid #EBF4DD",
        borderRadius: 14,
        padding: 14,
        height: "100%",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          ...dmSerif,
          fontSize: 14,
          color: "#3B4953",
          lineHeight: 1.3,
          marginBottom: 4,
        }}
      >
        {workflow.name}
      </div>
      <div style={{ fontSize: 11, color: "#90AB8B", marginBottom: 10 }}>
        {triggerLabel}
      </div>

      {/* Purpose */}
      {workflow.why && (
        <div
          style={{
            fontSize: 11,
            color: redactions.purpose ? "#90AB8B" : "#547863",
            fontStyle: "italic",
            marginBottom: 10,
            lineHeight: 1.4,
          }}
        >
          {redactions.purpose ? REDACTED : workflow.why}
        </div>
      )}

      {/* Steps */}
      <div style={{ fontSize: 9, fontWeight: 600, color: "#547863", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>
        Steps
      </div>
      <div className="flex flex-col gap-1.5" style={{ marginBottom: 10 }}>
        {workflow.steps.map((s) => {
          const hidden = redactions.hiddenStepNumbers.includes(s.n);
          return (
            <div
              key={s.n}
              style={{
                fontSize: 11,
                color: hidden ? "#90AB8B" : "#3B4953",
                lineHeight: 1.35,
                background: hidden ? "#F1EFE8" : "transparent",
                padding: hidden ? "3px 6px" : "0",
                borderRadius: 4,
                fontStyle: hidden ? "italic" : "normal",
              }}
            >
              <span style={{ color: "#90AB8B", marginRight: 6 }}>{s.n}.</span>
              {hidden ? "[Hidden]" : s.text}
            </div>
          );
        })}
      </div>

      {/* IO */}
      {workflow.inputs.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: "#547863", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>
            Inputs
          </div>
          <div className="flex flex-wrap gap-1">
            {workflow.inputs.map((inp, i) => {
              const hidden = redactions.hiddenInputIndices.includes(i);
              return (
                <span
                  key={i}
                  style={{
                    fontSize: 10,
                    background: hidden ? "#F1EFE8" : "#EBF4DD",
                    color: hidden ? "#90AB8B" : "#3B4953",
                    padding: "2px 7px",
                    borderRadius: 999,
                    fontStyle: hidden ? "italic" : "normal",
                  }}
                >
                  {hidden ? REDACTED : inp.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {workflow.outputs.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: "#547863", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>
            Outputs
          </div>
          <div className="flex flex-wrap gap-1">
            {workflow.outputs.map((out, i) => {
              const hidden = redactions.hiddenOutputIndices.includes(i);
              return (
                <span
                  key={i}
                  style={{
                    fontSize: 10,
                    background: hidden ? "#F1EFE8" : "#EBF4DD",
                    color: hidden ? "#90AB8B" : "#3B4953",
                    padding: "2px 7px",
                    borderRadius: 999,
                    fontStyle: hidden ? "italic" : "normal",
                  }}
                >
                  {hidden ? REDACTED : out.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {workflow.tools.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 600, color: "#547863", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>
            Tools
          </div>
          {redactions.tools ? (
            <span style={{ fontSize: 10, color: "#90AB8B", fontStyle: "italic" }}>{REDACTED}</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {workflow.tools.map((t, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 10,
                    background: "#3B4953",
                    color: "#FFFFFF",
                    padding: "2px 7px",
                    borderRadius: 999,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {redactions.classifications && (
        <div style={{ marginTop: 8, fontSize: 10, color: "#90AB8B", fontStyle: "italic" }}>
          {REDACTED} (readiness hidden)
        </div>
      )}

      {visibleSteps.length === 0 &&
        visibleInputs.length === 0 &&
        visibleOutputs.length === 0 && (
          <div style={{ fontSize: 11, color: "#8B2A2A", fontStyle: "italic", marginTop: 8 }}>
            Everything is redacted — recipients won&apos;t see anything useful.
          </div>
        )}
    </div>
  );
}

// One toggleable row used for top-level fields and individual steps/IO.
function ToggleRow({
  label,
  visible,
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  visible: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!visible)}
      disabled={disabled}
      className="w-full flex items-center justify-between transition-colors hover:bg-[#F7FAF2] rounded-md"
      style={{
        padding: "6px 8px",
        background: "transparent",
        border: "none",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span className="flex flex-col items-start" style={{ minWidth: 0 }}>
        <span
          style={{
            fontSize: 12,
            color: visible ? "#3B4953" : "#90AB8B",
            fontWeight: 500,
            textDecoration: visible ? "none" : "line-through",
          }}
        >
          {label}
        </span>
        {hint && (
          <span style={{ fontSize: 10, color: "#90AB8B", marginTop: 1 }}>{hint}</span>
        )}
      </span>
      <span
        style={{
          width: 16,
          height: 16,
          flexShrink: 0,
          color: visible ? "#547863" : "#90AB8B",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label={visible ? "Visible" : "Hidden"}
      >
        {visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </span>
    </button>
  );
}

// Section header in the redaction list.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: "#547863",
        letterSpacing: 1.2,
        textTransform: "uppercase",
        margin: "10px 8px 4px",
      }}
    >
      {children}
    </div>
  );
}

// ─── Main modal ────────────────────────────────────────────────────────────

export function ShareModal({
  workflow,
  open,
  onClose,
}: {
  workflow: Workflow | null;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [redactions, setRedactions] = useState<ShareRedactions>(defaultRedactions());
  const [generated, setGenerated] = useState<{ token: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [publicLibrary, setPublicLibrary] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);

  // Reset state every time we open for a fresh workflow.
  useEffect(() => {
    if (!open) return;
    setRedactions(defaultRedactions());
    setGenerated(null);
    setCopied(false);
    setPublicLibrary(false);
  }, [open, workflow?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const togglePart = useMemo(
    () => ({
      step: (n: number) => () => {
        setRedactions((r) => {
          const has = r.hiddenStepNumbers.includes(n);
          return {
            ...r,
            hiddenStepNumbers: has
              ? r.hiddenStepNumbers.filter((x) => x !== n)
              : [...r.hiddenStepNumbers, n],
          };
        });
      },
      input: (i: number) => () => {
        setRedactions((r) => {
          const has = r.hiddenInputIndices.includes(i);
          return {
            ...r,
            hiddenInputIndices: has
              ? r.hiddenInputIndices.filter((x) => x !== i)
              : [...r.hiddenInputIndices, i],
          };
        });
      },
      output: (i: number) => () => {
        setRedactions((r) => {
          const has = r.hiddenOutputIndices.includes(i);
          return {
            ...r,
            hiddenOutputIndices: has
              ? r.hiddenOutputIndices.filter((x) => x !== i)
              : [...r.hiddenOutputIndices, i],
          };
        });
      },
    }),
    []
  );

  if (!open || !workflow) return null;

  const handleGenerate = async () => {
    const token = generateShareToken();
    const settings: ShareSettings = {
      token,
      workflow: { ...workflow },
      sharedBy: user
        ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl }
        : { id: "anon", name: "Anonymous" },
      redactions,
      publicLibrary,
      remixCount: 0,
      createdAt: Date.now(),
    };
    await storage.saveShare(settings);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setGenerated({ token, url: `${origin}/w/${token}` });
    // Auto-copy + select on creation so the most likely next action is one
    // tap away.
    setTimeout(() => {
      linkInputRef.current?.select();
      navigator.clipboard.writeText(`${origin}/w/${token}`).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        },
        () => { /* clipboard refused — user can still click Copy */ }
      );
    }, 0);
  };

  const handleCopy = () => {
    if (!generated) return;
    navigator.clipboard.writeText(generated.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
    linkInputRef.current?.select();
  };

  const linkedInUrl = generated
    ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(generated.url)}&summary=${encodeURIComponent(`I just mapped my ${workflow.name} workflow on Magicus — here's the automation blueprint: ${generated.url}`)}`
    : "";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: "rgba(59, 73, 83, 0.4)",
        zIndex: 110,
        padding: 20,
        ...dmSans,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          maxHeight: "90vh",
          background: "#FFFFFF",
          borderRadius: 16,
          border: "1px solid #EBF4DD",
          boxShadow: "0 20px 48px rgba(59, 73, 83, 0.18)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between"
          style={{ padding: "20px 24px 12px", borderBottom: "1px solid #EBF4DD", flexShrink: 0 }}
        >
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                ...dmSerif,
                fontSize: 20,
                color: "#3B4953",
                lineHeight: 1.2,
                letterSpacing: -0.2,
              }}
            >
              Share this workflow
            </h2>
            <div style={{ fontSize: 13, color: "#90AB8B", marginTop: 4, lineHeight: 1.4 }}>
              Anyone with the link can view this workflow. They won&apos;t be able to edit it.
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-[#EBF4DD] rounded-md p-2"
            style={{ color: "#547863", flexShrink: 0 }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — preview + redaction list */}
        <div
          className="flex-1 overflow-hidden"
          style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", minHeight: 0 }}
        >
          <div style={{ padding: "16px 16px 16px 24px", overflowY: "auto" }}>
            <SharePreview workflow={workflow} redactions={redactions} />
          </div>
          <div style={{ padding: "16px 24px 16px 16px", borderLeft: "1px solid #EBF4DD", overflowY: "auto" }}>
            <ToggleRow
              label="Workflow name"
              visible
              onChange={() => { /* always visible per spec */ }}
              disabled
              hint="Always visible to recipients"
            />
            <ToggleRow
              label="Trigger description"
              visible={!redactions.triggerDescription}
              onChange={(v) => setRedactions((r) => ({ ...r, triggerDescription: !v }))}
            />
            <ToggleRow
              label="Purpose"
              visible={!redactions.purpose}
              onChange={(v) => setRedactions((r) => ({ ...r, purpose: !v }))}
            />
            <ToggleRow
              label="Tools"
              visible={!redactions.tools}
              onChange={(v) => setRedactions((r) => ({ ...r, tools: !v }))}
            />
            <ToggleRow
              label="Automation potential & readiness score"
              visible={!redactions.classifications}
              onChange={(v) => setRedactions((r) => ({ ...r, classifications: !v }))}
            />

            {workflow.steps.length > 0 && (
              <>
                <SectionLabel>Steps</SectionLabel>
                {workflow.steps.map((s: Step) => (
                  <ToggleRow
                    key={s.n}
                    label={`${s.n}. ${s.text || "(empty)"}`}
                    visible={!redactions.hiddenStepNumbers.includes(s.n)}
                    onChange={togglePart.step(s.n)}
                  />
                ))}
              </>
            )}

            {workflow.inputs.length > 0 && (
              <>
                <SectionLabel>Inputs</SectionLabel>
                {workflow.inputs.map((inp, i) => (
                  <ToggleRow
                    key={i}
                    label={inp.name || "(unnamed)"}
                    visible={!redactions.hiddenInputIndices.includes(i)}
                    onChange={togglePart.input(i)}
                  />
                ))}
              </>
            )}

            {workflow.outputs.length > 0 && (
              <>
                <SectionLabel>Outputs</SectionLabel>
                {workflow.outputs.map((out, i) => (
                  <ToggleRow
                    key={i}
                    label={out.name || "(unnamed)"}
                    visible={!redactions.hiddenOutputIndices.includes(i)}
                    onChange={togglePart.output(i)}
                  />
                ))}
              </>
            )}

            <div
              style={{
                marginTop: 14,
                padding: "8px 10px",
                fontSize: 11,
                color: "#90AB8B",
                fontStyle: "italic",
                lineHeight: 1.45,
                background: "#F7FAF2",
                borderRadius: 6,
              }}
            >
              Redacted fields are hidden from viewers. Your original workflow is unchanged.
            </div>
          </div>
        </div>

        {/* Footer — generate / link */}
        <div
          style={{
            padding: "14px 24px 20px",
            borderTop: "1px solid #EBF4DD",
            background: "#FFFFFF",
            flexShrink: 0,
          }}
        >
          {!generated ? (
            <>
              <label className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={publicLibrary}
                  onChange={(e) => setPublicLibrary(e.target.checked)}
                  style={{ accentColor: "#547863" }}
                />
                <span style={{ fontSize: 13, color: "#3B4953" }}>
                  Also add to public library
                </span>
              </label>
              {publicLibrary && (
                <div style={{ fontSize: 11, color: "#90AB8B", marginBottom: 12, lineHeight: 1.45 }}>
                  Your workflow will appear in the Magicus public library. Others can remix it. You can remove it at any time.
                </div>
              )}
              <button
                onClick={handleGenerate}
                className="w-full hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                style={{
                  background: "#3B4953",
                  color: "#EBF4DD",
                  padding: "12px 20px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Generate share link →
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <input
                  ref={linkInputRef}
                  value={generated.url}
                  readOnly
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    color: "#3B4953",
                    background: "#F7FAF2",
                    border: "1px solid #EBF4DD",
                    borderRadius: 999,
                    padding: "10px 14px",
                    outline: "none",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                />
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                  style={{
                    background: copied ? "#547863" : "#3B4953",
                    color: "#EBF4DD",
                    padding: "10px 16px",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 500,
                    border: "none",
                    cursor: "pointer",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Link copied" : "Copy link"}
                </button>
              </div>
              <a
                href={linkedInUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 hover:bg-[#EBF4DD] transition-colors"
                style={{
                  padding: "10px 16px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#547863",
                  border: "1px solid #547863",
                  background: "transparent",
                  textDecoration: "none",
                }}
              >
                {/* LinkedIn 'in' wordmark — drawn inline since lucide
                    dropped its branded LinkedIn glyph. */}
                <span
                  aria-hidden
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 3,
                    background: "#547863",
                    color: "#FFFFFF",
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: "var(--font-dm-sans), sans-serif",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  in
                </span>
                Share to LinkedIn
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
