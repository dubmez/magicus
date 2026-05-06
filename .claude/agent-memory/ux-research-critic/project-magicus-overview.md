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
1. LandingHero (fullscreen) → describe workflow → POST /api/generate → LLM returns structured JSON → workflows placed on canvas → detail panel opens on first card
2. Voice pill → auth gate for unauthed → SpeechRecognition API
3. Record pill → auth gate → full-screen RecordingFlow component
4. "browse example workflows" → state flip to EXAMPLES_CANVAS_ID (no navigation, no URL change)
5. In-app "New workflow" → Landing component in modal mode
6. Export: Markdown modal. Automate: per-platform LLM-generated guide.

**Persistence:** localStorage + Supabase auth (Google OAuth). Auth state determines landing vs canvas view.

**Routing:** Single-page at `/`. `!user && !started` → LandingHero; otherwise → Canvas workspace. Authenticated users navigating to `/` skip the landing entirely.

**State management:** All in `page.tsx` via useState/useCallback; `useWorkflows` hook manages localStorage sync.

**LLM integration:** `claude-sonnet-4-6`. Generate endpoint uses tool_call forcing. Automate endpoint is free-form text.

**Examples canvas:** EXAMPLES_CANVAS_ID constant, read-only, always present.

**Design tokens (hero-specific):**
- HERO_BG: `#2B3D42` (slate-teal)
- HERO_INK: `#F5F0E8` (cream)
- HERO_INK_DIM: `#A8BDB8` (muted teal)
- EYEBROW: `#90AB8B` (sage)
- CORAL: `#E8553E` (accent — italic "you", Map it, browse CTA, logo mark on dark)
- Logo: two opposing half-disc SVG paths (butterfly mark). Coral variant on dark hero, sage elsewhere.
