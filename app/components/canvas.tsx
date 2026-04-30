"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Maximize2, X } from "lucide-react";
import { ButterflyCard } from "./butterfly-card";
import type { Workflow, Connection, Theme } from "@/lib/workflows";

const CARD_W = 560;
const CARD_H = 460;

export function Canvas({
  workflows,
  connections,
  selectedId,
  themeFilter,
  connectMode,
  onSelect,
  onCreateConnection,
  onDeleteConnection,
  onCancelConnect,
  focusId,
}: {
  workflows: Workflow[];
  connections: Connection[];
  selectedId: string | null;
  themeFilter: Theme | null;
  connectMode: { fromId: string } | null;
  onSelect: (id: string | null) => void;
  onCreateConnection: (fromId: string, toId: string) => void;
  onDeleteConnection: (fromId: string, toId: string) => void;
  onCancelConnect: () => void;
  focusId?: string | null;
}) {
  const visibleWorkflows = themeFilter ? workflows.filter((w) => w.theme === themeFilter) : workflows;
  const visibleIds = new Set(visibleWorkflows.map((w) => w.id));
  const visibleConnections = connections.filter(
    (c) => visibleIds.has(c.from) && visibleIds.has(c.to)
  );

  const [scale, setScale] = useState(0.55);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredConn, setHoveredConn] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const minX = visibleWorkflows.length > 0 ? Math.min(...visibleWorkflows.map((w) => w.x)) - 80 : 0;
  const minY = visibleWorkflows.length > 0 ? Math.min(...visibleWorkflows.map((w) => w.y)) - 80 : 0;
  const maxX = visibleWorkflows.length > 0 ? Math.max(...visibleWorkflows.map((w) => w.x + CARD_W)) + 80 : 1000;
  const maxY = visibleWorkflows.length > 0 ? Math.max(...visibleWorkflows.map((w) => w.y + CARD_H)) + 80 : 800;
  const worldW = maxX - minX;
  const worldH = maxY - minY;

  const fit = () => {
    const el = containerRef.current;
    if (!el) return;
    const s = Math.min(el.clientWidth / worldW, el.clientHeight / worldH) * 0.92;
    setScale(s);
    setTx((el.clientWidth - worldW * s) / 2 - minX * s);
    setTy((el.clientHeight - worldH * s) / 2 - minY * s);
  };

  const focusOn = (id: string) => {
    const el = containerRef.current;
    const w = workflows.find((x) => x.id === id);
    if (!el || !w) return;
    const s = 0.7;
    setScale(s);
    setTx(el.clientWidth / 2 - (w.x + CARD_W / 2) * s);
    setTy(el.clientHeight / 2 - (w.y + CARD_H / 2) * s);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fit(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fit(); }, [themeFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (focusId) focusOn(focusId); }, [focusId]);

  useEffect(() => {
    if (!connectMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancelConnect(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connectMode, onCancelConnect]);

  const onWheel = (e: React.WheelEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = -e.deltaY * 0.0015;
    const next = Math.min(2, Math.max(0.2, scale * (1 + delta)));
    const k = next / scale;
    setTx(mx - (mx - tx) * k);
    setTy(my - (my - ty) * k);
    setScale(next);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-card]")) return;
    if ((e.target as HTMLElement).closest("[data-conn-label]")) return;
    setPanning(true);
    if (!connectMode) onSelect(null);
    panStart.current = { x: e.clientX, y: e.clientY, tx, ty };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!panning || !panStart.current) return;
    setTx(panStart.current.tx + (e.clientX - panStart.current.x));
    setTy(panStart.current.ty + (e.clientY - panStart.current.y));
  };
  const onMouseUp = () => { setPanning(false); panStart.current = null; };

  const zoomBy = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    const next = Math.min(2, Math.max(0.2, scale * factor));
    const k = next / scale;
    setTx(cx - (cx - tx) * k);
    setTy(cy - (cy - ty) * k);
    setScale(next);
  };

  const wfMap = new Map(visibleWorkflows.map((w) => [w.id, w]));

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{
        background: "#F7FAF2",
        backgroundImage: "radial-gradient(rgba(144, 171, 139, 0.4) 1.2px, transparent 1.2px)",
        backgroundSize: `${28 * scale}px ${28 * scale}px`,
        backgroundPosition: `${tx}px ${ty}px`,
        cursor: connectMode ? "crosshair" : panning ? "grabbing" : "grab",
        fontFamily: "var(--font-dm-sans), sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: "0 0",
          width: worldW,
          height: worldH,
        }}
      >
        <svg
          aria-hidden
          style={{
            position: "absolute",
            left: minX,
            top: minY,
            width: worldW,
            height: worldH,
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#547863" />
            </marker>
          </defs>
          {visibleConnections.map((c) => {
            const a = wfMap.get(c.from);
            const b = wfMap.get(c.to);
            if (!a || !b) return null;
            const ax = a.x + CARD_W - minX;
            const ay = a.y + CARD_H / 2 - minY;
            const bx = b.x - minX;
            const by = b.y + CARD_H / 2 - minY;
            const dx = Math.max(80, (bx - ax) / 2);
            const path = `M ${ax} ${ay} C ${ax + dx} ${ay}, ${bx - dx} ${by}, ${bx} ${by}`;
            const key = `${c.from}-${c.to}`;
            const isActive =
              selectedId === c.from ||
              selectedId === c.to ||
              hovered === c.from ||
              hovered === c.to ||
              hoveredConn === key;
            const midX = (ax + bx) / 2;
            const midY = (ay + by) / 2;
            const labelText = c.label ?? "Connects to";
            const labelW = labelText.length * 7.2 + 28;
            return (
              <g key={key}>
                <path
                  d={path}
                  stroke="#547863"
                  strokeWidth={isActive ? 3 : 2}
                  strokeDasharray="8 6"
                  fill="none"
                  opacity={isActive ? 0.95 : 0.55}
                  markerEnd="url(#arrow)"
                />
                <g
                  data-conn-label
                  transform={`translate(${midX}, ${midY})`}
                  style={{ cursor: "pointer", pointerEvents: "auto" }}
                  onMouseEnter={() => setHoveredConn(key)}
                  onMouseLeave={() => setHoveredConn(null)}
                >
                  <rect
                    x={-labelW / 2}
                    y={-11}
                    width={labelW}
                    height={22}
                    rx={11}
                    fill="#FFFFFF"
                    stroke="#90AB8B"
                    strokeWidth={1}
                  />
                  <text
                    x={hoveredConn === key ? -7 : 0}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={11}
                    fill="#3B4953"
                    fontFamily="var(--font-dm-sans), sans-serif"
                  >
                    {labelText}
                  </text>
                  {hoveredConn === key && (
                    <g
                      transform={`translate(${labelW / 2 - 12}, 0)`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConnection(c.from, c.to);
                      }}
                    >
                      <circle r={8} fill="#3B4953" />
                      <line x1={-3} y1={-3} x2={3} y2={3} stroke="#EBF4DD" strokeWidth={1.5} />
                      <line x1={3} y1={-3} x2={-3} y2={3} stroke="#EBF4DD" strokeWidth={1.5} />
                    </g>
                  )}
                </g>
              </g>
            );
          })}
        </svg>

        {visibleWorkflows.map((w) => {
          const isConnectSource = connectMode?.fromId === w.id;
          const isConnectTarget = connectMode && connectMode.fromId !== w.id;
          return (
            <div
              key={w.id}
              data-card
              style={{
                position: "absolute",
                left: w.x,
                top: w.y,
                outline: isConnectSource
                  ? "3px solid #547863"
                  : isConnectTarget && hovered === w.id
                  ? "3px dashed #547863"
                  : "none",
                outlineOffset: 8,
                borderRadius: 24,
              }}
            >
              <ButterflyCard
                data={w}
                hovered={hovered === w.id}
                selected={selectedId === w.id}
                onMouseEnter={() => setHovered(w.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (connectMode) {
                    if (connectMode.fromId !== w.id) {
                      onCreateConnection(connectMode.fromId, w.id);
                    } else {
                      onCancelConnect();
                    }
                    return;
                  }
                  onSelect(selectedId === w.id ? null : w.id);
                }}
              />
            </div>
          );
        })}
      </div>

      {connectMode && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3"
          style={{
            top: 16,
            background: "#3B4953",
            color: "#EBF4DD",
            padding: "10px 18px",
            borderRadius: 999,
            fontSize: 13,
            zIndex: 30,
            boxShadow: "0px 4px 16px rgba(59, 73, 83, 0.18)",
          }}
        >
          <span>
            Click a target workflow to chain from{" "}
            <strong style={{ color: "#FFFFFF" }}>
              {workflows.find((w) => w.id === connectMode.fromId)?.name}
            </strong>
          </span>
          <button
            onClick={onCancelConnect}
            className="hover:bg-[rgba(235,244,221,0.15)] rounded-full p-1"
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div
        className="absolute bottom-6 right-6 flex flex-col gap-1"
        style={{
          background: "#FFFFFF",
          borderRadius: 12,
          padding: 6,
          border: "1px solid #EBF4DD",
        }}
      >
        <button
          onClick={() => zoomBy(1.2)}
          className="hover:bg-[#EBF4DD] rounded-md p-2"
          style={{ color: "#3B4953" }}
          aria-label="Zoom in"
        >
          <Plus size={16} />
        </button>
        <div style={{ fontSize: 11, color: "#547863", textAlign: "center", padding: "2px 0" }}>
          {Math.round(scale * 100)}%
        </div>
        <button
          onClick={() => zoomBy(1 / 1.2)}
          className="hover:bg-[#EBF4DD] rounded-md p-2"
          style={{ color: "#3B4953" }}
          aria-label="Zoom out"
        >
          <Minus size={16} />
        </button>
        <div style={{ height: 1, background: "#EBF4DD", margin: "4px 2px" }} />
        <button
          onClick={fit}
          className="hover:bg-[#EBF4DD] rounded-md p-2"
          style={{ color: "#3B4953" }}
          aria-label="Fit to screen"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      <div
        className="absolute bottom-6 left-6"
        style={{
          fontSize: 11,
          color: "#547863",
          background: "rgba(255,255,255,0.85)",
          padding: "6px 12px",
          borderRadius: 999,
          pointerEvents: "none",
          border: "1px solid #EBF4DD",
        }}
      >
        Drag to pan · Scroll to zoom · Click a card to open details
      </div>
    </div>
  );
}
