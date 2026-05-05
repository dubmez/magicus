// Re-exports of the data types the storage layer deals with. Keeping them
// here means UI code can `import type { Workflow } from "@/lib/db"` and the
// storage boundary owns the canonical shape.
export type {
  Workflow,
  Canvas,
  Connection,
  Step,
  Theme,
  Trigger,
  IOItem,
  RemixedFrom,
  AutomationPotential,
} from "../workflows";

export type { ShareSettings, ShareRedactions } from "../shares";
