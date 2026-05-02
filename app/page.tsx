"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Canvas } from "./components/canvas";
import { TopBar } from "./components/top-bar";
import { Sidebar } from "./components/sidebar";
import { DetailPanel } from "./components/detail-panel";
import { ExportModal } from "./components/export-modal";
import { AutomateModal } from "./components/automate-modal";
import { Landing } from "./components/landing";
import { LandingHero } from "./components/landing-hero";
import { type Workflow, type Canvas as CanvasType, type Connection, EXAMPLES_CANVAS_ID } from "@/lib/workflows";
import { useWorkflows } from "@/lib/use-workflows";
import { workflowToMarkdown, allWorkflowsToMarkdown } from "@/lib/markdown";
import { useAuth, useRequireAuth } from "@/lib/auth-context";

type GeneratedWorkflow = Omit<Workflow, "x" | "y">;
type GeneratedResponse = {
  workflows: GeneratedWorkflow[];
  connections: { from: string; to: string; label?: string }[];
};

async function generateFromAPI(description: string): Promise<GeneratedResponse> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) throw new Error(`generate failed: ${res.status}`);
  const data = (await res.json()) as GeneratedResponse;
  if (!data?.workflows || data.workflows.length === 0) {
    throw new Error("generate returned no workflows");
  }
  return data;
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
  const { user, hydrated } = useAuth();
  const guard = useRequireAuth();

  // After a sign-out, drop the user back to the landing hero. They likely
  // intended to leave the workspace, not stare at someone else's canvas.
  useEffect(() => {
    if (hydrated && !user) setStarted(false);
  }, [hydrated, user]);

  const [started, setStarted] = useState(false);
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
  };

  const handleRenameCanvas = (id: string, name: string) => {
    guard(() => updateCanvas(id, { name }));
  };

  const handleCreateCanvas = (name: string) => {
    guard(() => {
      const id = `canvas-${Date.now()}`;
      setCanvases((prev) => [
        ...prev,
        { id, name, workflowIds: [], connections: [], chainNames: {} },
      ]);
      setActiveCanvasId(id);
      setSelectedId(null);
      setSelectedIds(new Set());
      setFocusedChainKey(null);
    });
  };

  const handleSelectFromSidebar = (id: string) => {
    setSelectedId(id);
    setSelectedIds(new Set());
    setFocusedChainKey(null);
    setFocusId(id + ":" + Date.now());
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

    // Throws on failure — Landing catches it and shows an inline error.
    // We deliberately do NOT place a fallback card on failure; that hides bugs.
    const generated = await generateFromAPI(description);
    const now = Date.now();

    // Map LLM-local ids → real ids
    const idMap = new Map<string, string>();
    generated.workflows.forEach((w, i) => {
      idMap.set(w.id, `wf-${now}-${i}`);
    });
    const newWorkflows: Workflow[] = generated.workflows.map((w, i) => ({
      ...w,
      id: idMap.get(w.id)!,
      x: baseX + i * 800,
      y: baseY + (i % 2 === 0 ? 0 : 120),
    }));
    const newConnections: Connection[] = generated.connections.flatMap<Connection>((c) => {
      const from = idMap.get(c.from);
      const to = idMap.get(c.to);
      if (!from || !to) return [];
      return [{ from, to, label: c.label }];
    });
    const firstId = newWorkflows[0].id;

    setWorkflows((prev) => [...prev, ...newWorkflows]);
    updateCanvas(targetCanvas.id, {
      workflowIds: [...targetCanvas.workflowIds, ...newWorkflows.map((w) => w.id)],
      connections: [...targetCanvas.connections, ...newConnections],
    });
    setSelectedId(firstId);
    setSelectedIds(new Set());
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
    guard(() => {
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
    });
  };

  // ── Connection handlers ───────────────────────────────────────────────────

  const handleStartChain = (fromId: string) => {
    if (activeReadOnly) return;
    guard(() => {
      setConnectMode({ fromId });
      setSelectedId(null);
    });
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
          { from: fromId, to: toId },
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
    guard(() => {
      updateActiveCanvas({
        chainNames: { ...activeCanvas.chainNames, [key]: name },
      });
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

  // Avoid flashing the landing for already-signed-in users while we hydrate
  // from localStorage on first paint.
  if (!hydrated) return null;

  if (!user && !started) {
    return (
      <LandingHero
        // The hero submits straight into handleMap. handleMap awaits the API
        // and flips `started` so the page transitions to the canvas with the
        // generated workflow already selected.
        onMap={handleMap}
        onBrowseExamples={() => {
          setActiveCanvasId(EXAMPLES_CANVAS_ID);
          setStarted(true);
        }}
      />
    );
  }

  return (
    <div
      className="size-full min-h-screen flex flex-col"
      style={{ background: "#F7FAF2", fontFamily: "var(--font-dm-sans), sans-serif" }}
    >
      <TopBar
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
