import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { getExplainerByToken } from "@/lib/explainers";
import { LogoMark } from "@/app/components/logo";
import { ViewCountTicker } from "./view-count-ticker";

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
const DARK = "#1C2420";
const CREAM = "#F5F0E8";

type Props = { params: Promise<{ token: string }> };

type Author = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

async function loadAuthor(
  client: SupabaseClient,
  userId: string
): Promise<Author | null> {
  const { data, error } = await client
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    name: (data.display_name as string) ?? "Magicus user",
    avatarUrl: (data.avatar_url as string | null) ?? null,
  };
}

// Server-rendered OG card pulls the explainer + first evidence
// thumbnail (when available). Phase 1 has no screenshots yet so
// og:image falls back to the site default.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const supabase = await supabaseServer();
  const explainer = await getExplainerByToken(
    supabase as unknown as SupabaseClient,
    token
  );
  if (!explainer || explainer.status !== "published") {
    return {
      title: "Explainer not found — Magicus",
      description: "This explainer is no longer available.",
    };
  }
  const firstSentence = (explainer.hook_body ?? "").split(/(?<=[.!?])\s+/)[0] ?? "";
  const author = await loadAuthor(
    supabase as unknown as SupabaseClient,
    explainer.user_id
  );
  const desc = `${firstSentence} · Built by ${author?.name ?? "Magicus user"} on Magicus.`;
  const image = explainer.evidence.find((e) => e.screenshot_url)?.screenshot_url ?? undefined;
  return {
    title: `${explainer.hook_headline ?? "An automation"} — Magicus Explainer`,
    description: desc,
    openGraph: {
      title: explainer.hook_headline ?? "An automation",
      description: desc,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: explainer.hook_headline ?? "An automation",
      description: desc,
      images: image ? [image] : undefined,
    },
  };
}

function formatBuiltDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

// Italicises the segment after the LAST em-dash in a string. Used for
// the auto-formatted section headlines we control here (not the
// LLM-generated hook headline, which renders plain in Phase 1).
function emDashItalic(text: string): React.ReactNode {
  const idx = text.lastIndexOf("—");
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx + 1)}{" "}
      <span style={{ ...dmSerifItalic, color: CORAL }}>
        {text.slice(idx + 1).trim()}
      </span>
    </>
  );
}

export default async function PublicExplainerPage({ params }: Props) {
  const { token } = await params;
  const supabase = await supabaseServer();
  const explainer = await getExplainerByToken(
    supabase as unknown as SupabaseClient,
    token
  );
  if (!explainer || explainer.status !== "published") notFound();

  const author = await loadAuthor(
    supabase as unknown as SupabaseClient,
    explainer.user_id
  );

  const usedThisMonth = explainer.use_count > 0
    ? `Used ${explainer.use_count}× this month`
    : `Viewed ${explainer.view_count}× this month`;

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: APP_BG, ...dmSans, color: INK }}
    >
      <ViewCountTicker token={token} />

      {/* Top bar */}
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
        <div
          className="flex items-center gap-1.5"
          style={{
            background: "#FBE6E0",
            color: CORAL,
            border: `1px solid ${CORAL}33`,
            borderRadius: 999,
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: CORAL,
              display: "inline-block",
            }}
          />
          Public Explainer
        </div>
      </header>

      {/* Body — sticky-footer space at the bottom so content never hides
          behind it on short viewports. */}
      <main
        className="flex-1"
        style={{ padding: "16px 24px 120px" }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {/* 01 / Hook */}
          <section style={{ paddingTop: 32, paddingBottom: 48 }}>
            <Eyebrow>An automation by {author?.name ?? "Magicus user"}</Eyebrow>
            <h1
              className="text-[36px] md:text-[56px]"
              style={{
                ...dmSerif,
                fontWeight: 700,
                color: INK,
                lineHeight: 1.08,
                letterSpacing: -0.6,
                marginBottom: 22,
              }}
            >
              {explainer.hook_headline ?? "Untitled automation"}
            </h1>
            {explainer.hook_body && (
              <p
                className="text-[16px] md:text-[18px]"
                style={{
                  color: INK,
                  lineHeight: 1.6,
                  maxWidth: 600,
                  marginBottom: 28,
                }}
              >
                {explainer.hook_body}
              </p>
            )}

            {/* Byline row */}
            <div
              className="flex flex-wrap items-center gap-3"
              style={{
                paddingTop: 20,
                borderTop: `1px solid ${CARD_BORDER}`,
              }}
            >
              <Avatar name={author?.name ?? "?"} url={author?.avatarUrl ?? null} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>
                  {author?.name ?? "Magicus user"}
                </div>
                <div style={{ fontSize: 12, color: SAGE_MUTED }}>
                  Shared via Magicus
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: SAGE_MUTED,
                  textAlign: "right",
                  lineHeight: 1.5,
                }}
              >
                <div>Built {formatBuiltDate(explainer.created_at)}</div>
                {explainer.setup_time && <div>{explainer.setup_time} to set up</div>}
                <div>{usedThisMonth}</div>
              </div>
            </div>
          </section>

          {/* 02 / Evidence */}
          {explainer.evidence.length > 0 && (
            <section style={{ paddingTop: 32, paddingBottom: 48, borderTop: `1px solid ${CARD_BORDER}` }}>
              <SectionLabel n="02" label="Evidence" />
              <h2
                className="text-[28px] md:text-[36px]"
                style={{
                  ...dmSerif,
                  fontWeight: 700,
                  color: INK,
                  lineHeight: 1.15,
                  letterSpacing: -0.4,
                  marginBottom: 24,
                }}
              >
                {explainer.evidence.length} moments that show{" "}
                <span style={{ ...dmSerifItalic, color: CORAL }}>
                  it actually works.
                </span>
              </h2>
              <div className="flex flex-col gap-4">
                {explainer.evidence.map((ev, i) => (
                  <article
                    key={i}
                    style={{
                      background: "#FFFFFF",
                      border: `1px solid ${CARD_BORDER}`,
                      borderRadius: 12,
                      padding: 20,
                      boxShadow: "0 2px 12px rgba(59, 73, 83, 0.04)",
                    }}
                  >
                    {ev.screenshot_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ev.screenshot_url}
                        alt={ev.caption_title}
                        style={{
                          width: "100%",
                          borderRadius: 8,
                          border: `1px solid ${CARD_BORDER}`,
                          marginBottom: 14,
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        style={{
                          height: 180,
                          background: APP_BG,
                          border: `1px dashed ${CARD_BORDER}`,
                          borderRadius: 8,
                          marginBottom: 14,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: SAGE_MUTED,
                          fontSize: 12,
                          fontStyle: "italic",
                        }}
                      >
                        Screenshot to be added by author
                      </div>
                    )}
                    <div
                      style={{
                        ...dmSerifItalic,
                        fontSize: 16,
                        color: INK,
                        marginBottom: 6,
                      }}
                    >
                      {ev.caption_title}
                    </div>
                    <p style={{ fontSize: 14, color: SAGE, lineHeight: 1.55 }}>
                      {ev.caption_body}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* 03 / How to use it */}
          {explainer.is_usable_by_others && explainer.how_to_use.length > 0 && (
            <section style={{ paddingTop: 32, paddingBottom: 48, borderTop: `1px solid ${CARD_BORDER}` }}>
              <SectionLabel n="03" label="How to use it" />
              <h2
                className="text-[28px] md:text-[36px]"
                style={{
                  ...dmSerif,
                  fontWeight: 700,
                  color: INK,
                  lineHeight: 1.15,
                  letterSpacing: -0.4,
                  marginBottom: 28,
                  maxWidth: 520,
                }}
              >
                If you want to{" "}
                <span style={{ ...dmSerifItalic, color: CORAL }}>
                  run your own version.
                </span>
              </h2>
              <div className="flex flex-col gap-7">
                {explainer.how_to_use.map((s) => (
                  <div key={s.step_number} className="flex gap-6 items-start">
                    <div
                      style={{
                        ...dmSerifItalic,
                        color: CORAL,
                        fontSize: 40,
                        lineHeight: 1,
                        flexShrink: 0,
                        width: 56,
                      }}
                    >
                      {String(s.step_number).padStart(2, "0")}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3
                        style={{
                          ...dmSerif,
                          fontWeight: 700,
                          fontSize: 20,
                          color: INK,
                          lineHeight: 1.25,
                          marginBottom: 6,
                        }}
                      >
                        {s.title}
                      </h3>
                      <p style={{ fontSize: 16, color: SAGE, lineHeight: 1.6 }}>
                        {s.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 04 / How I built it */}
          {(explainer.how_i_built_it_headline || explainer.how_i_built_it_body) && (
            <section style={{ paddingTop: 32, paddingBottom: 48, borderTop: `1px solid ${CARD_BORDER}` }}>
              <SectionLabel n="04" label="How I built it" />
              <div
                className="grid gap-8"
                style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" }}
              >
                <div>
                  {explainer.how_i_built_it_headline && (
                    <h2
                      className="text-[26px] md:text-[34px]"
                      style={{
                        ...dmSerif,
                        fontWeight: 700,
                        color: INK,
                        lineHeight: 1.15,
                        letterSpacing: -0.3,
                        marginBottom: 18,
                      }}
                    >
                      {emDashItalic(explainer.how_i_built_it_headline)}
                    </h2>
                  )}
                  {explainer.how_i_built_it_body && (
                    <p
                      style={{
                        fontSize: 16,
                        color: INK,
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {explainer.how_i_built_it_body}
                    </p>
                  )}
                </div>

                {(explainer.tool_stack.length > 0 ||
                  explainer.setup_time ||
                  explainer.trickiest_bit) && (
                  <aside
                    style={{
                      background: "#FFFFFF",
                      border: `1px solid ${CARD_BORDER}`,
                      borderRadius: 12,
                      padding: 20,
                      alignSelf: "start",
                    }}
                  >
                    {explainer.tool_stack.length > 0 && (
                      <Field label="Tool stack">
                        <div className="flex flex-wrap gap-1.5" style={{ marginTop: 6 }}>
                          {explainer.tool_stack.map((t, i) => (
                            <ToolChip key={i} name={t.name} logoUrl={t.logo_url ?? null} />
                          ))}
                        </div>
                      </Field>
                    )}
                    {explainer.setup_time && (
                      <Field label="Setup time">
                        <div
                          style={{
                            ...dmSerif,
                            fontWeight: 700,
                            fontSize: 22,
                            color: INK,
                            marginTop: 4,
                          }}
                        >
                          {explainer.setup_time}
                        </div>
                      </Field>
                    )}
                    {explainer.trickiest_bit && (
                      <Field label="Trickiest bit">
                        <p
                          style={{
                            fontSize: 14,
                            color: SAGE,
                            lineHeight: 1.55,
                            marginTop: 4,
                          }}
                        >
                          {explainer.trickiest_bit}
                        </p>
                      </Field>
                    )}
                  </aside>
                )}
              </div>
            </section>
          )}

          {/* 05 / At a glance */}
          <section style={{ paddingTop: 32, paddingBottom: 48 }}>
            <div
              style={{
                background: DARK,
                color: CREAM,
                borderRadius: 16,
                padding: "32px 28px",
              }}
            >
              <Eyebrow style={{ color: SAGE_MUTED }}>05 / At a glance</Eyebrow>
              <h2
                style={{
                  ...dmSerif,
                  fontWeight: 700,
                  fontSize: 32,
                  color: CREAM,
                  marginBottom: 24,
                }}
              >
                The recipe card.
              </h2>
              <div
                className="grid gap-x-10 gap-y-5"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
              >
                {explainer.tool_stack.length > 0 && (
                  <DarkField label="Tools used">
                    <div className="flex flex-wrap gap-1.5" style={{ marginTop: 6 }}>
                      {explainer.tool_stack.map((t, i) => (
                        <ToolChip key={i} name={t.name} logoUrl={t.logo_url ?? null} dark />
                      ))}
                    </div>
                  </DarkField>
                )}
                {explainer.automation_platform && (
                  <DarkField label="Automation platform">
                    <div
                      style={{
                        ...dmSerif,
                        fontWeight: 700,
                        fontSize: 20,
                        color: CREAM,
                        marginTop: 4,
                      }}
                    >
                      {explainer.automation_platform}
                    </div>
                  </DarkField>
                )}
                {explainer.setup_time && (
                  <DarkField label="Setup time">
                    <div
                      style={{
                        ...dmSerif,
                        fontWeight: 700,
                        fontSize: 20,
                        color: CREAM,
                        marginTop: 4,
                      }}
                    >
                      {explainer.setup_time}
                    </div>
                  </DarkField>
                )}
                {explainer.trigger_type && (
                  <DarkField label="Trigger">
                    <div
                      style={{
                        ...dmSerif,
                        fontWeight: 700,
                        fontSize: 18,
                        color: CREAM,
                        marginTop: 4,
                      }}
                    >
                      <span>{explainer.trigger_type.replace(/-/g, " ")}</span>
                    </div>
                  </DarkField>
                )}
                {(explainer.used_since || explainer.view_count > 0) && (
                  <DarkField label="Used since">
                    <div
                      style={{
                        ...dmSerif,
                        fontWeight: 700,
                        fontSize: 18,
                        color: CREAM,
                        marginTop: 4,
                      }}
                    >
                      {explainer.used_since ??
                        formatBuiltDate(explainer.created_at)}{" "}
                      <span style={{ ...dmSerifItalic, color: CORAL }}>
                        · {usedThisMonth.replace(/^.* /, "")}
                      </span>
                    </div>
                  </DarkField>
                )}
              </div>
              {explainer.why_i_built_it && (
                <div style={{ marginTop: 28 }}>
                  <DarkField label="Why I built it">
                    <blockquote
                      style={{
                        ...dmSerifItalic,
                        fontSize: 18,
                        color: CREAM,
                        lineHeight: 1.55,
                        margin: "8px 0 0",
                        maxWidth: 600,
                      }}
                    >
                      &ldquo;{explainer.why_i_built_it}&rdquo;
                    </blockquote>
                  </DarkField>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <StickyFooter
        token={explainer.token}
        author={author}
        usable={explainer.is_usable_by_others}
      />
    </div>
  );
}

function StickyFooter({
  token,
  author,
  usable,
}: {
  token: string;
  author: Author | null;
  usable: boolean;
}) {
  return (
    <footer
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        background: "#FFFFFF",
        borderTop: `1px solid ${CARD_BORDER}`,
        padding: "12px 24px",
        zIndex: 20,
        boxShadow: "0 -2px 16px rgba(59, 73, 83, 0.04)",
      }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3"
        style={{ maxWidth: 760, margin: "0 auto" }}
      >
        <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
          <Avatar size={28} name={author?.name ?? "?"} url={author?.avatarUrl ?? null} />
          <span style={{ fontSize: 13, color: SAGE, lineHeight: 1.4 }}>
            Built by{" "}
            <span style={{ fontWeight: 600, color: INK }}>
              {author?.name ?? "Magicus user"}
            </span>{" "}
            · shared via{" "}
            <span style={{ ...dmSerifItalic, color: INK, fontWeight: 500 }}>
              magicus
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {usable && (
            <Link
              href={`/?from_explainer=${token}`}
              className="hover:opacity-90 transition-opacity"
              style={{
                background: CORAL,
                color: "#FFFFFF",
                padding: "9px 16px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Use this automation →
            </Link>
          )}
          <Link
            href={`/?from_explainer=${token}`}
            className="hover:bg-[#F7FAF2] transition-colors"
            style={{
              background: "transparent",
              color: INK,
              border: `1px solid ${INK}`,
              padding: "9px 16px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Build something like this →
          </Link>
        </div>
      </div>
    </footer>
  );
}

function Eyebrow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        color: SAGE_MUTED,
        fontSize: 12,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        fontWeight: 500,
        marginBottom: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ n, label }: { n: string; label: string }) {
  return (
    <div
      style={{
        ...dmSerifItalic,
        color: CORAL,
        fontSize: 14,
        fontWeight: 500,
        marginBottom: 14,
      }}
    >
      {n} / {label}
    </div>
  );
}

function Avatar({
  name,
  url,
  size = 36,
}: {
  name: string;
  url: string | null;
  size?: number;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          flexShrink: 0,
          objectFit: "cover",
          border: `1px solid ${CARD_BORDER}`,
        }}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: "#EBF4DD",
        color: SAGE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.38),
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initialsFor(name)}
    </div>
  );
}

function ToolChip({
  name,
  logoUrl,
  dark,
}: {
  name: string;
  logoUrl: string | null;
  dark?: boolean;
}) {
  return (
    <span
      className="flex items-center gap-1.5"
      style={{
        background: dark ? "rgba(255, 255, 255, 0.08)" : "#FBE6E0",
        color: dark ? CREAM : CORAL,
        border: dark ? "1px solid rgba(255, 255, 255, 0.12)" : `1px solid ${CORAL}33`,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          width={12}
          height={12}
          style={{ width: 12, height: 12, borderRadius: 2 }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: dark ? "rgba(255, 255, 255, 0.15)" : CORAL,
            color: dark ? CREAM : "#FFFFFF",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 700,
          }}
        >
          {(name[0] ?? "?").toUpperCase()}
        </span>
      )}
      {name}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          color: SAGE_MUTED,
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function DarkField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          color: SAGE_MUTED,
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

