import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Workflow, Canvas, ShareSettings } from "./types";

// Tests for the Supabase storage backend. We mock @/lib/supabase/client
// at the module level so the backend's calls hit a controllable fake
// rather than a real Supabase client. Real DB integration tests would
// run against a `supabase start` instance — those are out of scope here.
//
// Coverage focus is on the parts most likely to silently break:
//  - row → typed-object mapping (column name typos, snake_case vs camelCase)
//  - query construction (correct table/columns/filters)
//  - error and "not authenticated" paths
//
// We import the backend lazily inside `beforeEach` so each test gets a
// fresh module copy with the mock state we set up. (vitest's `vi.mock`
// doesn't reset between tests by default for non-fn mocks.)

// ─── Mock builder ────────────────────────────────────────────────────────

type Eq = [string, unknown];
type LastQuery = {
  table?: string;
  selectCols?: string;
  upsertRows?: unknown;
  upsertOptions?: unknown;
  deleteCalled?: boolean;
  inFilter?: [string, unknown];
  eqFilters: Eq[];
  rpcName?: string;
  rpcArgs?: unknown;
};

type FakeAuth = {
  user: { id: string } | null;
  // Fluent stubs let us chain .select().eq().eq() etc.
};

type RowResult = { data: unknown; error: unknown };

function makeMockSupabase(opts: {
  auth?: FakeAuth;
  // Per-table responses keyed by SELECT, used by `maybeSingle()` and as
  // the awaited result of the chain.
  selectResults?: Record<string, RowResult>;
  rpcResult?: RowResult;
}) {
  const last: LastQuery = { eqFilters: [] };

  const chain = (table: string) => {
    let resultKey = `${table}:select`;
    const builder: Record<string, unknown> = {};

    builder.select = (cols: string) => {
      last.table = table;
      last.selectCols = cols;
      resultKey = `${table}:select`;
      return builder;
    };
    builder.upsert = (rows: unknown, options?: unknown) => {
      last.table = table;
      last.upsertRows = rows;
      last.upsertOptions = options;
      // Return a thenable so `await client.from(...).upsert(...)` works.
      return Promise.resolve({ error: null });
    };
    builder.delete = () => {
      last.table = table;
      last.deleteCalled = true;
      return builder;
    };
    builder.eq = (col: string, val: unknown) => {
      last.eqFilters.push([col, val]);
      return builder;
    };
    builder.in = (col: string, vals: unknown) => {
      last.inFilter = [col, vals];
      // `delete().eq().in(...)` is awaited as a thenable.
      return Promise.resolve({ error: null });
    };
    builder.maybeSingle = async () => {
      return opts.selectResults?.[resultKey] ?? { data: null, error: null };
    };
    // For non-maybeSingle awaits — `.select(...).eq(...).eq(...)` returns
    // an array via the promise interface.
    (builder as { then?: unknown }).then = (
      onFulfilled: (val: RowResult) => unknown
    ) => {
      const result = opts.selectResults?.[resultKey] ?? { data: [], error: null };
      return Promise.resolve(result).then(onFulfilled);
    };
    return builder;
  };

  return {
    last,
    client: {
      auth: {
        getUser: async () => ({
          data: { user: opts.auth?.user ?? null },
          error: opts.auth?.user ? null : { message: "Not authenticated" },
        }),
      },
      from: (table: string) => chain(table),
      rpc: async (name: string, args: unknown) => {
        last.rpcName = name;
        last.rpcArgs = args;
        return opts.rpcResult ?? { error: null };
      },
    },
  };
}

// ─── Module-level mock ───────────────────────────────────────────────────

let mockState: ReturnType<typeof makeMockSupabase> = makeMockSupabase({});

vi.mock("../supabase/client", () => ({
  supabaseBrowser: () => mockState.client,
}));

beforeEach(() => {
  mockState = makeMockSupabase({});
});

// ─── Helpers ─────────────────────────────────────────────────────────────

function makeWorkflow(id = "wf-1"): Workflow {
  return {
    id,
    theme: "sales",
    name: "Test workflow",
    trigger: null,
    why: "",
    inputs: [],
    steps: [],
    outputs: [],
    tools: [],
    automationScore: 0,
    automationRationale: "",
    x: 0,
    y: 0,
  };
}

const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

// Re-import the backend after each mock setup so it sees the right
// supabaseBrowser stub.
async function loadBackend() {
  const mod = await import("./supabase");
  return mod.supabaseBackend;
}

// ─── Auth gating ─────────────────────────────────────────────────────────

describe("supabaseBackend (auth gating)", () => {
  it("loadWorkflows throws when there is no authenticated user", async () => {
    mockState = makeMockSupabase({ auth: { user: null } });
    const backend = await loadBackend();
    await expect(backend.loadWorkflows()).rejects.toThrow(/Not authenticated/);
  });

  it("saveWorkflows throws when there is no authenticated user", async () => {
    mockState = makeMockSupabase({ auth: { user: null } });
    const backend = await loadBackend();
    await expect(backend.saveWorkflows([])).rejects.toThrow(/Not authenticated/);
  });

  it("saveShare throws when there is no authenticated user", async () => {
    mockState = makeMockSupabase({ auth: { user: null } });
    const backend = await loadBackend();
    await expect(
      backend.saveShare({
        token: "x",
        workflow: makeWorkflow(),
        sharedBy: { id: "u", name: "n" },
        redactions: {
          triggerDescription: false,
          purpose: false,
          tools: false,
          classifications: false,
          hiddenStepNumbers: [],
          hiddenInputIndices: [],
          hiddenOutputIndices: [],
        },
        publicLibrary: false,
        remixCount: 0,
        createdAt: 0,
      })
    ).rejects.toThrow(/Not authenticated/);
  });
});

// ─── Workflows ───────────────────────────────────────────────────────────

describe("supabaseBackend.loadWorkflows", () => {
  it("queries the workflows table filtered by user_id and returns the data column", async () => {
    const wf = makeWorkflow("a");
    mockState = makeMockSupabase({
      auth: { user: { id: TEST_USER_ID } },
      selectResults: {
        "workflows:select": { data: [{ data: wf }], error: null },
      },
    });
    const backend = await loadBackend();
    const result = await backend.loadWorkflows();
    expect(result).toEqual([wf]);
    expect(mockState.last.table).toBe("workflows");
    expect(mockState.last.selectCols).toBe("data");
    expect(mockState.last.eqFilters).toEqual([["user_id", TEST_USER_ID]]);
  });

  it("returns an empty array when the user has no workflows", async () => {
    mockState = makeMockSupabase({
      auth: { user: { id: TEST_USER_ID } },
      selectResults: { "workflows:select": { data: [], error: null } },
    });
    const backend = await loadBackend();
    expect(await backend.loadWorkflows()).toEqual([]);
  });
});

describe("supabaseBackend.saveWorkflows", () => {
  it("upserts the supplied workflows tagged with user_id", async () => {
    mockState = makeMockSupabase({
      auth: { user: { id: TEST_USER_ID } },
      selectResults: { "workflows:select": { data: [], error: null } },
    });
    const backend = await loadBackend();
    await backend.saveWorkflows([makeWorkflow("a"), makeWorkflow("b")]);

    expect(mockState.last.table).toBe("workflows");
    expect(mockState.last.upsertOptions).toEqual({ onConflict: "user_id,id" });
    const rows = mockState.last.upsertRows as Array<{ id: string; user_id: string; data: Workflow }>;
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(rows.every((r) => r.user_id === TEST_USER_ID)).toBe(true);
    expect(rows[0].data.id).toBe("a");
  });
});

// ─── Canvases ────────────────────────────────────────────────────────────

describe("supabaseBackend.loadCanvases", () => {
  it("maps snake_case row columns to the camelCase Canvas shape", async () => {
    const row = {
      id: "canvas-default",
      user_id: TEST_USER_ID,
      name: "My Business",
      workflow_ids: ["wf-1"],
      connections: [{ from: "wf-1", to: "wf-2" }],
      chain_names: { foo: "bar" },
      read_only: false,
    };
    mockState = makeMockSupabase({
      auth: { user: { id: TEST_USER_ID } },
      selectResults: { "canvases:select": { data: [row], error: null } },
    });
    const backend = await loadBackend();
    const [canvas] = await backend.loadCanvases();
    const expected: Canvas = {
      id: "canvas-default",
      name: "My Business",
      workflowIds: ["wf-1"],
      connections: [{ from: "wf-1", to: "wf-2" }],
      chainNames: { foo: "bar" },
      readOnly: false,
    };
    expect(canvas).toEqual(expected);
    expect(mockState.last.eqFilters).toEqual([["user_id", TEST_USER_ID]]);
  });
});

describe("supabaseBackend.saveCanvases", () => {
  it("filters out read-only canvases (Examples is a client-side seed)", async () => {
    mockState = makeMockSupabase({
      auth: { user: { id: TEST_USER_ID } },
      selectResults: { "canvases:select": { data: [], error: null } },
    });
    const backend = await loadBackend();
    await backend.saveCanvases([
      { id: "canvas-default", name: "My Business", workflowIds: [], connections: [], chainNames: {} },
      { id: "canvas-examples", name: "Examples", workflowIds: [], connections: [], chainNames: {}, readOnly: true },
    ]);

    const rows = mockState.last.upsertRows as Array<{ id: string }>;
    expect(rows.map((r) => r.id)).toEqual(["canvas-default"]);
  });
});

// ─── Shares ──────────────────────────────────────────────────────────────

describe("supabaseBackend.loadShare", () => {
  it("maps a DB row to ShareSettings (incl. created_at → number)", async () => {
    const sample = {
      token: "abc",
      user_id: TEST_USER_ID,
      workflow_data: makeWorkflow("wf-1"),
      redactions: {
        triggerDescription: false,
        purpose: false,
        tools: false,
        classifications: false,
        hiddenStepNumbers: [],
        hiddenInputIndices: [],
        hiddenOutputIndices: [],
      },
      shared_by: { id: "u", name: "Mez" },
      public_library: false,
      remix_count: 3,
      created_at: "2026-05-05T12:00:00.000Z",
    };
    mockState = makeMockSupabase({
      auth: { user: { id: TEST_USER_ID } },
      selectResults: { "shares:select": { data: sample, error: null } },
    });
    const backend = await loadBackend();
    const got = (await backend.loadShare("abc")) as ShareSettings;
    expect(got.token).toBe("abc");
    expect(got.workflow.id).toBe("wf-1");
    expect(got.remixCount).toBe(3);
    expect(got.createdAt).toBe(new Date(sample.created_at).getTime());
    expect(mockState.last.table).toBe("shares");
    expect(mockState.last.eqFilters).toEqual([["token", "abc"]]);
  });

  it("returns null when the token is not found", async () => {
    mockState = makeMockSupabase({
      auth: { user: { id: TEST_USER_ID } },
      selectResults: { "shares:select": { data: null, error: null } },
    });
    const backend = await loadBackend();
    expect(await backend.loadShare("missing")).toBeNull();
  });
});

describe("supabaseBackend.loadSharesByWorkflowId", () => {
  it("filters by the user_id and the workflow_data->>id JSON path", async () => {
    mockState = makeMockSupabase({
      auth: { user: { id: TEST_USER_ID } },
      selectResults: { "shares:select": { data: [], error: null } },
    });
    const backend = await loadBackend();
    await backend.loadSharesByWorkflowId("wf-42");
    expect(mockState.last.table).toBe("shares");
    expect(mockState.last.eqFilters).toEqual([
      ["user_id", TEST_USER_ID],
      ["workflow_data->>id", "wf-42"],
    ]);
  });
});

describe("supabaseBackend.incrementRemixCount", () => {
  it("calls the bump_remix_count RPC with the share token", async () => {
    mockState = makeMockSupabase({
      auth: { user: { id: TEST_USER_ID } },
      rpcResult: { data: null, error: null },
    });
    const backend = await loadBackend();
    await backend.incrementRemixCount("tok-1");
    expect(mockState.last.rpcName).toBe("bump_remix_count");
    expect(mockState.last.rpcArgs).toEqual({ share_token: "tok-1" });
  });

  it("works without an authenticated user (anon remix path)", async () => {
    mockState = makeMockSupabase({
      auth: { user: null },
      rpcResult: { data: null, error: null },
    });
    const backend = await loadBackend();
    // Anonymous calls are allowed because the RPC is security-definer
    // with a GRANT on `anon`. requireUserId is not called here.
    await expect(backend.incrementRemixCount("tok-1")).resolves.toBeUndefined();
  });
});
