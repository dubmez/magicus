import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/app/components/logo";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };
const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

// Static privacy policy for Google OAuth verification + general
// transparency. Reviewer-friendly: lists every third-party service,
// the data each receives, and how long anything is retained. Update
// the LAST_UPDATED date when the policy changes.
const LAST_UPDATED = "7 May 2026";
const CONTACT_EMAIL = "team@netlearn.io";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Magicus collects, uses, and protects the data you share when you map a workflow.",
};

function Header() {
  return (
    <header
      className="flex items-center"
      style={{
        padding: "20px 32px",
        borderBottom: "1px solid #EBF4DD",
        background: "#FFFFFF",
      }}
    >
      <Link
        href="/"
        aria-label="Go home"
        className="flex items-center gap-2.5"
        style={{ textDecoration: "none" }}
      >
        <LogoMark variant="sage" size={28} />
        <span style={{ ...dmSerif, fontSize: 22, color: "#3B4953", letterSpacing: -0.2 }}>
          magicus
        </span>
      </Link>
    </header>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2
        style={{
          ...dmSerif,
          fontSize: 22,
          color: "#3B4953",
          marginBottom: 10,
          letterSpacing: -0.2,
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: 15, color: "#3B4953", lineHeight: 1.65 }}>
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div style={{ background: "#F7FAF2", minHeight: "100vh", ...dmSans }}>
      <Header />
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 24px 96px",
        }}
      >
        <h1
          style={{
            ...dmSerif,
            fontSize: 38,
            color: "#3B4953",
            lineHeight: 1.15,
            letterSpacing: -0.5,
            marginBottom: 8,
          }}
        >
          Privacy policy
        </h1>
        <p style={{ fontSize: 13, color: "#90AB8B", marginBottom: 32 }}>
          Last updated: {LAST_UPDATED}
        </p>

        <Section title="Who this applies to">
          <p>
            Magicus is a workflow-mapping tool operated from the United Kingdom.
            This policy explains what we collect when you sign in, describe a
            workflow, or record one — and what we do with it.
          </p>
        </Section>

        <Section title="What we collect">
          <ul style={{ paddingLeft: 20, listStyleType: "disc" }}>
            <li style={{ marginBottom: 6 }}>
              <strong>Account profile.</strong> When you sign in with Google we
              receive your email, name, and profile picture (avatar). We do not
              receive your Google password.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Workflows you create.</strong> Text descriptions, voice
              transcripts, and screen recordings you submit, plus any
              clarifying answers you provide. These are stored against your
              account so you can come back to them later.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Share links.</strong> If you share a workflow, we store a
              snapshot of that workflow with a random token-based URL plus
              whatever redaction settings you chose.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Technical data.</strong> Standard server logs (IP address,
              user agent, request paths) collected by our hosting provider for
              security and performance. We don&apos;t set marketing or
              advertising cookies.
            </li>
          </ul>
        </Section>

        <Section title="How we use it">
          <ul style={{ paddingLeft: 20, listStyleType: "disc" }}>
            <li style={{ marginBottom: 6 }}>To sign you in and remember your account between sessions.</li>
            <li style={{ marginBottom: 6 }}>
              To process your workflow descriptions and recordings through AI
              models so we can generate the workflow card you see in the app.
            </li>
            <li style={{ marginBottom: 6 }}>
              To store your workflows and canvases so they&apos;re there when
              you return.
            </li>
            <li style={{ marginBottom: 6 }}>
              To diagnose errors and improve reliability.
            </li>
          </ul>
          <p style={{ marginTop: 12 }}>
            We do <strong>not</strong> sell your data, share it with advertisers,
            or use the contents of your workflows to train models.
          </p>
        </Section>

        <Section title="Who else processes your data">
          <p style={{ marginBottom: 10 }}>
            We use trusted infrastructure providers to run the service. Each
            receives only what&apos;s needed for its job:
          </p>
          <ul style={{ paddingLeft: 20, listStyleType: "disc" }}>
            <li style={{ marginBottom: 6 }}>
              <strong>Google (OAuth).</strong> Handles the sign-in flow.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Supabase.</strong> Stores your account, workflows,
              canvases, and share records.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Vercel.</strong> Hosts the application and stores screen
              recordings temporarily in Vercel Blob.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Google Gemini API.</strong> Processes your descriptions
              and recordings to extract workflow steps.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Anthropic (Claude API).</strong> Used as a fallback when
              Gemini is unavailable, for the same purpose.
            </li>
          </ul>
        </Section>

        <Section title="How long we keep things">
          <ul style={{ paddingLeft: 20, listStyleType: "disc" }}>
            <li style={{ marginBottom: 6 }}>
              <strong>Account profile and workflows:</strong> for as long as
              your account exists.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Screen recordings:</strong> deleted from our storage as
              soon as the AI model has finished processing them, typically
              within a minute of upload.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Share snapshots:</strong> until you delete the share or
              your account.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Server logs:</strong> retained for up to 30 days by our
              hosting provider for operational reasons.
            </li>
          </ul>
        </Section>

        <Section title="Your rights">
          <p>
            You can request a copy of the data we hold about you, ask us to
            correct inaccurate data, or delete your account at any time. Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#547863" }}>
              {CONTACT_EMAIL}
            </a>{" "}
            and we&apos;ll handle it within a reasonable timeframe (typically
            within 30 days). If you&apos;re in the UK or EU, you also have the
            right to lodge a complaint with your local data protection
            authority.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Magicus is intended for adults building business workflows. We
            don&apos;t knowingly collect data from anyone under 16. If you
            believe a child has signed up, contact us and we&apos;ll delete the
            account.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we make material changes, we&apos;ll update the &quot;Last
            updated&quot; date at the top and, where appropriate, notify you
            inside the app. Continuing to use Magicus after a change means you
            accept the updated terms.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions, requests, or anything else:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#547863" }}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>
      </main>
    </div>
  );
}
