"use client";

import { useState } from "react";
import { Plus, ChevronRight, ChevronDown, Zap, Link2, Pencil } from "lucide-react";
import type { Canvas, Workflow } from "@/lib/workflows";
import {
  THEME_META,
  computeChains,
  chainKey,
  inferChainName,
  calculateAutomationScore,
} from "@/lib/workflows";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };

// ─── Canvas name (editable) ───────────────────────────────────────────────────

function CanvasName({
  name,
  active,
  readOnly = false,
  onRename,
  onClick,
}: {
  name: string;
  active: boolean;
  readOnly?: boolean;
  onRename: (name: string) => void;
  onClick: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);

  const commit = () => {
    setEditing(false);
    const t = val.trim();
    if (t && t !== name) onRename(t);
    else setVal(name);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setEditing(false); setVal(name); }
        }}
        style={{
          flex: 1,
          background: "#F7FAF2",
          border: "1px solid #547863",
          borderRadius: 6,
          padding: "3px 8px",
          fontSize: 13,
          fontWeight: 500,
          color: "#3B4953",
          outline: "none",
          fontFamily: "var(--font-dm-sans), sans-serif",
        }}
      />
    );
  }

  return (
    <button
      onClick={onClick}
      onDoubleClick={() => { if (!readOnly) setEditing(true); }}
      className="group flex-1 text-left truncate transition-colors flex items-center gap-2 min-w-0"
      style={{
        ...dmSerif,
        fontSize: 14,
        color: active ? "#3B4953" : "#547863",
        fontWeight: active ? 600 : 400,
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
      title={readOnly ? "Read-only" : "Click to switch · Double-click to rename"}
    >
      <span className="truncate" style={{ opacity: readOnly ? 0.85 : 1 }}>{name}</span>
      {!readOnly && (
        <Pencil
          size={10}
          aria-hidden
          className="opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0"
          style={{ color: "#547863" }}
        />
      )}
      {readOnly && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: "#90AB8B",
            background: "#F7FAF2",
            border: "1px solid #EBF4DD",
            borderRadius: 4,
            padding: "1px 5px",
            letterSpacing: 0.6,
            textTransform: "uppercase",
            fontStyle: "normal",
            fontFamily: "var(--font-dm-sans), sans-serif",
            flexShrink: 0,
          }}
        >
          Examples
        </span>
      )}
    </button>
  );
}

// ─── Chain section ────────────────────────────────────────────────────────────

function ChainRow({
  chainIds,
  chainName,
  workflows,
  selectedId,
  focusedChainKey: focusedKey,
  sharedWorkflowIds,
  onSelectWorkflow,
  onFocusChain,
}: {
  chainIds: string[];
  chainName: string;
  workflows: Workflow[];
  selectedId: string | null;
  focusedChainKey: string | null;
  sharedWorkflowIds: Set<string>;
  onSelectWorkflow: (id: string) => void;
  onFocusChain: (key: string | null) => void;
}) {
  const ckey = chainKey(chainIds);
  const isHighlighted = focusedKey === ckey;
  const [expanded, setExpanded] = useState(true);

  // Sort chain members by x position (flow order)
  const members = chainIds
    .map((id) => workflows.find((w) => w.id === id))
    .filter(Boolean) as Workflow[];
  members.sort((a, b) => a.x - b.x);

  return (
    <div>
      <button
        onClick={() => {
          setExpanded((e) => !e);
          onFocusChain(isHighlighted ? null : ckey);
        }}
        className="w-full flex items-center gap-2 transition-colors hover:bg-[#F7FAF2] rounded-md"
        style={{
          padding: "6px 8px",
          background: isHighlighted ? "rgba(84,120,99,0.08)" : "transparent",
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "#90AB8B",
            flexShrink: 0,
          }}
        />
        <span
          className="flex-1 text-left truncate"
          style={{ fontSize: 12, color: "#3B4953", fontWeight: 500 }}
        >
          {chainName}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "#90AB8B",
            background: "#F7FAF2",
            border: "1px solid #EBF4DD",
            borderRadius: 999,
            padding: "1px 6px",
            fontWeight: 500,
          }}
        >
          {chainIds.length}
        </span>
        {expanded ? (
          <ChevronDown size={12} style={{ color: "#90AB8B", flexShrink: 0 }} />
        ) : (
          <ChevronRight size={12} style={{ color: "#90AB8B", flexShrink: 0 }} />
        )}
      </button>

      {expanded && (
        <div style={{ paddingLeft: 18 }}>
          {members.map((w) => (
            <WorkflowRow
              key={w.id}
              workflow={w}
              selected={selectedId === w.id}
              shared={sharedWorkflowIds.has(w.id)}
              onSelect={() => onSelectWorkflow(w.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single workflow row ──────────────────────────────────────────────────────

function WorkflowRow({
  workflow,
  selected,
  shared,
  onSelect,
}: {
  workflow: Workflow;
  selected: boolean;
  shared: boolean;
  onSelect: () => void;
}) {
  const derived = calculateAutomationScore(workflow.steps);
  const score = derived > 0 ? derived : workflow.automationScore;
  const automatable = score >= 70;
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-2 transition-colors text-left rounded-md"
      style={{
        padding: "5px 8px",
        background: selected ? "#EBF4DD" : "transparent",
        marginBottom: 1,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: THEME_META[workflow.theme].dot,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          flex: 1,
          fontSize: 12,
          color: "#3B4953",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {workflow.name}
      </span>
      {shared && (
        <Link2 size={10} style={{ color: "#90AB8B", flexShrink: 0 }} />
      )}
      {automatable && (
        <span
          title="Marked automatable"
          aria-label="Marked automatable"
          style={{ display: "inline-flex", flexShrink: 0 }}
        >
          <Zap size={10} fill="#547863" strokeWidth={0} />
        </span>
      )}
    </button>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({
  canvases,
  activeCanvasId,
  workflows,
  selectedId,
  focusedChainKey,
  sharedWorkflowIds,
  onSwitchCanvas,
  onRenameCanvas,
  onCreateCanvas,
  onSelectWorkflow,
  onFocusChain,
}: {
  canvases: Canvas[];
  activeCanvasId: string;
  workflows: Workflow[];
  selectedId: string | null;
  focusedChainKey: string | null;
  sharedWorkflowIds: Set<string>;
  onSwitchCanvas: (id: string) => void;
  onRenameCanvas: (id: string, name: string) => void;
  onCreateCanvas: (name: string) => void;
  onSelectWorkflow: (id: string) => void;
  onFocusChain: (key: string | null) => void;
}) {
  return (
    <div
      // Hidden on small screens — canvas + detail panel take priority on
      // mobile. Power users on desktop get the full sidebar.
      className="hidden md:flex h-full overflow-y-auto flex-col"
      style={{
        width: 260,
        background: "#FFFFFF",
        borderRight: "1px solid #EBF4DD",
        fontFamily: "var(--font-dm-sans), sans-serif",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "18px 16px 10px" }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "#90AB8B",
            letterSpacing: 1.4,
            textTransform: "uppercase",
          }}
        >
          Canvases
        </span>
        <button
          onClick={() => {
            const userCount = canvases.filter((c) => !c.readOnly).length;
            onCreateCanvas(userCount === 0 ? "Untitled" : `Untitled ${userCount + 1}`);
          }}
          className="hover:bg-[#EBF4DD] transition-colors rounded"
          style={{ padding: 4, color: "#547863", display: "flex", alignItems: "center" }}
          aria-label="New canvas"
          title="New canvas"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Canvas list */}
      <div className="flex-1" style={{ padding: "0 8px" }}>
        {canvases.map((canvas) => {
          const isActive = canvas.id === activeCanvasId;
          const canvasWorkflows = workflows.filter((w) =>
            canvas.workflowIds.includes(w.id)
          );
          const chains = computeChains(
            canvas.workflowIds,
            canvas.connections
          );
          const multiChains = chains.filter((c) => c.length >= 2);
          const singleIds = chains.filter((c) => c.length === 1).map((c) => c[0]);

          return (
            <div key={canvas.id} style={{ marginBottom: 4 }}>
              {/* Canvas row */}
              <div
                className="flex items-center gap-1.5 rounded-lg"
                style={{
                  padding: "7px 8px",
                  background: isActive ? "#F7FAF2" : "transparent",
                  marginBottom: 2,
                }}
              >
                <ChevronDown
                  size={13}
                  style={{
                    color: "#90AB8B",
                    transform: isActive ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 0.15s",
                    flexShrink: 0,
                  }}
                />
                <CanvasName
                  name={canvas.name}
                  active={isActive}
                  readOnly={canvas.readOnly}
                  onRename={(name) => onRenameCanvas(canvas.id, name)}
                  onClick={() => onSwitchCanvas(canvas.id)}
                />
              </div>

              {/* Canvas contents (only when active) */}
              {isActive && (
                <div style={{ paddingLeft: 8, paddingBottom: 8 }}>
                  {/* Multi-workflow chains */}
                  {multiChains.map((chainIds) => {
                    const ckey = chainKey(chainIds);
                    const chainWfs = chainIds
                      .map((id) => canvasWorkflows.find((w) => w.id === id))
                      .filter(Boolean) as Workflow[];
                    const name = canvas.chainNames[ckey] ?? inferChainName(chainWfs);
                    return (
                      <ChainRow
                        key={ckey}
                        chainIds={chainIds}
                        chainName={name}
                        workflows={canvasWorkflows}
                        selectedId={selectedId}
                        focusedChainKey={focusedChainKey}
                        sharedWorkflowIds={sharedWorkflowIds}
                        onSelectWorkflow={onSelectWorkflow}
                        onFocusChain={onFocusChain}
                      />
                    );
                  })}

                  {/* Ungrouped single workflows */}
                  {singleIds.length > 0 && (
                    <div>
                      {multiChains.length > 0 && (
                        <div
                          style={{
                            height: 1,
                            background: "#EBF4DD",
                            margin: "6px 4px",
                          }}
                        />
                      )}
                      {singleIds.map((id) => {
                        const w = canvasWorkflows.find((x) => x.id === id);
                        if (!w) return null;
                        return (
                          <WorkflowRow
                            key={id}
                            workflow={w}
                            selected={selectedId === id}
                            shared={sharedWorkflowIds.has(id)}
                            onSelect={() => onSelectWorkflow(id)}
                          />
                        );
                      })}
                    </div>
                  )}

                  {canvasWorkflows.length === 0 && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#90AB8B",
                        padding: "4px 8px",
                        lineHeight: 1.45,
                      }}
                    >
                      No workflows here yet — use the toolbar above to map one.
                    </div>
                  )}
                </div>
              )}

              {/* Divider between canvases */}
              <div style={{ height: 1, background: "#EBF4DD", margin: "4px 0" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
