import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { getExplainerById } from "@/lib/explainers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ShareScreenActions } from "./share-actions";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif" };
const dmSerifItalic = {
  fontFamily: "var(--font-dm-serif), serif",
  fontStyle: "italic" as const,
};
const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

const CORAL = "#E66B4D";
const APP_BG = "#F7FAF2";
const INK = "#3B4953";
const SAGE = "#547863";
const SAGE_MUTED = "#90AB8B";
const CARD_BORDER = "#EBF4DD";

type Props = { params: Promise<{ id: string }> };

export default async function ExplainerPublishedPage({ params }: Props) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/");

  const explainer = await getExplainerById(
    supabase as unknown as SupabaseClient,
    id
  );
  if (!explainer || explainer.user_id !== userData.user.id) {
    redirect("/");
  }
  if (explainer.status !== "published") {
    redirect(`/explainer/draft/${id}`);
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: APP_BG, ...dmSans }}
    >
      <main
        className="flex-1 flex items-center justify-center"
        style={{ padding: "48px 24px" }}
      >
        <div
          className="text-center"
          style={{ maxWidth: 540, width: "100%" }}
        >
          <div
            style={{
              color: SAGE_MUTED,
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: 16,
            }}
          >
            Published
          </div>

          <h1
            style={{
              ...dmSerifItalic,
              fontWeight: 700,
              fontSize: 40,
              color: INK,
              lineHeight: 1.15,
              letterSpacing: -0.4,
              marginBottom: 18,
            }}
          >
            Your explainer is live.
          </h1>

          <p
            style={{
              fontSize: 15,
              color: SAGE,
              lineHeight: 1.55,
              marginBottom: 28,
              maxWidth: 440,
              margin: "0 auto 28px",
            }}
          >
            Anyone with the link can read it, use it, or build on it. No
            account needed to view.
          </p>

          <ShareScreenActions
            token={explainer.token}
            hookHeadline={explainer.hook_headline ?? "an automation"}
          />

          <div className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: 28 }}>
            <Link
              href={`/e/${explainer.token}`}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
              style={{
                color: SAGE,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              View your explainer →
            </Link>
            <span style={{ color: CARD_BORDER }}>·</span>
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
              Go to canvas →
            </Link>
          </div>

          <div
            style={{
              marginTop: 36,
              fontSize: 12,
              color: SAGE_MUTED,
              ...dmSerif,
            }}
          >
            magicus
          </div>
        </div>
      </main>
    </div>
  );
}
