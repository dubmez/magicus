"use client";

import { useEffect } from "react";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };
const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

// Confirmation dialog for deleting a user canvas. Permanent + irreversible
// so we hard-confirm. Library is never offered for deletion (the sidebar
// hides the overflow button on the Library section header) so this modal
// only handles user-owned canvases.
export function DeleteCanvasModal({
  canvasName,
  workflowCount,
  onConfirm,
  onCancel,
}: {
  canvasName: string;
  workflowCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Lock body scroll while the modal is open so the canvas underneath
  // doesn't shift around behind the dim layer.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: "rgba(59, 73, 83, 0.4)",
        zIndex: 110,
        padding: 24,
        ...dmSans,
      }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-canvas-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, 100%)",
          background: "#FFFFFF",
          borderRadius: 16,
          padding: "28px 28px 24px",
          boxShadow: "0px 12px 48px rgba(59, 73, 83, 0.18)",
        }}
      >
        <h2
          id="delete-canvas-title"
          style={{
            ...dmSerif,
            fontSize: 24,
            color: "#3B4953",
            lineHeight: 1.2,
            letterSpacing: -0.3,
            marginBottom: 10,
          }}
        >
          Delete this canvas?
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#547863",
            lineHeight: 1.55,
            marginBottom: 24,
          }}
        >
          This will permanently delete <strong style={{ color: "#3B4953" }}>{canvasName}</strong>
          {" "}and all {workflowCount} workflow{workflowCount === 1 ? "" : "s"} in it.
          This can&apos;t be undone.
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="hover:bg-[#F7FAF2] transition-colors"
            style={{
              background: "transparent",
              color: "#547863",
              padding: "10px 18px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              border: "1px solid #547863",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="hover:opacity-90 transition-opacity"
            style={{
              background: "#C0392B",
              color: "#FFFFFF",
              padding: "10px 18px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
