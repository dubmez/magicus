import { ImageResponse } from "next/og";

// 180×180 apple-touch-icon. iOS Safari prefers a PNG and this is the
// agreed iOS home-screen size. The mark mirrors app/icon.svg but with
// background padding so it looks right when iOS rounds the corners.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#2B3D42",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32">
          <path d="M14 4 a12 12 0 0 0 0 24 z" fill="#E8553E" />
          <path d="M18 4 a12 12 0 0 1 0 24 z" fill="#E8553E" />
          <rect x="15" y="3" width="2" height="26" rx="1" fill="#F5F0E8" />
        </svg>
      </div>
    ),
    size
  );
}
