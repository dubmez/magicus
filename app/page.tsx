"use client";

import { useMemo, useState } from "react";
import { Canvas } from "./components/canvas";
import { TopBar, type View } from "./components/top-bar";
import { Sidebar } from "./components/sidebar";
import { DetailPanel } from "./components/detail-panel";
import { ExportModal } from "./components/export-modal";
import { AutomateModal } from "./components/automate-modal";
import { LibraryView } from "./components/library-view";
import { Landing } from "./components/landing";
import { type Workflow, type Theme } from "@/lib/workflows";
import { useWorkflows } from "@/lib/use-workflows";
import { workflowToMarkdown, allWorkflowsToMarkdown } from "@/lib/markdown";

function inferTheme(text: string): Theme {
  const t = text.toLowerCase();
  if (/(invoice|payment|finance|tax|expense|budget)/.test(t)) return "finance";
  if (/(content|newsletter|campaign|seo|brand|social|marketing)/.test(t)) return "marketing";
  if (/(vendor|onboard|ops|operations|inventory|fulfil|fulfill)/.test(t)) return "operations";
  return "sales";
}

function generateWorkflow(id: string, description: string, clarification?: string): Workflow {
  const theme = inferTheme(description + " " + (clarification ?? ""));
  const firstSentence = description.split(/[.!?]/)[0].trim();
  const name =
    firstSentence.length > 0 && firstSentence.length < 60
      ? firstSentence.replace(/^./, (c) => c.toUpperCase())
      : "New workflow";

  const ownerMatch = clarification?.match(/own(?:ed|er)[^,]*by\s+([A-Za-z ]+)/i);
  const toolMatch = clarification?.match(/(?:use[s]?|with|via|tools?)[\s:]+([A-Za-z0-9, +&]+)/i);
  const tools = toolMatch
    ? toolMatch[1].split(/[,+&]/).map((t) => t.trim()).filter(Boolean).slice(0, 4)
    : ["Notion", "Slack"];
  const owner = ownerMatch ? ownerMatch[1].trim() : "Unassigned";

  return {
    id,
    theme,
    name,
    owner,
    frequency: "Per event",
    why: description.trim() || "Recently captured workflow — review and refine the details.",
    when: "Triggered manually for now. Define an automatic trigger when ready.",
    inputs: [
      { name: "Trigger event", source: "Manual" },
      { name: "Reference docs", source: "Notion" },
    ],
    tasks: [
      { n: 1, text: "Receive request" },
      { n: 2, text: "Process & verify", note: "Flag exceptions for human review" },
      { n: 3, text: "Complete & log" },
    ],
    outputs: [
      { name: "Completed record", source: tools[0] ?? "Notion" },
      { name: "Notification", source: "Slack" },
    ],
    tools,
    automationScore: 65,
    automationRationale:
      "Initial estimate — refine after you map the steps and tools more precisely.",
    x: 0,
    y: 0,
  };
}

export default function Home() {
  const { workflows, setWorkflows, connections, setConnections } = useWorkflows();
  const [started, setStarted] = useState(false);
  const [view, setView] = useState<View>("canvas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [themeFilter, setThemeFilter] = useState<Theme | null>(null);
  const [connectMode, setConnectMode] = useState<{ fromId: string } | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<"all" | { id: string } | null>(null);
  const [automateOpen, setAutomateOpen] = useState(false);

  const selected = useMemo(
    () => workflows.find((w) => w.id === selectedId) ?? null,
    [workflows, selectedId]
  );

  const handleSelectFromSidebar = (id: string) => {
    setSelectedId(id);
    setSelectedIds(new Set());
    if (view === "canvas") setFocusId(id + ":" + Date.now());
  };

  const handleMultiSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setSelectedId(null);
  };

  const handleOpenFromLibrary = (id: string) => {
    setSelectedId(id);
    setView("canvas");
    setFocusId(id + ":" + Date.now());
  };

  const handleMap = (description: string, clarification?: string) => {
    const id = `wf-${Date.now()}`;
    const newWf = generateWorkflow(id, description, clarification);
    const maxX = workflows.length > 0 ? Math.max(...workflows.map((w) => w.x)) : 0;
    newWf.x = maxX + 800;
    newWf.y = 400;
    setWorkflows((prev) => [...prev, newWf]);
    setSelectedId(id);
    setView("canvas");
    setFocusId(id + ":" + Date.now());
    setNewOpen(false);
    setStarted(true);
  };

  const handleDelete = (id: string) => {
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    setConnections((prev) => prev.filter((c) => c.from !== id && c.to !== id));
    if (selectedId === id) setSelectedId(null);
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    if (connectMode?.fromId === id) setConnectMode(null);
  };

  const handleStartChain = (fromId: string) => {
    setConnectMode({ fromId });
    setSelectedId(null);
    setView("canvas");
  };

  const handleCreateConnection = (fromId: string, toId: string) => {
    const exists = connections.some((c) => c.from === fromId && c.to === toId);
    if (!exists) {
      setConnections((prev) => [...prev, { from: fromId, to: toId, label: "Triggers" }]);
    }
    setConnectMode(null);
    setSelectedId(toId);
  };

  const handleDeleteConnection = (fromId: string, toId: string) => {
    setConnections((prev) => prev.filter((c) => !(c.from === fromId && c.to === toId)));
  };

  const automateWorkflows = useMemo(() => {
    if (selectedIds.size > 0) return workflows.filter((w) => selectedIds.has(w.id));
    if (selectedId) return workflows.filter((w) => w.id === selectedId);
    return [];
  }, [selectedIds, selectedId, workflows]);

  const exportTitle =
    exportTarget === "all"
      ? "Export · all workflows"
      : exportTarget && "id" in exportTarget
      ? `Export · ${workflows.find((w) => w.id === exportTarget.id)?.name ?? "workflow"}`
      : "";

  const exportMarkdown = useMemo(() => {
    if (exportTarget === "all") return allWorkflowsToMarkdown(workflows);
    if (exportTarget && "id" in exportTarget) {
      const w = workflows.find((x) => x.id === exportTarget.id);
      return w ? workflowToMarkdown(w) : "";
    }
    return "";
  }, [exportTarget, workflows]);

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
          workflows={workflows}
          selectedId={selectedId}
          themeFilter={themeFilter}
          onSelect={handleSelectFromSidebar}
          onThemeFilter={setThemeFilter}
        />

        <div className="relative flex-1 flex overflow-hidden">
          <div className="flex-1 relative overflow-hidden">
            {view === "canvas" ? (
              <Canvas
                workflows={workflows}
                connections={connections}
                selectedId={selectedId}
                selectedIds={selectedIds}
                themeFilter={themeFilter}
                connectMode={connectMode}
                onSelect={(id) => { setSelectedId(id); setSelectedIds(new Set()); }}
                onMultiSelect={handleMultiSelect}
                onCreateConnection={handleCreateConnection}
                onDeleteConnection={handleDeleteConnection}
                onCancelConnect={() => setConnectMode(null)}
                focusId={focusId}
              />
            ) : (
              <LibraryView
                workflows={workflows}
                themeFilter={themeFilter}
                onOpen={handleOpenFromLibrary}
                onDelete={handleDelete}
              />
            )}
          </div>

          <DetailPanel
            workflow={selected}
            onClose={() => setSelectedId(null)}
            onExport={(id) => setExportTarget({ id })}
            onChain={handleStartChain}
            onDelete={handleDelete}
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
        connections={connections}
        onClose={() => setAutomateOpen(false)}
      />
    </div>
  );
}
