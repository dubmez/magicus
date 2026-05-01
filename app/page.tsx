"use client";

import { useCallback, useMemo, useState } from "react";
import { Canvas } from "./components/canvas";
import { TopBar, type View } from "./components/top-bar";
import { Sidebar } from "./components/sidebar";
import { DetailPanel } from "./components/detail-panel";
import { ExportModal } from "./components/export-modal";
import { AutomateModal } from "./components/automate-modal";
import { LibraryView } from "./components/library-view";
import { Landing } from "./components/landing";
import { type Workflow, type Canvas as CanvasType, type Theme, type Connection } from "@/lib/workflows";
import { useWorkflows } from "@/lib/use-workflows";
import { workflowToMarkdown, allWorkflowsToMarkdown } from "@/lib/markdown";

function inferTheme(text: string): Theme {
  const t = text.toLowerCase();
  if (/(invoice|payment|finance|tax|expense|budget)/.test(t)) return "finance";
  if (/(content|newsletter|campaign|seo|brand|social|marketing)/.test(t)) return "marketing";
  if (/(vendor|onboard|ops|operations|inventory|fulfil|fulfill)/.test(t)) return "operations";
  return "sales";
}

function fallbackWorkflow(id: string, description: string): Workflow {
  return {
    id,
    theme: inferTheme(description),
    name: description.split(/[.!?]/)[0].trim().slice(0, 60) || "New workflow",
    trigger: null,
    why: description.trim(),
    inputs: [],
    steps: [],
    outputs: [],
    tools: [],
    automationScore: 50,
    automationRationale: "",
    x: 0,
    y: 0,
  };
}

type GeneratedWorkflow = Omit<Workflow, "x" | "y">;
type GeneratedResponse = {
  workflows: GeneratedWorkflow[];
  connections: { from: string; to: string; label?: string }[];
};

async function generateFromAPI(description: string): Promise<GeneratedResponse | null> {
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GeneratedResponse;
    if (!data?.workflows || data.workflows.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

export default function Home() {
  const {
    workflows,
    setWorkflows,
    canvases,
    setCanvases,
    activeCanvasId,
    setActiveCanvasId,
    activeCanvas,
  } = useWorkflows();

  const [started, setStarted] = useState(false);
  const [view, setView] = useState<View>("canvas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusedChainKey, setFocusedChainKey] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState<{ fromId: string } | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<"all" | { id: string } | null>(null);
  const [automateOpen, setAutomateOpen] = useState(false);

  const activeReadOnly = !!activeCanvas?.readOnly;

  // Workflows visible on the active canvas
  const activeWorkflows = useMemo(
    () => workflows.filter((w) => activeCanvas?.workflowIds.includes(w.id)),
    [workflows, activeCanvas]
  );

  // Which workflow IDs appear in more than one canvas
  const sharedWorkflowIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of canvases) {
      for (const id of c.workflowIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [canvases]);

  const selected = useMemo(
    () => workflows.find((w) => w.id === selectedId) ?? null,
    [workflows, selectedId]
  );

  const incomingWorkflows = useMemo(() => {
    if (!selectedId || !activeCanvas) return [];
    return activeCanvas.connections
      .filter((c) => c.to === selectedId)
      .map((c) => workflows.find((w) => w.id === c.from))
      .filter(Boolean) as Workflow[];
  }, [selectedId, activeCanvas, workflows]);

  // ── Canvas helpers ────────────────────────────────────────────────────────

  const updateCanvas = useCallback(
    (id: string, changes: Partial<CanvasType>) => {
      setCanvases((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)));
    },
    [setCanvases]
  );

  const updateActiveCanvas = useCallback(
    (changes: Partial<CanvasType>) => {
      if (activeCanvas) updateCanvas(activeCanvas.id, changes);
    },
    [activeCanvas, updateCanvas]
  );

  // ── Sidebar handlers ──────────────────────────────────────────────────────

  const handleSwitchCanvas = (id: string) => {
    setActiveCanvasId(id);
    setSelectedId(null);
    setSelectedIds(new Set());
    setFocusedChainKey(null);
    setView("canvas");
  };

  const handleRenameCanvas = (id: string, name: string) => {
    updateCanvas(id, { name });
  };

  const handleCreateCanvas = (name: string) => {
    const id = `canvas-${Date.now()}`;
    setCanvases((prev) => [
      ...prev,
      { id, name, workflowIds: [], connections: [], chainNames: {} },
    ]);
    setActiveCanvasId(id);
    setSelectedId(null);
    setSelectedIds(new Set());
    setFocusedChainKey(null);
    setView("canvas");
  };

  const handleSelectFromSidebar = (id: string) => {
    setSelectedId(id);
    setSelectedIds(new Set());
    setFocusedChainKey(null);
    if (view === "canvas") setFocusId(id + ":" + Date.now());
  };

  const handleFocusChain = (key: string | null) => {
    setFocusedChainKey(key);
    setSelectedId(null);
    setSelectedIds(new Set());
  };

  const handleMultiSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setSelectedId(null);
  };

  // ── Workflow CRUD ─────────────────────────────────────────────────────────

  const handleOpenFromLibrary = (id: string) => {
    setSelectedId(id);
    setView("canvas");
    setFocusId(id + ":" + Date.now());
  };

  const handleMap = async (description: string) => {
    // Never add new workflows to a read-only canvas — switch to the editable one
    let targetCanvas = activeCanvas;
    if (!targetCanvas || targetCanvas.readOnly) {
      targetCanvas = canvases.find((c) => !c.readOnly) ?? targetCanvas;
      if (targetCanvas) setActiveCanvasId(targetCanvas.id);
    }
    if (!targetCanvas) return;

    const targetWorkflows = workflows.filter((w) => targetCanvas!.workflowIds.includes(w.id));
    const baseX = targetWorkflows.length > 0
      ? Math.max(...targetWorkflows.map((w) => w.x)) + 800
      : 0;
    const baseY = 400;

    const generated = await generateFromAPI(description);
    const now = Date.now();

    let newWorkflows: Workflow[];
    let newConnections: Connection[] = [];
    let firstId: string;

    if (generated) {
      // Map LLM-local ids → real ids
      const idMap = new Map<string, string>();
      generated.workflows.forEach((w, i) => {
        idMap.set(w.id, `wf-${now}-${i}`);
      });
      newWorkflows = generated.workflows.map((w, i) => ({
        ...w,
        id: idMap.get(w.id)!,
        x: baseX + i * 800,
        y: baseY + (i % 2 === 0 ? 0 : 120),
      }));
      newConnections = generated.connections.flatMap<Connection>((c) => {
        const from = idMap.get(c.from);
        const to = idMap.get(c.to);
        if (!from || !to) return [];
        return [{ from, to, label: c.label ?? "Triggers" }];
      });
      firstId = newWorkflows[0].id;
    } else {
      const id = `wf-${now}`;
      const wf = fallbackWorkflow(id, description);
      wf.x = baseX;
      wf.y = baseY;
      newWorkflows = [wf];
      firstId = id;
    }

    setWorkflows((prev) => [...prev, ...newWorkflows]);
    updateCanvas(targetCanvas.id, {
      workflowIds: [...targetCanvas.workflowIds, ...newWorkflows.map((w) => w.id)],
      connections: [...targetCanvas.connections, ...newConnections],
    });
    setSelectedId(firstId);
    setSelectedIds(new Set());
    setView("canvas");
    setFocusId(firstId + ":" + now);
    setNewOpen(false);
    setStarted(true);
  };

  const handleUpdate = (id: string, changes: Partial<Workflow>) => {
    if (activeReadOnly) return;
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, ...changes } : w)));
  };

  const handleDelete = (id: string) => {
    if (activeReadOnly) return;
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    setCanvases((prev) =>
      prev.map((c) => ({
        ...c,
        workflowIds: c.workflowIds.filter((wid) => wid !== id),
        connections: c.connections.filter((conn) => conn.from !== id && conn.to !== id),
      }))
    );
    if (selectedId === id) setSelectedId(null);
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    if (connectMode?.fromId === id) setConnectMode(null);
  };

  // ── Connection handlers ───────────────────────────────────────────────────

  const handleStartChain = (fromId: string) => {
    if (activeReadOnly) return;
    setConnectMode({ fromId });
    setSelectedId(null);
    setView("canvas");
  };

  const handleCreateConnection = (fromId: string, toId: string) => {
    if (!activeCanvas || activeReadOnly) return;
    const exists = activeCanvas.connections.some(
      (c) => c.from === fromId && c.to === toId
    );
    if (!exists) {
      updateActiveCanvas({
        connections: [
          ...activeCanvas.connections,
          { from: fromId, to: toId, label: "Triggers" },
        ],
      });
    }
    // Auto-set the target's trigger to chained
    setWorkflows((prev) =>
      prev.map((w) => (w.id === toId ? { ...w, trigger: { type: "chained" } } : w))
    );
    setConnectMode(null);
    setSelectedId(toId);
    setSelectedIds(new Set());
  };

  const handleDeleteConnection = (fromId: string, toId: string) => {
    if (!activeCanvas || activeReadOnly) return;
    const newConns = activeCanvas.connections.filter(
      (c) => !(c.from === fromId && c.to === toId)
    );
    updateActiveCanvas({ connections: newConns });
    // If the target no longer has any incoming connection, clear its trigger
    const stillHasIncoming = newConns.some((c) => c.to === toId);
    if (!stillHasIncoming) {
      setWorkflows((prev) =>
        prev.map((w) => (w.id === toId ? { ...w, trigger: null } : w))
      );
    }
  };

  const handleUpdateChainName = (key: string, name: string) => {
    if (activeReadOnly) return;
    updateActiveCanvas({
      chainNames: { ...activeCanvas.chainNames, [key]: name },
    });
  };

  // ── Export ────────────────────────────────────────────────────────────────

  const exportTitle =
    exportTarget === "all"
      ? "Export · all workflows"
      : exportTarget && "id" in exportTarget
      ? `Export · ${workflows.find((w) => w.id === exportTarget.id)?.name ?? "workflow"}`
      : "";

  const exportMarkdown = useMemo(() => {
    if (exportTarget === "all") return allWorkflowsToMarkdown(activeWorkflows);
    if (exportTarget && "id" in exportTarget) {
      const w = workflows.find((x) => x.id === exportTarget.id);
      return w ? workflowToMarkdown(w) : "";
    }
    return "";
  }, [exportTarget, activeWorkflows, workflows]);

  // ── Automate ──────────────────────────────────────────────────────────────

  const automateWorkflows = useMemo(() => {
    if (selectedIds.size > 0) return activeWorkflows.filter((w) => selectedIds.has(w.id));
    if (selectedId) return activeWorkflows.filter((w) => w.id === selectedId);
    return [];
  }, [selectedIds, selectedId, activeWorkflows]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!started) {
    return (
      <Landing
        mode="fullscreen"
        onMap={handleMap}
        onSkip={() => setStarted(true)}
      />
    );
  }

  return (
    <div
      className="size-full min-h-screen flex flex-col"
      style={{ background: "#F7FAF2", fontFamily: "var(--font-dm-sans), sans-serif" }}
    >
      <TopBar
        view={view}
        onView={setView}
        onExport={() => setExportTarget("all")}
        onNew={() => setNewOpen(true)}
        onAutomate={() => setAutomateOpen(true)}
        automateCount={automateWorkflows.length}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          canvases={canvases}
          activeCanvasId={activeCanvasId}
          workflows={workflows}
          selectedId={selectedId}
          focusedChainKey={focusedChainKey}
          sharedWorkflowIds={sharedWorkflowIds}
          onSwitchCanvas={handleSwitchCanvas}
          onRenameCanvas={handleRenameCanvas}
          onCreateCanvas={handleCreateCanvas}
          onSelectWorkflow={handleSelectFromSidebar}
          onFocusChain={handleFocusChain}
        />

        <div className="relative flex-1 flex overflow-hidden">
          <div className="flex-1 relative overflow-hidden">
            {view === "canvas" ? (
              <Canvas
                workflows={activeWorkflows}
                canvas={activeCanvas ?? { id: "", name: "", workflowIds: [], connections: [], chainNames: {} }}
                selectedId={selectedId}
                selectedIds={selectedIds}
                connectMode={connectMode}
                focusedChainKey={focusedChainKey}
                sharedWorkflowIds={sharedWorkflowIds}
                onSelect={(id) => {
                  setSelectedId(id);
                  setSelectedIds(new Set());
                  setFocusedChainKey(null);
                }}
                onMultiSelect={handleMultiSelect}
                onCreateConnection={handleCreateConnection}
                onDeleteConnection={handleDeleteConnection}
                onCancelConnect={() => setConnectMode(null)}
                onUpdateChainName={handleUpdateChainName}
                focusId={focusId}
              />
            ) : (
              <LibraryView
                workflows={activeWorkflows}
                onOpen={handleOpenFromLibrary}
                onDelete={handleDelete}
              />
            )}
          </div>

          <DetailPanel
            workflow={selected}
            incomingWorkflows={incomingWorkflows}
            readOnly={activeReadOnly}
            onClose={() => setSelectedId(null)}
            onExport={(id) => setExportTarget({ id })}
            onChain={handleStartChain}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        </div>
      </div>

      {newOpen && (
        <Landing
          mode="modal"
          onMap={handleMap}
          onCancel={() => setNewOpen(false)}
        />
      )}

      <ExportModal
        open={exportTarget !== null}
        title={exportTitle}
        markdown={exportMarkdown}
        onClose={() => setExportTarget(null)}
      />

      <AutomateModal
        open={automateOpen}
        workflows={automateWorkflows}
        connections={activeCanvas?.connections ?? []}
        onClose={() => setAutomateOpen(false)}
      />
    </div>
  );
}
