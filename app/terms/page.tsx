import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/app/components/logo";

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };
const dmSans = { fontFamily: "var(--font-dm-sans), sans-serif" };

const LAST_UPDATED = "7 May 2026";
const CONTACT_EMAIL = "team@netlearn.io";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "The agreement between you and Magicus when you sign in and use the service.",
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

export default function TermsPage() {
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
          Terms of service
        </h1>
        <p style={{ fontSize: 13, color: "#90AB8B", marginBottom: 32 }}>
          Last updated: {LAST_UPDATED}
        </p>

        <Section title="The deal">
          <p>
            Magicus is a tool for mapping, scoring, and sharing your business
            workflows. By signing in or using the service, you agree to these
            terms. If you don&apos;t agree, don&apos;t use the service. We may
            update these terms from time to time — see the bottom of this page.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            You sign in via Google. You&apos;re responsible for the activity on
            your account, so keep your Google credentials safe. You must be at
            least 16 to use Magicus, and the service is intended for legitimate
            business and personal-productivity use.
          </p>
        </Section>

        <Section title="Your content">
          <p>
            Workflows you describe, record, and store on Magicus are yours.
            We don&apos;t claim ownership of your content. You grant us a
            limited licence to host, process, and (when you ask us to) share
            your content as needed to operate the service. You&apos;re
            responsible for making sure you have the right to share whatever
            you record — for example, don&apos;t record screens or audio
            you&apos;re not authorised to share.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p style={{ marginBottom: 10 }}>
            Don&apos;t use Magicus to:
          </p>
          <ul style={{ paddingLeft: 20, listStyleType: "disc" }}>
            <li style={{ marginBottom: 6 }}>
              break the law, infringe someone else&apos;s rights, or violate
              another platform&apos;s terms;
            </li>
            <li style={{ marginBottom: 6 }}>
              upload malware, attempt to compromise the service, or scrape it
              at scale;
            </li>
            <li style={{ marginBottom: 6 }}>
              process other people&apos;s personal data without a lawful basis;
            </li>
            <li style={{ marginBottom: 6 }}>
              resell access to the service without permission.
            </li>
          </ul>
        </Section>

        <Section title="Service availability">
          <p>
            We aim to keep Magicus up and working, but we don&apos;t promise
            uninterrupted service. AI providers occasionally rate-limit or go
            down, and our infrastructure does too. We may add, remove, or
            change features without prior notice.
          </p>
        </Section>

        <Section title="No warranties">
          <p>
            Magicus is provided &quot;as is&quot;. We don&apos;t guarantee the
            accuracy, completeness, or usefulness of generated workflows —
            they&apos;re drafts to refine, not authoritative blueprints.
            You&apos;re responsible for reviewing AI-generated content before
            acting on it.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            To the maximum extent permitted by law, Magicus and its operators
            won&apos;t be liable for any indirect, incidental, special, or
            consequential damages arising out of or related to your use of the
            service. Our total liability for any direct damages is limited to
            what you paid us (if anything) in the 12 months preceding the
            claim.
          </p>
        </Section>

        <Section title="Termination">
          <p>
            You can stop using Magicus and delete your account at any time —
            email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#547863" }}>
              {CONTACT_EMAIL}
            </a>{" "}
            and we&apos;ll remove your data. We may suspend or terminate
            accounts that violate these terms or pose a risk to other users.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            We may update these terms occasionally. Material changes get
            announced inside the app and the &quot;Last updated&quot; date at
            the top of this page changes accordingly. Continuing to use
            Magicus after an update means you accept the new terms.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or concerns:{" "}
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
