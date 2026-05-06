import { ImageResponse } from "next/og";

// 180×180 apple-touch-icon. Renders the spec's stamp variant directly
// (rounded ink-deep square + coral wings + sage-light stem). iOS rounds
// the corners further on home-screen; we add a touch of internal padding
// so the mark stays clear of the OS rounding.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#2A3330",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 24 24">
          <ellipse cx="8.5" cy="11" rx="5" ry="7.2" fill="#E66B4D" />
          <ellipse cx="15.5" cy="11" rx="5" ry="7.2" fill="#E66B4D" />
          <line
            x1="12"
            y1="3.2"
            x2="12"
            y2="20.8"
            stroke="#EBF4DD"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size
  );
}
