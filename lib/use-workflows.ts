"use client";

import { useState, useEffect } from "react";
import {
  initialWorkflows,
  myWorkflowsCanvas,
  libraryCanvas,
  LIBRARY_CANVAS_ID,
  DEFAULT_CANVAS_ID,
  type Workflow,
  type Canvas,
} from "./workflows";
import {
  storage,
  storageBackend,
  readWorkflowsSync,
  readCanvasesSync,
  readActiveCanvasIdSync,
} from "./db";
import { useAuth } from "./auth-context";

// Migration of pre-trigger workflow shapes left over from earlier seeds.
// Stays here (not in the storage layer) because it's about evolving the
// canonical Workflow shape, not about where the bytes live.
function migrateWorkflows(wfs: Workflow[]): Workflow[] {
  return wfs.map((w) => {
    const leg = w as Record<string, unknown>;
    const out: Record<string, unknown> = { ...leg };
    // tasks → steps
    if (leg.tasks && !leg.steps) { out.steps = leg.tasks; delete out.tasks; }
    // strip removed fields
    delete out.owner;
    delete out.frequency;
    delete out.when;
    // add trigger if missing
    if (!("trigger" in out)) out.trigger = null;
    return out as Workflow;
  });
}

// Seed workflows are reconstructed client-side; we never persist them to
// the user's row in Supabase since they're not user data. The Library
// canvas keeps referencing them by id and the merge below puts them back
// into the live array for rendering.
const SEED_WORKFLOW_IDS = new Set(initialWorkflows.map((w) => w.id));

function mergeWithSeedWorkflows(wfs: Workflow[]): Workflow[] {
  const base = wfs.length > 0 ? migrateWorkflows(wfs) : [];
  const have = new Set(base.map((w) => w.id));
  const missing = initialWorkflows.filter((w) => !have.has(w.id));
  return missing.length > 0 ? [...base, ...missing] : base;
}

// Rename pre-existing default canvases that still carry the legacy
// "My Business" label so users land on "My Workflows" after the
// rename. Custom names users have set are left untouched.
function migrateDefaultCanvasName(c: Canvas): Canvas {
  if (c.id === DEFAULT_CANVAS_ID && c.name === "My Business") {
    return { ...c, name: "My Workflows" };
  }
  return c;
}

function withLibraryCanvas(userCanvases: Canvas[]): Canvas[] {
  // The Library canvas is shipped as part of the app and always reflects
  // the latest seed; replace any stored copy with the current export so
  // updates to the seed data ship to existing users on next load.
  const out = userCanvases
    .filter((c) => c.id !== LIBRARY_CANVAS_ID)
    .map(migrateDefaultCanvasName);
  out.push({ ...libraryCanvas });
  return out;
}

function initWorkflowsLocal(): Workflow[] {
  return mergeWithSeedWorkflows(readWorkflowsSync());
}

function initCanvasesLocal(): Canvas[] {
  const stored = readCanvasesSync();
  if (stored.length === 0) {
    return [{ ...myWorkflowsCanvas }, { ...libraryCanvas }];
  }
  return withLibraryCanvas(stored);
}

export function useWorkflows() {
  const { user, hydrated: authHydrated } = useAuth();

  // Sync hydration from the local cache for instant render. Whether the
  // active backend is `local` or `supabase`, the cache holds the most
  // recent view this device has seen, so the canvas paints immediately
  // and revalidation overwrites any stale data once Supabase resolves.
  const [workflows, setWorkflows] = useState<Workflow[]>(() => initWorkflowsLocal());
  const [canvases, setCanvases] = useState<Canvas[]>(() => initCanvasesLocal());
  const [activeCanvasId, setActiveCanvasId] = useState<string>(() => {
    const cvs = initCanvasesLocal();
    const stored = readActiveCanvasIdSync() ?? "";
    if (cvs.find((c) => c.id === stored)) return stored;
    // Default to the user's editable canvas, not the Library
    const editable = cvs.find((c) => !c.readOnly);
    return editable?.id ?? cvs[0]?.id ?? DEFAULT_CANVAS_ID;
  });

  // `revalidated` gates the persistence effects so the Supabase backend
  // doesn't stomp on remote data with stale local cache before it's had
  // a chance to fetch the source of truth. For the local backend it's
  // true from the start so behaviour is unchanged.
  const [revalidated, setRevalidated] = useState(storageBackend === "local");

  // Revalidation + first-load migration. Runs once auth state has settled
  // on the Supabase backend; for the local backend it's a no-op.
  useEffect(() => {
    if (storageBackend === "local") return;
    if (!authHydrated) return;
    if (!user) {
      // Signed-out user. Render the cached/seeded view; persistence stays
      // disabled because writes would fail authz anyway.
      setRevalidated(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const [supaWfs, supaCanvases] = await Promise.all([
          storage.loadWorkflows(),
          storage.loadCanvases(),
        ]);

        if (supaWfs.length === 0 && supaCanvases.length === 0) {
          // First-time Supabase user. If they have existing localStorage
          // data from before the migration, ship it up so they don't
          // start from scratch.
          const localWfs = readWorkflowsSync();
          const localCanvases = readCanvasesSync();
          const userWfs = localWfs.filter((w) => !SEED_WORKFLOW_IDS.has(w.id));
          const userCanvases = localCanvases.filter((c) => !c.readOnly);

          if (userWfs.length > 0 || userCanvases.length > 0) {
            console.info(
              `[magicus] migrating ${userWfs.length} workflows + ${userCanvases.length} canvases to Supabase`
            );
            await Promise.all([
              storage.saveWorkflows(userWfs),
              storage.saveCanvases(userCanvases),
            ]);
            if (cancelled) return;
            setWorkflows(mergeWithSeedWorkflows(userWfs));
            setCanvases(withLibraryCanvas(userCanvases));
          } else {
            // Truly fresh user — give them the default empty My Workflows
            // canvas alongside the Library.
            if (cancelled) return;
            setWorkflows(mergeWithSeedWorkflows([]));
            setCanvases([{ ...myWorkflowsCanvas }, { ...libraryCanvas }]);
          }
        } else {
          if (cancelled) return;
          setWorkflows(mergeWithSeedWorkflows(supaWfs));
          setCanvases(withLibraryCanvas(supaCanvases));
        }
      } catch (err) {
        console.error("[magicus] revalidation failed; using cached data", err);
      } finally {
        if (!cancelled) setRevalidated(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user, authHydrated]);

  // Persist on change. Gated on `revalidated` so we don't stomp Supabase
  // with stale cache, and (for Supabase) on `user` so signed-out writes
  // don't error in the storage layer's authz check.
  useEffect(() => {
    if (!revalidated) return;
    if (storageBackend === "supabase" && !user) return;
    if (storageBackend === "supabase") {
      // Strip seeds — those are reconstructed client-side and not user data.
      const userWfs = workflows.filter((w) => !SEED_WORKFLOW_IDS.has(w.id));
      void storage.saveWorkflows(userWfs);
    } else {
      void storage.saveWorkflows(workflows);
    }
  }, [workflows, revalidated, user]);

  useEffect(() => {
    if (!revalidated) return;
    if (storageBackend === "supabase" && !user) return;
    // Examples canvas is filtered out by the storage impl (read_only).
    void storage.saveCanvases(canvases);
  }, [canvases, revalidated, user]);

  useEffect(() => {
    if (!revalidated) return;
    void storage.saveActiveCanvasId(activeCanvasId);
  }, [activeCanvasId, revalidated]);

  const activeCanvas = canvases.find((c) => c.id === activeCanvasId) ?? canvases[0];

  return { workflows, setWorkflows, canvases, setCanvases, activeCanvasId, setActiveCanvasId, activeCanvas };
}
