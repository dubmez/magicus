"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Canvas } from "./components/canvas";
import { TopBar } from "./components/top-bar";
import { Sidebar } from "./components/sidebar";
import { DetailPanel } from "./components/detail-panel";
import { ExportModal } from "./components/export-modal";
import { AutomateModal } from "./components/automate-modal";
import { ShareModal } from "./components/share-modal";
import { DeleteCanvasModal } from "./components/delete-canvas-modal";
import { Landing } from "./components/landing";
import { LandingHero } from "./components/landing-hero";
import { RecordingFlow, type RecordedWorkflow } from "./components/recording-flow";
import {
  type Workflow,
  type Canvas as CanvasType,
  type Connection,
  LIBRARY_CANVAS_ID,
  DEFAULT_CANVAS_ID,
  myWorkflowsCanvas,
  computeChains,
} from "@/lib/workflows";
import { useWorkflows } from "@/lib/use-workflows";
import { workflowToMarkdown, allWorkflowsToMarkdown } from "@/lib/markdown";
import { useAuth, useRequireAuth } from "@/lib/auth-context";

type GeneratedWorkflow = Omit<Workflow, "x" | "y">;
type GeneratedResponse = {
  workflows: GeneratedWorkflow[];
  connections: { from: string; to: string; label?: string }[];
};

async function generateFromAPI(
  description: string,
  transcript?: string
): Promise<GeneratedResponse> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description, transcript }),
  });
  if (!res.ok) throw new Error(`generate failed: ${res.status}`);
  const data = (await res.json()) as GeneratedResponse;
  if (!data?.workflows || data.workflows.length === 0) {
    throw new Error("generate returned no workflows");
  }
  return data;
}

// `useSearchParams` requires a Suspense boundary at the page level under
// Next 16's static generation; the inner component holds all the auth +
// canvas state and the wrapper just provides the boundary.
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}

function Home() {
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
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── URL-driven mode ────────────────────────────────────────────────────
  // ?welcome=1 forces the landing hero to render even for signed-in
  // users — useful for marketing links and for testing the hero on
  // mobile without an incognito window.
  const welcomeParam = searchParams?.get("welcome") === "1";
  // ?library=1 takes the user straight to the Library. Set when
  // "browse the workflow library" is clicked so the browser back
  // button returns to the landing rather than getting stuck. We
  // also accept the legacy ?examples=1 param so any links shared
  // before the rename still work.
  const libraryParam =
    searchParams?.get("library") === "1" ||
    searchParams?.get("examples") === "1";

  const [started, setStarted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusedChainKey, setFocusedChainKey] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState<{ fromId: string } | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<"all" | { id: string } | null>(null);
  const [automateOpen, setAutomateOpen] = useState(false);
  const [recordingOpen, setRecordingOpen] = useState(false);
  const [shareTargetId, setShareTargetId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Canvas-deletion state. `deleteCanvasId` opens the confirmation
  // modal for that canvas; the actual removal runs only on confirm.
  const [deleteCanvasId, setDeleteCanvasId] = useState<string | null>(null);

  // After a sign-out, drop the user back to the landing hero. They likely
  // intended to leave the workspace, not stare at someone else's canvas.
  useEffect(() => {
    if (hydrated && !user) setStarted(false);
  }, [hydrated, user]);

  // Sync `started` with the URL. ?welcome=1 always wins (force hero);
  // ?library=1 forces the Library canvas. When the user backs out of
  // `?library=1` to a clean URL, this effect resets started so an
  // unauthed visitor sees the hero again.
  useEffect(() => {
    if (welcomeParam) {
      setStarted(false);
      return;
    }
    if (libraryParam) {
      setActiveCanvasId(LIBRARY_CANVAS_ID);
      setStarted(true);
      return;
    }
    if (!user) setStarted(false);
  }, [welcomeParam, libraryParam, user, setActiveCanvasId]);

  // Auto-dismiss the success toast after 3s.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Pending input handoff — when an unauthed user types a description and
  // hits "Map it", the auth gate redirects via Google OAuth which unloads
  // the page. The PromptBox saves the typed text to sessionStorage just
  // before the gate opens; once we're back with a hydrated session, we
  // open the New Workflow modal which rehydrates the text from
  // sessionStorage and auto-submits straight into the conversational
  // path picker.
  //
  // Same pattern for the Explainer entry point: clicking "Share what
  // you've built" while unauthed sets `magicus_pending_explainer`. We
  // consume it here and bounce to /explainer/new.
  useEffect(() => {
    if (!hydrated || !user) return;
    let pendingExplainer = false;
    let pendingInput: string | null = null;
    try {
      pendingExplainer =
        sessionStorage.getItem("magicus_pending_explainer") === "1";
      pendingInput = sessionStorage.getItem("magicus_pending_input");
    } catch { /* ignore */ }
    if (pendingExplainer) {
      try { sessionStorage.removeItem("magicus_pending_explainer"); } catch { /* ignore */ }
      router.push("/explainer/new");
      return;
    }
    if (!pendingInput || pendingInput.trim().length === 0) return;
    setNewOpen(true);
    // Run once on first hydrate-with-user; subsequent state changes
    // shouldn't re-trigger the replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, user]);

  // Surface OAuth callback failures. /auth/callback redirects here with
  // ?auth_error=... when code exchange fails (PKCE mismatch, network
  // blip, expired code). Without this, the user just lands back on the
  // landing hero with no indication anything went wrong.
  useEffect(() => {
    const err = searchParams?.get("auth_error");
    if (!err) return;
    setToast("Sign-in didn't complete. Please try again.");
    router.replace("/", { scroll: false });
  }, [searchParams, router]);

  // Remix handoff — when a user clicks 'Remix this workflow' on a /w/[token]
  // page, that page writes the cloned workflow to localStorage and navigates
  // here. We pick it up on mount, drop it onto the active canvas, select it,
  // and surface a toast.
  useEffect(() => {
    if (!hydrated || !user) return;
    let pending: Workflow | null = null;
    try {
      const raw = localStorage.getItem("magicus:pending-remix");
      if (raw) pending = JSON.parse(raw) as Workflow;
    } catch { /* ignore */ }
    if (!pending) return;
    try { localStorage.removeItem("magicus:pending-remix"); } catch { /* ignore */ }

    let targetCanvas = activeCanvas;
    if (!targetCanvas || targetCanvas.readOnly) {
      targetCanvas = canvases.find((c) => !c.readOnly) ?? targetCanvas;
      if (targetCanvas) setActiveCanvasId(targetCanvas.id);
    }
    if (!targetCanvas) return;

    const targetWfs = workflows.filter((w) => targetCanvas!.workflowIds.includes(w.id));
    const baseX = targetWfs.length > 0 ? Math.max(...targetWfs.map((w) => w.x)) + 800 : 0;
    const positioned: Workflow = { ...pending, x: baseX, y: 400 };

    setWorkflows((prev) => [...prev, positioned]);
    updateCanvas(targetCanvas.id, {
      workflowIds: [...targetCanvas.workflowIds, positioned.id],
    });
    setSelectedId(positioned.id);
    setSelectedIds(new Set());
    setFocusId(positioned.id + ":" + Date.now());
    setStarted(true);
    setToast("Workflow added to your canvas");
    // Intentionally narrow deps — only run when the user finishes hydrating.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, user]);

  const activeReadOnly = !!activeCanvas?.readOnly;

  // Workflows visible on the active canvas
  const activeWorkflows = useMemo(
    () => workflows.filter((w) => activeCanvas?.workflowIds.includes(w.id)),
    [workflows, activeCanvas]
  );

  // Seeded library templates — handed to the conversational capture
  // flow so path 1 can pick a recommendation by category.
  const libraryWorkflows = useMemo(
    () => workflows.filter((w) => w.isSeeded),
    [workflows]
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

  // Open the delete-canvas confirmation. Library can never be deleted —
  // the sidebar already hides the overflow there, but defence in depth.
  // If the user has only one editable canvas, we can't delete it without
  // leaving them stranded — surface a toast nudge instead.
  const handleRequestDeleteCanvas = (id: string) => {
    if (id === LIBRARY_CANVAS_ID) return;
    const userCanvasCount = canvases.filter(
      (c) => !c.readOnly && c.id !== LIBRARY_CANVAS_ID
    ).length;
    if (userCanvasCount <= 1) {
      setToast("You need at least one canvas — rename it instead.");
      return;
    }
    setDeleteCanvasId(id);
  };

  // Actually remove the canvas (and the workflows it owned) once the user
  // confirms in the modal. Workflows that live on other canvases as well
  // are preserved; only ones unique to this canvas are removed.
  const handleConfirmDeleteCanvas = () => {
    if (!deleteCanvasId) return;
    const target = canvases.find((c) => c.id === deleteCanvasId);
    if (!target) {
      setDeleteCanvasId(null);
      return;
    }

    const otherCanvases = canvases.filter((c) => c.id !== deleteCanvasId);
    const idsKeptElsewhere = new Set(
      otherCanvases.flatMap((c) => c.workflowIds)
    );
    const idsToRemove = target.workflowIds.filter(
      (id) => !idsKeptElsewhere.has(id)
    );

    setWorkflows((prev) => prev.filter((w) => !idsToRemove.includes(w.id)));
    setCanvases(otherCanvases);

    // Switch to the next available editable canvas; fall back to the
    // Library if the user's last user-canvas is gone (shouldn't happen
    // due to the guard in handleRequestDeleteCanvas, but defensive).
    const nextEditable = otherCanvases.find(
      (c) => !c.readOnly && c.id !== LIBRARY_CANVAS_ID
    );
    setActiveCanvasId(nextEditable?.id ?? otherCanvases[0]?.id ?? DEFAULT_CANVAS_ID);
    setSelectedId(null);
    setSelectedIds(new Set());
    setFocusedChainKey(null);
    setDeleteCanvasId(null);
    setToast(`"${target.name}" deleted`);
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

  // Adds a structured workflow object directly to the active canvas — used by
  // the recording flow which already has a workflow object from Gemini and
  // skips the description → API roundtrip.
  const addRecordedWorkflow = useCallback(
    (rec: RecordedWorkflow) => {
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
      const now = Date.now();
      const id = `wf-${now}`;
      const wf: Workflow = {
        id,
        theme: rec.theme,
        name: rec.name,
        trigger: rec.trigger,
        why: rec.why,
        inputs: rec.inputs,
        steps: rec.steps,
        outputs: rec.outputs,
        tools: rec.tools,
        automationScore: rec.automationScore,
        automationRationale: rec.automationRationale,
        x: baseX,
        y: baseY,
      };

      setWorkflows((prev) => [...prev, wf]);
      updateCanvas(targetCanvas.id, {
        workflowIds: [...targetCanvas.workflowIds, id],
      });
      setSelectedId(id);
      setSelectedIds(new Set());
      setFocusId(id + ":" + now);
      setStarted(true);
      setRecordingOpen(false);
      setNewOpen(false);
      setToast("Workflow mapped from your recording");
    },
    [activeCanvas, canvases, workflows, setWorkflows, setCanvases, setActiveCanvasId, updateCanvas]
  );

  // "Adapt this" — clone a Library workflow (or the full chain it
  // belongs to) into the user's editable canvas. Auth-gated; if no
  // editable canvas exists we create "My Workflows" on the fly.
  // Library fields strip off the clone and `adaptedFrom` provenance
  // is written so the detail panel can render the credit row.
  const handleAdapt = useCallback((libraryWorkflowId: string) => {
    guard(() => {
      const library = canvases.find((c) => c.id === LIBRARY_CANVAS_ID);
      if (!library) return;
      const sourceWorkflow = workflows.find((w) => w.id === libraryWorkflowId);
      if (!sourceWorkflow) return;

      // Resolve the chain this workflow belongs to. computeChains returns
      // connected components on the Library canvas; a single-workflow
      // entry comes back as a length-1 array.
      const chains = computeChains(library.workflowIds, library.connections);
      const chainIds =
        chains.find((c) => c.includes(libraryWorkflowId)) ?? [libraryWorkflowId];
      const chainWorkflows = chainIds
        .map((id) => workflows.find((w) => w.id === id))
        .filter(Boolean) as Workflow[];
      if (chainWorkflows.length === 0) return;

      // Resolve the destination canvas. Prefer the user's currently-
      // active editable canvas; otherwise the first editable one;
      // otherwise create "My Workflows" on the fly so a brand-new user
      // adapting a workflow ends up with a sensible default canvas.
      let target = activeCanvas && !activeCanvas.readOnly && activeCanvas.id !== LIBRARY_CANVAS_ID
        ? activeCanvas
        : canvases.find((c) => !c.readOnly && c.id !== LIBRARY_CANVAS_ID);
      if (!target) {
        target = { ...myWorkflowsCanvas };
        setCanvases((prev) => [...prev, target!]);
      }
      const targetId = target.id;
      if (targetId !== activeCanvasId) setActiveCanvasId(targetId);

      // Layout: place the cloned chain to the right of any existing
      // content on the target canvas, in a single horizontal row.
      const targetWfs = workflows.filter((w) =>
        target!.workflowIds.includes(w.id)
      );
      const baseX = targetWfs.length > 0
        ? Math.max(...targetWfs.map((w) => w.x)) + 800
        : 0;
      const baseY = 400;
      const now = Date.now();

      // Re-id every workflow in the chain and record the mapping so we
      // can re-wire connections to the new ids without breaking links.
      const idMap = new Map<string, string>();
      chainWorkflows.forEach((w, i) => {
        idMap.set(w.id, `wf-${now}-${i}`);
      });
      const cloned: Workflow[] = chainWorkflows.map((w, i) => ({
        ...w,
        id: idMap.get(w.id)!,
        x: baseX + i * 800,
        y: baseY,
        // Strip Library-specific fields — the cloned workflow is a
        // user workflow now, fully editable.
        libraryId: undefined,
        category: undefined,
        contributedBy: undefined,
        adaptCount: undefined,
        isSeeded: undefined,
        // Record provenance so the detail panel can show
        // "Adapted from {Name} · Library".
        adaptedFrom: {
          libraryId: w.libraryId ?? w.id,
          name: w.name,
          contributedBy: w.contributedBy,
        },
      }));

      // Re-wire the chain's internal connections with the new ids.
      // Connections crossing chain boundaries are filtered out (none
      // exist in the seeded library, but defensive).
      const newConnections: Connection[] = library.connections
        .filter((c) => idMap.has(c.from) && idMap.has(c.to))
        .map((c) => ({
          from: idMap.get(c.from)!,
          to: idMap.get(c.to)!,
          label: c.label,
        }));

      setWorkflows((prev) => [...prev, ...cloned]);
      updateCanvas(targetId, {
        workflowIds: [...target!.workflowIds, ...cloned.map((w) => w.id)],
        connections: [...target!.connections, ...newConnections],
      });
      const firstId = cloned[0].id;
      setSelectedId(firstId);
      setSelectedIds(new Set());
      setFocusId(firstId + ":" + now);
      setStarted(true);
      setToast(
        cloned.length > 1
          ? "Chain added to My Workflows — it's yours to edit."
          : "Workflow added to My Workflows — it's yours to edit."
      );
    });
  }, [activeCanvas, activeCanvasId, canvases, workflows, guard, setActiveCanvasId, setCanvases, setWorkflows, updateCanvas]);

  const handleMap = async (description: string, transcript?: string) => {
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
    const generated = await generateFromAPI(description, transcript);
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

  // Recording flow takes over the entire viewport when active — its own
  // chrome (header, prep/record/review/processing screens) replaces the
  // canvas while it's running.
  if (recordingOpen) {
    return (
      <RecordingFlow
        onSuccess={(wf) => addRecordedWorkflow(wf)}
        onCancel={() => setRecordingOpen(false)}
      />
    );
  }

  // Show the landing when:
  //   - the user is unauthed and hasn't started yet, OR
  //   - ?welcome=1 is in the URL (escape hatch for signed-in users
  //     who want to see / share / test the marketing surface).
  const showLanding = welcomeParam || (!user && !started);
  if (showLanding) {
    return (
      <LandingHero
        // The hero submits straight into handleMap. handleMap awaits the API
        // and flips `started` so the page transitions to the canvas with the
        // generated workflow already selected.
        onMap={handleMap}
        onBrowseLibrary={() => {
          // Push a URL change so the browser back button returns to the
          // landing instead of being stuck on the canvas. The synced
          // useEffect above flips `started` and the active canvas.
          router.push("/?library=1");
        }}
        onRecord={() => setRecordingOpen(true)}
        // Signed-in user viewing the landing via ?welcome=1 — give them a
        // direct path back to their workspace.
        onGoToCanvas={user ? () => router.push("/") : undefined}
        onShareExplainer={() => {
          // Auth-gate the click. Unauthed users get the OAuth bounce;
          // the magicus_pending_explainer flag survives the redirect
          // and is consumed by the replay useEffect above, which then
          // routes here to /explainer/new.
          if (!user) {
            try { sessionStorage.setItem("magicus_pending_explainer", "1"); } catch { /* ignore */ }
          }
          guard(() => router.push("/explainer/new"));
        }}
        libraryWorkflows={libraryWorkflows}
        onAdaptLibrary={handleAdapt}
      />
    );
  }

  return (
    <div
      className="size-full min-h-screen flex flex-col"
      style={{ background: "#F7FAF2", fontFamily: "var(--font-dm-sans), sans-serif" }}
    >
      <TopBar
        onNew={() => setNewOpen(true)}
        onShareBuilt={() => router.push("/explainer/new")}
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
          onDeleteCanvas={handleRequestDeleteCanvas}
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
              onBrowseLibrary={() => setActiveCanvasId(LIBRARY_CANVAS_ID)}
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
            onAutomate={() => setAutomateOpen(true)}
            onShare={(id) => setShareTargetId(id)}
            onAdapt={handleAdapt}
          />
        </div>
      </div>

      {newOpen && (
        <Landing
          mode="modal"
          onMap={async (description, transcript) => {
            await handleMap(description, transcript);
            setNewOpen(false);
          }}
          onCancel={() => setNewOpen(false)}
          onRecord={() => {
            setNewOpen(false);
            setRecordingOpen(true);
          }}
          libraryWorkflows={libraryWorkflows}
          onAdaptLibrary={(libraryId) => {
            handleAdapt(libraryId);
            setNewOpen(false);
          }}
          onBrowseLibrary={() => {
            setNewOpen(false);
            setActiveCanvasId(LIBRARY_CANVAS_ID);
          }}
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

      <ShareModal
        open={!!shareTargetId}
        workflow={shareTargetId ? workflows.find((w) => w.id === shareTargetId) ?? null : null}
        onClose={() => setShareTargetId(null)}
      />

      {deleteCanvasId && (() => {
        const target = canvases.find((c) => c.id === deleteCanvasId);
        if (!target) return null;
        return (
          <DeleteCanvasModal
            canvasName={target.name}
            workflowCount={target.workflowIds.length}
            onConfirm={handleConfirmDeleteCanvas}
            onCancel={() => setDeleteCanvasId(null)}
          />
        );
      })()}

      {/* Success toast — auto-dismisses after 4s via the effect above. */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#547863",
            color: "#EBF4DD",
            padding: "10px 18px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 8px 32px rgba(59, 73, 83, 0.20)",
            zIndex: 200,
            fontFamily: "var(--font-dm-sans), sans-serif",
          }}
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
