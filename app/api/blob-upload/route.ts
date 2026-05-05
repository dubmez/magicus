import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { type NextRequest, NextResponse } from "next/server";

// Vercel Blob client-direct-upload handshake.
//
// The browser calls @vercel/blob/client's `upload()` with this route as
// `handleUploadUrl`. That helper hits this endpoint twice: once to mint a
// short-lived upload token (`onBeforeGenerateToken`) and once after the
// upload completes (`onUploadCompleted`) so the server has a chance to
// record the URL.
//
// Bypassing the 4.5MB function payload limit is the whole point — the
// recording goes Browser → Vercel Blob direct, then our /api/record-to-workflow
// route fetches from the blob URL server-side and ships it to Gemini.
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request: req,
      // Restrict to the recording flow. Anything else (random filenames,
      // larger sizes, other content types) gets rejected before a token
      // is issued, so this can't be repurposed for general file hosting.
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("recordings/")) {
          throw new Error("Invalid upload path");
        }
        return {
          // `video/*` wildcard covers codec-extended MIMEs from MediaRecorder
          // (e.g. `video/webm;codecs=vp9,opus`) which strict matching rejects.
          allowedContentTypes: ["video/*"],
          // Hard cap. 60s of 600 kbps webm is comfortably under this; this
          // is just defence against unbounded uploads.
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
          // We don't need a callback URL or extra metadata for now — the
          // recording's blob URL is round-tripped through the client to
          // /api/record-to-workflow.
          tokenPayload: JSON.stringify({}),
        };
      },
      // No `onUploadCompleted` — we don't need a server-side notification
      // when the PUT finishes, and providing one auto-registers a callback
      // URL with Vercel Blob. The client posts the resulting blob URL to
      // /api/record-to-workflow on its next call, which is all we need.
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
