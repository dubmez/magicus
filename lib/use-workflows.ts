"use client";

import { useState, useEffect } from "react";
import {
  initialWorkflows,
  initialConnections,
  type Workflow,
  type Connection,
} from "./workflows";

const WF_KEY = "magicus:workflows";
const CONN_KEY = "magicus:connections";

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>(() =>
    readLocal(WF_KEY, initialWorkflows)
  );
  const [connections, setConnections] = useState<Connection[]>(() =>
    readLocal(CONN_KEY, initialConnections)
  );

  useEffect(() => {
    try {
      localStorage.setItem(WF_KEY, JSON.stringify(workflows));
    } catch {}
  }, [workflows]);

  useEffect(() => {
    try {
      localStorage.setItem(CONN_KEY, JSON.stringify(connections));
    } catch {}
  }, [connections]);

  return { workflows, setWorkflows, connections, setConnections };
}
