import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { getExplainerById } from "@/lib/explainers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PublishButton } from "./publish-button";

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

export default async function ExplainerDraftPage({ params }: Props) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    // Not signed in — bounce home. The auth gate elsewhere handles
    // the post-OAuth resume; we don't try to deep-link the draft.
    redirect("/");
  }

  const explainer = await getExplainerById(
    supabase as unknown as SupabaseClient,
    id
  );
  if (!explainer || explainer.user_id !== userData.user.id) {
    // RLS already prevents foreign reads; this guards against direct
    // typos and gives a deterministic redirect.
    redirect("/");
  }

  if (explainer.status === "published") {
    redirect(`/explainer/published/${explainer.id}`);
  }

  const sectionStyle = {
    background: "#FFFFFF",
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 16,
    padding: "24px 28px",
    marginBottom: 16,
  } as const;

  const eyebrowStyle = {
    color: SAGE_MUTED,
    fontSize: 11,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    fontWeight: 500,
    marginBottom: 8,
  } as const;

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: APP_BG, ...dmSans }}
    >
      <header
        className="flex items-center justify-between"
        style={{
          padding: "16px 28px",
          borderBottom: `1px solid ${CARD_BORDER}`,
          background: "#FFFFFF",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-80"
          style={{
            color: SAGE,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={14} />
          <span>Draft explainer</span>
        </Link>
        <PublishButton id={explainer.id} />
      </header>

      <main className="flex-1" style={{ padding: "32px 24px 64px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <p
            style={{
              fontSize: 12,
              color: SAGE_MUTED,
              fontStyle: "italic",
              marginBottom: 16,
            }}
          >
            Review what we wrote. Publishing makes the explainer public at
            magicus.io/e/{explainer.token}. Inline editing lands soon —
            for now, publish to share, or come back here to redo.
          </p>

          {/* Hook */}
          <section style={sectionStyle}>
            <div style={eyebrowStyle}>01 / Hook</div>
            <h2
              style={{
                ...dmSerif,
                fontWeight: 700,
                fontSize: 30,
                color: INK,
                lineHeight: 1.15,
                letterSpacing: -0.4,
                marginBottom: 14,
              }}
            >
              {explainer.hook_headline ?? "Untitled"}
            </h2>
            <p style={{ fontSize: 15, color: INK, lineHeight: 1.6 }}>
              {explainer.hook_body ?? ""}
            </p>
          </section>

          {/* Evidence */}
          {explainer.evidence.length > 0 && (
            <section style={sectionStyle}>
              <div style={eyebrowStyle}>02 / Evidence</div>
              <p style={{ fontSize: 12, color: SAGE_MUTED, marginBottom: 14 }}>
                Screenshots can be added on this page once inline editing
                ships. The captions below were extracted from your narration.
              </p>
              {explainer.evidence.map((e, i) => (
                <div
                  key={i}
                  style={{
                    borderLeft: `3px solid ${CARD_BORDER}`,
                    paddingLeft: 14,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      ...dmSerifItalic,
                      fontSize: 16,
                      color: INK,
                      marginBottom: 4,
                    }}
                  >
                    {e.caption_title}
                  </div>
                  <p style={{ fontSize: 14, color: SAGE, lineHeight: 1.55 }}>
                    {e.caption_body}
                  </p>
                </div>
              ))}
            </section>
          )}

          {/* How to use it */}
          {explainer.is_usable_by_others && explainer.how_to_use.length > 0 && (
            <section style={sectionStyle}>
              <div style={eyebrowStyle}>03 / How to use it</div>
              {explainer.how_to_use.map((s) => (
                <div
                  key={s.step_number}
                  className="flex gap-5"
                  style={{ marginBottom: 14, alignItems: "flex-start" }}
                >
                  <div
                    style={{
                      ...dmSerifItalic,
                      color: CORAL,
                      fontSize: 28,
                      lineHeight: 1,
                      flexShrink: 0,
                      width: 36,
                    }}
                  >
                    {String(s.step_number).padStart(2, "0")}
                  </div>
                  <div>
                    <div
                      style={{
                        ...dmSerif,
                        fontWeight: 700,
                        fontSize: 17,
                        color: INK,
                        marginBottom: 4,
                      }}
                    >
                      {s.title}
                    </div>
                    <p style={{ fontSize: 14, color: SAGE, lineHeight: 1.55 }}>
                      {s.body}
                    </p>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* How I built it */}
          {(explainer.how_i_built_it_headline || explainer.how_i_built_it_body) && (
            <section style={sectionStyle}>
              <div style={eyebrowStyle}>04 / How I built it</div>
              {explainer.how_i_built_it_headline && (
                <h3
                  style={{
                    ...dmSerif,
                    fontWeight: 700,
                    fontSize: 22,
                    color: INK,
                    lineHeight: 1.2,
                    marginBottom: 12,
                  }}
                >
                  {explainer.how_i_built_it_headline}
                </h3>
              )}
              {explainer.how_i_built_it_body && (
                <p
                  style={{
                    fontSize: 15,
                    color: INK,
                    lineHeight: 1.65,
                    whiteSpace: "pre-wrap",
                    marginBottom: 16,
                  }}
                >
                  {explainer.how_i_built_it_body}
                </p>
              )}
              {explainer.tool_stack.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={eyebrowStyle}>Tool stack</div>
                  <div className="flex flex-wrap gap-2">
                    {explainer.tool_stack.map((t, i) => (
                      <span
                        key={i}
                        style={{
                          background: "#FBE6E0",
                          color: CORAL,
                          fontSize: 12,
                          fontWeight: 500,
                          padding: "4px 10px",
                          borderRadius: 999,
                        }}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {explainer.setup_time && (
                <div style={{ marginBottom: 8 }}>
                  <div style={eyebrowStyle}>Setup time</div>
                  <p style={{ fontSize: 14, color: INK }}>{explainer.setup_time}</p>
                </div>
              )}
              {explainer.trickiest_bit && (
                <div>
                  <div style={eyebrowStyle}>Trickiest bit</div>
                  <p style={{ fontSize: 14, color: SAGE, lineHeight: 1.55 }}>
                    {explainer.trickiest_bit}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* At a glance */}
          <section
            style={{
              ...sectionStyle,
              background: "#1C2420",
              borderColor: "#1C2420",
            }}
          >
            <div style={{ ...eyebrowStyle, color: "#90A6AC" }}>05 / At a glance</div>
            <h3
              style={{
                ...dmSerif,
                fontWeight: 700,
                fontSize: 24,
                color: "#F5F0E8",
                marginBottom: 18,
              }}
            >
              The recipe card.
            </h3>
            <div
              className="grid gap-x-8 gap-y-4"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
            >
              <Field label="Automation platform" value={explainer.automation_platform} dark />
              <Field label="Setup time" value={explainer.setup_time} dark />
              <Field label="Trigger" value={explainer.trigger_type} dark />
              <Field label="Used since" value={explainer.used_since} dark />
            </div>
            {explainer.why_i_built_it && (
              <div style={{ marginTop: 18 }}>
                <div style={{ ...eyebrowStyle, color: "#90A6AC" }}>Why I built it</div>
                <blockquote
                  style={{
                    ...dmSerifItalic,
                    fontSize: 16,
                    color: "#F5F0E8",
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
                  &ldquo;{explainer.why_i_built_it}&rdquo;
                </blockquote>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  dark,
}: {
  label: string;
  value: string | null;
  dark?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <div
        style={{
          color: dark ? "#90A6AC" : SAGE_MUTED,
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 500,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          color: dark ? "#F5F0E8" : INK,
          fontWeight: 500,
        }}
      >
        {value}
      </div>
    </div>
  );
}
