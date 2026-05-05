---
name: Magicus Project Overview
description: App purpose, data model, key user flows, and architectural decisions affecting UX
type: project
---

Magicus is a workflow-mapping tool for non-technical users who want to describe, visualise, and eventually automate their business processes. Core value prop: describe a workflow in plain English → LLM generates a structured visual card → user refines it → exports to Markdown or generates Zapier/n8n automation instructions.

**Data model:**
- `Workflow` — a single process card. Has trigger, steps (n/text/note/owner), inputs, outputs, tools, automationScore, theme (sales/marketing/operations/finance), x/y position.
- `Canvas` — a collection of workflows + connections between them. Has `readOnly` flag.
- `Connection` — from/to workflow IDs with an optional label.
- Chains = connected subgraphs of workflows (computed via BFS in `computeChains`).

**Key flows:**
1. Landing (fullscreen) → describe workflow → POST /api/generate → LLM returns structured JSON via tool_call → workflows placed on "My Business" canvas → detail panel opens on first card
2. In-app "New workflow" button → same Landing in modal mode
3. Canvas: pan/zoom (mouse), click to select, shift-click multi-select, "Chain →" enters connect mode (crosshair cursor + banner), click target card to create connection
4. Detail panel: editable inline fields for all workflow properties; trigger picker (schedule/event/manual or auto-set to "chained" when connected)
5. Export: Markdown modal with copy button (no download)
6. Automate: per-platform (Zapier/n8n) accordion, LLM generates step-by-step instructions, read/markdown toggle

**Persistence:** localStorage only. No auth, no server-side user data.

**State management:** All in `page.tsx` via useState/useCallback; `useWorkflows` hook manages localStorage sync.

**LLM integration:** `claude-sonnet-4-6`, system prompt cached with ephemeral cache_control. Generate endpoint uses tool_call forcing. Automate endpoint is free-form text response.

**Examples canvas:** Hard-coded, read-only, always present. Pre-populated with 8 workflows across 4 themes (sales pipeline, newsletter, content pipeline, vendor onboarding, invoice approval).

**Why:** Why field on canvas — "My Business" canvas is the default editable canvas. User lands on it after first workflow generation.
