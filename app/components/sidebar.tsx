"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, ChevronRight, ChevronDown, Zap, Link2, Pencil, BookOpen, MoreHorizontal, Trash2 } from "lucide-react";
import type { Canvas, Workflow, LibraryCategory } from "@/lib/workflows";
import {
  THEME_META,
  LIBRARY_CANVAS_ID,
  LIBRARY_CATEGORY_META,
  LIBRARY_CATEGORY_ORDER,
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
  editing: controlledEditing,
  onEditingChange,
  onRename,
  onClick,
}: {
  name: string;
  active: boolean;
  readOnly?: boolean;
  // Optional controlled mode — when supplied, the parent owns edit
  // state so the overflow menu's "Rename" can trigger it. Falls back
  // to internal state for the legacy double-click path.
  editing?: boolean;
  onEditingChange?: (next: boolean) => void;
  onRename: (name: string) => void;
  onClick: () => void;
}) {
  const [internalEditing, setInternalEditing] = useState(false);
  const editing = controlledEditing ?? internalEditing;
  const setEditing = (next: boolean) => {
    if (onEditingChange) onEditingChange(next);
    else setInternalEditing(next);
  };
  const [val, setVal] = useState(name);

  // Re-sync the input value if the canvas name changes (or if edit
  // mode is entered programmatically with a stale local val).
  useEffect(() => {
    setVal(name);
  }, [name, editing]);

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
      title={readOnly ? "Read-only — adapt workflows from here" : "Click to switch · Double-click to rename"}
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
          Library
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

// ─── Library category section ────────────────────────────────────────────────
// Each Library category gets its own expandable header. Inside: any chains
// whose workflows belong to this category, then standalone workflows in the
// category. A chain's category is inferred from its first workflow's
// category — by design all workflows in a seeded chain share one.

function CategorySection({
  category,
  libraryCanvas,
  libraryWorkflows,
  selectedId,
  focusedChainKey,
  sharedWorkflowIds,
  onSelectLibraryWorkflow,
  onFocusChain,
}: {
  category: LibraryCategory;
  libraryCanvas: Canvas;
  libraryWorkflows: Workflow[];
  selectedId: string | null;
  focusedChainKey: string | null;
  sharedWorkflowIds: Set<string>;
  // Switches active canvas to the Library AND selects the workflow.
  onSelectLibraryWorkflow: (id: string) => void;
  onFocusChain: (key: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Workflows belonging to this category — used to filter chains and
  // surface standalone entries below.
  const categoryWorkflowIds = new Set(
    libraryWorkflows.filter((w) => w.category === category).map((w) => w.id)
  );

  // Compute chains across the entire library, then keep only those whose
  // first workflow is in this category. Seed chains never cross categories,
  // so this is sufficient grouping without category-tagging chains directly.
  const allChains = computeChains(
    libraryCanvas.workflowIds,
    libraryCanvas.connections
  );
  const inCategory = allChains.filter((c) => categoryWorkflowIds.has(c[0]));
  const multiChains = inCategory.filter((c) => c.length >= 2);
  const singleIds = inCategory.filter((c) => c.length === 1).map((c) => c[0]);
  const totalCount = multiChains.reduce((n, c) => n + c.length, 0) + singleIds.length;

  const meta = LIBRARY_CATEGORY_META[category];

  return (
    <div style={{ marginBottom: 2 }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 transition-colors hover:bg-[#F7FAF2] rounded-md"
        style={{ padding: "6px 8px", background: "transparent" }}
      >
        {expanded ? (
          <ChevronDown size={12} style={{ color: "#90AB8B", flexShrink: 0 }} />
        ) : (
          <ChevronRight size={12} style={{ color: "#90AB8B", flexShrink: 0 }} />
        )}
        <span
          className="flex-1 text-left truncate"
          style={{ fontSize: 12, color: "#3B4953", fontWeight: 500 }}
        >
          {meta.label}
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
          {totalCount}
        </span>
      </button>

      {expanded && (
        <div style={{ paddingLeft: 14 }}>
          {multiChains.map((chainIds) => {
            const ckey = chainKey(chainIds);
            const chainWfs = chainIds
              .map((id) => libraryWorkflows.find((w) => w.id === id))
              .filter(Boolean) as Workflow[];
            const name =
              libraryCanvas.chainNames[ckey] ?? inferChainName(chainWfs);
            return (
              <ChainRow
                key={ckey}
                chainIds={chainIds}
                chainName={name}
                workflows={libraryWorkflows}
                selectedId={selectedId}
                focusedChainKey={focusedChainKey}
                sharedWorkflowIds={sharedWorkflowIds}
                onSelectWorkflow={onSelectLibraryWorkflow}
                onFocusChain={onFocusChain}
              />
            );
          })}
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
                const w = libraryWorkflows.find((x) => x.id === id);
                if (!w) return null;
                return (
                  <WorkflowRow
                    key={id}
                    workflow={w}
                    selected={selectedId === id}
                    shared={sharedWorkflowIds.has(id)}
                    onSelect={() => onSelectLibraryWorkflow(id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
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
  onDeleteCanvas,
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
  // Triggered when the user picks "Delete canvas" from the overflow.
  // The parent owns the confirmation modal and the actual deletion.
  onDeleteCanvas: (id: string) => void;
  onCreateCanvas: (name: string) => void;
  onSelectWorkflow: (id: string) => void;
  onFocusChain: (key: string | null) => void;
}) {
  // Track which canvas's overflow popover is open and which is in
  // edit mode. Only one popover / edit at a time.
  const [overflowOpenId, setOverflowOpenId] = useState<string | null>(null);
  const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  // Click-outside to close the overflow popover.
  useEffect(() => {
    if (!overflowOpenId) return;
    const onDoc = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpenId(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [overflowOpenId]);
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
        {/* User canvases — read/write, top of sidebar. The Library
            canvas is filtered out here and rendered below as its own
            section with category groupings. */}
        {canvases
          .filter((c) => c.id !== LIBRARY_CANVAS_ID && !c.readOnly)
          .map((canvas) => {
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
              {/* Canvas row — group lets the overflow button fade in on hover */}
              <div
                className="group flex items-center gap-1.5 rounded-lg"
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
                  editing={editingCanvasId === canvas.id}
                  onEditingChange={(v) => setEditingCanvasId(v ? canvas.id : null)}
                  onRename={(name) => onRenameCanvas(canvas.id, name)}
                  onClick={() => onSwitchCanvas(canvas.id)}
                />
                {/* Overflow menu — only on user canvases. Click to open the
                    Rename / Delete popover. Stays mounted in DOM but fades
                    via opacity so the layout doesn't jump on hover. */}
                <div
                  ref={overflowOpenId === canvas.id ? overflowRef : undefined}
                  style={{ position: "relative", flexShrink: 0 }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOverflowOpenId(
                        overflowOpenId === canvas.id ? null : canvas.id
                      );
                    }}
                    aria-label="Canvas options"
                    title="Canvas options"
                    className="opacity-0 group-hover:opacity-60 hover:bg-[#EBF4DD] transition-all rounded"
                    style={{
                      padding: 3,
                      color: "#547863",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {overflowOpenId === canvas.id && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        right: 0,
                        background: "#FFFFFF",
                        border: "1px solid #EBF4DD",
                        borderRadius: 8,
                        padding: 4,
                        boxShadow: "0 8px 24px rgba(59,73,83,0.12)",
                        zIndex: 20,
                        minWidth: 160,
                      }}
                    >
                      <button
                        onClick={() => {
                          setEditingCanvasId(canvas.id);
                          setOverflowOpenId(null);
                        }}
                        className="w-full flex items-center gap-2 hover:bg-[#F7FAF2] rounded transition-colors"
                        style={{
                          padding: "7px 10px",
                          background: "transparent",
                          border: "none",
                          fontSize: 13,
                          color: "#3B4953",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <Pencil size={12} style={{ color: "#547863" }} />
                        Rename
                      </button>
                      <button
                        onClick={() => {
                          onDeleteCanvas(canvas.id);
                          setOverflowOpenId(null);
                        }}
                        className="w-full flex items-center gap-2 hover:bg-[#FDECEC] rounded transition-colors"
                        style={{
                          padding: "7px 10px",
                          background: "transparent",
                          border: "none",
                          fontSize: 13,
                          color: "#C0392B",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={12} />
                        Delete canvas
                      </button>
                    </div>
                  )}
                </div>
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
                      Map your first workflow, or adapt one from the
                      Library below →
                    </div>
                  )}
                </div>
              )}

              {/* Divider between canvases */}
              <div style={{ height: 1, background: "#EBF4DD", margin: "4px 0" }} />
            </div>
          );
        })}

        {/* Library section — read-only, categorised, no per-section
            "+" button. Chains and standalone workflows live inside
            the four categories. Clicking a workflow switches to the
            Library canvas and selects the workflow. */}
        {(() => {
          const library = canvases.find((c) => c.id === LIBRARY_CANVAS_ID);
          if (!library) return null;
          const libraryWorkflows = workflows.filter((w) =>
            library.workflowIds.includes(w.id)
          );
          const handleSelectLibrary = (id: string) => {
            if (activeCanvasId !== LIBRARY_CANVAS_ID) onSwitchCanvas(LIBRARY_CANVAS_ID);
            onSelectWorkflow(id);
          };
          return (
            <div style={{ marginTop: 14 }}>
              <div
                className="flex items-center justify-between"
                style={{ padding: "8px 8px 4px" }}
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
                  Library
                </span>
                <button
                  onClick={() => onSwitchCanvas(LIBRARY_CANVAS_ID)}
                  className="hover:bg-[#EBF4DD] transition-colors rounded"
                  style={{
                    padding: 4,
                    color: "#547863",
                    display: "flex",
                    alignItems: "center",
                  }}
                  aria-label="Browse library"
                  title="Open the library canvas"
                >
                  <BookOpen size={13} />
                </button>
              </div>
              {LIBRARY_CATEGORY_ORDER.map((category) => (
                <CategorySection
                  key={category}
                  category={category}
                  libraryCanvas={library}
                  libraryWorkflows={libraryWorkflows}
                  selectedId={selectedId}
                  focusedChainKey={focusedChainKey}
                  sharedWorkflowIds={sharedWorkflowIds}
                  onSelectLibraryWorkflow={handleSelectLibrary}
                  onFocusChain={onFocusChain}
                />
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
