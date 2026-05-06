// Magicus logo — coral butterfly mark.
//
// Source of truth: ./brand/logo-spec (PDF). Geometry is a 24×24 grid:
//   wings    elliptical, cx 8.5 / 15.5, rx 5, ry 7.2, cy 11
//   stem     line x=12 from y=3.2 to y=20.8, stroke-width 1.6, round caps
//   stamp    24×24 ink-deep square, rx=6 (when used)
//
// Colour rules:
//   - Wings: coral (default) or sage. On a dark background, the sage
//     variant lightens to sage-mid so it stays legible.
//   - Stem: ink-dark on light backgrounds, sage-light on dark/stamp.
//
// Use `onDark` for the dark hero, the dark recording chrome, or any
// near-black surface. Use `stamp` for app icons, favicons, and social
// avatars — wraps the mark in the rounded ink-deep container.

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };

// Brand tokens. Mirrors the values in app/components/brand-colors.ts
// where one exists; kept inline here so the logo file is fully
// self-describing for handoff.
export const BRAND_COLORS = {
  inkDeep: "#2A3330",
  ink: "#3B4953",
  coral: "#E66B4D",
  sage: "#547863",
  sageMid: "#90AB8B",
  sageLight: "#EBF4DD",
  cream: "#FAFAF5",
} as const;

export type LogoVariant = "coral" | "sage";

export function LogoMark({
  variant = "sage",
  size = 28,
  onDark = false,
  stamp = false,
  wingColor,
  stemColor,
}: {
  variant?: LogoVariant;
  size?: number;
  // True when the mark sits on a near-black surface. Drives stem
  // colour and lightens sage wings to sage-mid for legibility.
  onDark?: boolean;
  // Wraps the mark in the rounded ink-deep stamp container. Used
  // for app icons, favicons, and avatars per the spec.
  stamp?: boolean;
  // Per-call overrides; rare but useful for one-off contexts.
  wingColor?: string;
  stemColor?: string;
}) {
  const darkSurface = onDark || stamp;
  const wings =
    wingColor ??
    (variant === "coral"
      ? BRAND_COLORS.coral
      : darkSurface
        ? BRAND_COLORS.sageMid
        : BRAND_COLORS.sage);
  const stem =
    stemColor ?? (darkSurface ? BRAND_COLORS.sageLight : BRAND_COLORS.ink);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Magicus"
      style={{ flexShrink: 0 }}
    >
      {stamp && (
        <rect x="0" y="0" width="24" height="24" rx="6" fill={BRAND_COLORS.inkDeep} />
      )}
      <ellipse cx="8.5" cy="11" rx="5" ry="7.2" fill={wings} />
      <ellipse cx="15.5" cy="11" rx="5" ry="7.2" fill={wings} />
      <line
        x1="12"
        y1="3.2"
        x2="12"
        y2="20.8"
        stroke={stem}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Full lockup: mark + wordmark. Spec wordmark rules:
//   - DM Serif Display italic, weight 400
//   - Cap-height ≈ mark height (font-size ≈ 0.95× mark size in practice)
//   - Letter-spacing -0.01em
//   - Lockup gap = 0.32× mark size
//   - Colour: ink on light, cream on dark
export function Logo({
  variant = "sage",
  size = 28,
  onDark = false,
  stamp = false,
  wordmarkColor,
  showWordmark = true,
  className,
  style,
}: {
  variant?: LogoVariant;
  size?: number;
  onDark?: boolean;
  stamp?: boolean;
  wordmarkColor?: string;
  showWordmark?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const wmColor =
    wordmarkColor ?? (onDark ? BRAND_COLORS.cream : BRAND_COLORS.ink);
  const wordSize = Math.round(size * 0.95);
  const gap = Math.round(size * 0.32);
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap,
        ...style,
      }}
    >
      <LogoMark variant={variant} size={size} onDark={onDark} stamp={stamp} />
      {showWordmark && (
        <span
          style={{
            ...dmSerif,
            fontSize: wordSize,
            color: wmColor,
            letterSpacing: "-0.01em",
            lineHeight: 1,
          }}
        >
          magicus
        </span>
      )}
    </span>
  );
}
