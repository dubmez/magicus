// Magicus logo — two opposing wings (half-discs) with a thin vertical body
// between them. Abstract butterfly mark used across the app and favicon.
//
// Two visual variants:
//   coral — used on the dark landing hero and the favicon
//   sage  — used everywhere else (top bar, share view, recording flow)
//
// Wing and body colours can be overridden per call (e.g. cream wings on
// the dark recording chrome) without changing the variant.

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };

export type LogoVariant = "coral" | "sage";

// Wings carry the brand colour; the body is a contrast accent that
// reads as the butterfly's thorax/spine. Defaults are tuned for the
// background each variant typically lands on.
const MARK_PALETTE: Record<LogoVariant, { wing: string; body: string }> = {
  coral: { wing: "#E8553E", body: "#F5F0E8" }, // cream body — for dark BGs
  sage: { wing: "#547863", body: "#3B4953" }, // slate body — for light BGs
};

export function LogoMark({
  variant = "sage",
  size = 28,
  color,
  bodyColor,
}: {
  variant?: LogoVariant;
  size?: number;
  // Direct overrides for atypical backgrounds (e.g. cream-on-dark
  // recording screen). Take precedence over `variant` defaults.
  color?: string;
  bodyColor?: string;
}) {
  const palette = MARK_PALETTE[variant];
  const wing = color ?? palette.wing;
  const body = bodyColor ?? palette.body;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Magicus"
      style={{ flexShrink: 0 }}
    >
      {/* Left wing — D-shape with the curve on the left */}
      <path d="M14 4 a12 12 0 0 0 0 24 z" fill={wing} />
      {/* Right wing — mirrored */}
      <path d="M18 4 a12 12 0 0 1 0 24 z" fill={wing} />
      {/* Body — thin rounded capsule between the wings */}
      <rect x="15" y="3" width="2" height="26" rx="1" fill={body} />
    </svg>
  );
}

// Full logo lockup: mark + wordmark. Use this in headers; `LogoMark`
// alone is for tight spaces (mobile collapsed bars, the favicon).
export function Logo({
  variant = "sage",
  size = 28,
  wordmarkColor,
  showWordmark = true,
  className,
  style,
}: {
  variant?: LogoVariant;
  size?: number;
  wordmarkColor?: string;
  showWordmark?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const wmColor =
    wordmarkColor ?? (variant === "coral" ? "#F5F0E8" : "#3B4953");
  const wordSize = Math.round(size * 0.78);
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        ...style,
      }}
    >
      <LogoMark variant={variant} size={size} />
      {showWordmark && (
        <span
          style={{
            ...dmSerif,
            fontSize: wordSize,
            color: wmColor,
            letterSpacing: -0.2,
            lineHeight: 1,
          }}
        >
          magicus
        </span>
      )}
    </span>
  );
}
