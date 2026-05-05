import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { loadShareServer } from "@/lib/db/server-shares";
import ShareView, { PublicHeader } from "./share-view";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };
const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

// Phase 4: this route is a Server Component. The share is fetched
// server-side from Supabase, both for `generateMetadata` (so social
// crawlers see real og:title / og:description) and for the page body
// (no client-side loading flash). All interactivity lives in
// share-view.tsx which is a "use client" component receiving the
// already-resolved settings as a prop.

type PageParams = { params: Promise<{ token: string }> };

export async function generateMetadata(
  { params }: PageParams
): Promise<Metadata> {
  const { token } = await params;
  const settings = await loadShareServer(token);
  if (!settings) {
    return {
      title: "Workflow not found — Magicus",
      description: "This share link is no longer available.",
    };
  }
  const w = settings.workflow;
  const title = `${w.name} — Magicus`;
  const fallbackDesc = `A ${w.theme} workflow by ${settings.sharedBy.name} — ${w.automationScore}% automatable. Built on Magicus.`;
  const description = (w.automationRationale || "").trim() || fallbackDesc;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "Magicus",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function SharePage({ params }: PageParams) {
  const { token } = await params;
  const settings = await loadShareServer(token);

  if (!settings) {
    return (
      <div style={{ ...dmSans, background: "#F7FAF2", minHeight: "100vh" }}>
        <PublicHeader />
        <div
          style={{
            maxWidth: 480,
            margin: "0 auto",
            padding: "120px 24px 64px",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              ...dmSerif,
              fontSize: 28,
              color: "#3B4953",
              lineHeight: 1.2,
              letterSpacing: -0.4,
              marginBottom: 14,
            }}
          >
            This workflow isn&apos;t available
          </h1>
          <p style={{ fontSize: 14, color: "#547863", lineHeight: 1.55, marginBottom: 28 }}>
            The share link may have expired or been revoked. If you created
            it, head back to your canvas to share it again.
          </p>
          <Link
            href="/"
            className="hover:opacity-90 transition-opacity inline-flex items-center gap-2"
            style={{
              background: "#3B4953",
              color: "#EBF4DD",
              padding: "12px 22px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Go to Magicus
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#F7FAF2", minHeight: "100vh" }}>
      <PublicHeader />
      <ShareView settings={settings} />
    </div>
  );
}
