import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import {
  loadUserExplainers,
  type Explainer,
} from "@/lib/explainers";
import { LogoMark } from "@/app/components/logo";

// Per-request render: this page reads the user's session cookie to
// scope the explainer list. There's nothing meaningful to prerender,
// and the build-time pass has no env / no auth so prerendering would
// crash anyway.
export const dynamic = "force-dynamic";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif" };
const dmSerifItalic = {
  fontFamily: "var(--font-dm-serif), serif",
  fontStyle: "italic" as const,
};
const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

const CORAL = "#E8553E";
const APP_BG = "#F7FAF2";
const INK = "#3B4953";
const SAGE = "#547863";
const SAGE_MUTED = "#90AB8B";
const CARD_BORDER = "#EBF4DD";

export default async function ExplainerHubPage() {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    // Not signed in. Sending unauthed users straight to /explainer/new
    // routes them through the auth gate via the existing
    // magicus_pending_explainer flag and brings them back here. Mirrors
    // the rest of the explainer routes.
    redirect("/?welcome=1");
  }

  const explainers = await loadUserExplainers(
    supabase as unknown as SupabaseClient,
    userData.user.id
  );
  const drafts = explainers.filter((e) => e.status === "draft");
  const published = explainers.filter((e) => e.status === "published");
  const isEmpty = explainers.length === 0;

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: APP_BG, ...dmSans }}
    >
      <header
        className="flex items-center justify-between"
        style={{ padding: "20px 28px" }}
      >
        <Link
          href="/"
          aria-label="Magicus home"
          className="flex items-center gap-2.5"
          style={{ textDecoration: "none" }}
        >
          <LogoMark variant="coral" size={28} />
          <span style={{ ...dmSerifItalic, fontSize: 22, color: INK }}>
            magicus
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="hover:underline"
            style={{
              color: SAGE,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Back to canvas →
          </Link>
        </div>
      </header>

      <main className="flex-1" style={{ padding: "32px 24px 80px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {/* Header row */}
          <div
            className="flex flex-wrap items-end justify-between gap-4"
            style={{ marginBottom: 32 }}
          >
            <div>
              <div
                style={{
                  color: SAGE_MUTED,
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  marginBottom: 12,
                }}
              >
                Share what you&apos;ve built
              </div>
              <h1
                style={{
                  ...dmSerifItalic,
                  fontWeight: 700,
                  fontSize: 40,
                  color: INK,
                  lineHeight: 1.1,
                  letterSpacing: -0.4,
                  marginBottom: 10,
                }}
              >
                Your explainers.
              </h1>
              <p
                style={{
                  fontSize: 15,
                  color: SAGE,
                  lineHeight: 1.55,
                  maxWidth: 460,
                }}
              >
                Walkthroughs of automations you&apos;ve shared. Each one is a
                public-readable post your colleagues can read, use, or build
                on.
              </p>
            </div>
            {!isEmpty && (
              <Link
                href="/explainer/new"
                className="flex items-center gap-2 transition-opacity hover:opacity-95"
                style={{
                  background: CORAL,
                  color: "#FFFFFF",
                  padding: "11px 18px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: "none",
                  flexShrink: 0,
                }}
              >
                <Plus size={14} />
                Share something new
              </Link>
            )}
          </div>

          {isEmpty ? (
            <EmptyState />
          ) : (
            <>
              {published.length > 0 && (
                <Section
                  label={`Published (${published.length})`}
                  items={published}
                />
              )}
              {drafts.length > 0 && (
                <Section label={`Drafts (${drafts.length})`} items={drafts} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Section({ label, items }: { label: string; items: Explainer[] }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2
        style={{
          color: SAGE_MUTED,
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        {label}
      </h2>
      <div className="flex flex-col gap-3">
        {items.map((e) => (
          <ExplainerCard key={e.id} explainer={e} />
        ))}
      </div>
    </section>
  );
}

function ExplainerCard({ explainer }: { explainer: Explainer }) {
  const isPublished = explainer.status === "published";
  // Drafts go to the editor; published explainers point at their public
  // page. The "Manage" link below sends published-explainer authors back
  // to the share screen so they can grab the link or LinkedIn out.
  const primaryHref = isPublished
    ? `/e/${explainer.token}`
    : `/explainer/draft/${explainer.id}`;
  const updated = new Date(explainer.updated_at);

  return (
    <Link
      href={primaryHref}
      className="hover:bg-[#FBFDF7] transition-colors"
      style={{
        background: "#FFFFFF",
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
        padding: "16px 20px",
        textDecoration: "none",
        color: INK,
        display: "block",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
            <StatusPill status={explainer.status} />
            {isPublished && (
              <span style={{ fontSize: 11, color: SAGE_MUTED }}>
                Viewed {explainer.view_count}× this month
              </span>
            )}
          </div>
          <div
            style={{
              ...dmSerif,
              fontWeight: 700,
              fontSize: 18,
              color: INK,
              lineHeight: 1.3,
              marginBottom: 4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {explainer.hook_headline ?? "Untitled explainer"}
          </div>
          <div
            style={{
              fontSize: 12,
              color: SAGE_MUTED,
              lineHeight: 1.5,
            }}
          >
            Updated{" "}
            {updated.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {isPublished && (
              <>
                {" "}· <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>magicus.io/e/{explainer.token}</span>
              </>
            )}
          </div>
        </div>
        <ArrowRight
          size={18}
          style={{ color: SAGE_MUTED, flexShrink: 0, marginTop: 4 }}
        />
      </div>
    </Link>
  );
}

function StatusPill({ status }: { status: Explainer["status"] }) {
  if (status === "published") {
    return (
      <span
        className="flex items-center gap-1.5"
        style={{
          background: "#FBE6E0",
          color: CORAL,
          border: `1px solid ${CORAL}33`,
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            background: CORAL,
            display: "inline-block",
          }}
        />
        Published
      </span>
    );
  }
  return (
    <span
      style={{
        background: APP_BG,
        color: SAGE,
        border: `1px solid ${SAGE}33`,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      Draft
    </span>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 16,
        padding: "40px 32px",
        textAlign: "center",
      }}
    >
      <h3
        style={{
          ...dmSerifItalic,
          fontSize: 22,
          color: INK,
          lineHeight: 1.3,
          marginBottom: 10,
        }}
      >
        Nothing here yet.
      </h3>
      <p
        style={{
          fontSize: 14,
          color: SAGE,
          lineHeight: 1.55,
          maxWidth: 380,
          margin: "0 auto 20px",
        }}
      >
        Walk through one of your automations and Magicus turns it into a
        shareable explainer your colleagues can read, use, and build on.
      </p>
      <Link
        href="/explainer/new"
        className="inline-flex items-center gap-2 transition-opacity hover:opacity-95"
        style={{
          background: CORAL,
          color: "#FFFFFF",
          padding: "11px 22px",
          borderRadius: 999,
          fontSize: 14,
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        Walk through your first one
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}
