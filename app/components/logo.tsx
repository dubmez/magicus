// Magicus logo — two opposing half-discs with a thin gap between them, the
// abstract butterfly mark we use across the app and the favicon.
//
// Two visual variants:
//   coral — used on the dark landing hero and the favicon
//   sage  — used everywhere else (top bar, share view, recording flow)
//
// Wordmark colour can override the default per call (e.g. cream on the
// dark recording screen) without changing the icon variant.

const dmSerif = { fontFamily: "var(--font-dm-serif), serif", fontStyle: "italic" as const };

export type LogoVariant = "coral" | "sage";

const MARK_COLORS: Record<LogoVariant, string> = {
  coral: "#E8553E",
  sage: "#547863",
};

export function LogoMark({
  variant = "sage",
  size = 28,
  color,
}: {
  variant?: LogoVariant;
  size?: number;
  // Direct override; takes precedence over `variant`.
  color?: string;
}) {
  const fill = color ?? MARK_COLORS[variant];
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
      {/* Left half — D-shape with the curve on the left */}
      <path d="M14 4 a12 12 0 0 0 0 24 z" fill={fill} />
      {/* Right half — mirrored */}
      <path d="M18 4 a12 12 0 0 1 0 24 z" fill={fill} />
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
  // Default wordmark colour follows the variant: cream on coral (dark
  // backgrounds), slate on sage (light backgrounds).
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
