import { type NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

// Chunked recording upload.
//
// The browser splits the recording into ~3.5MB chunks (well under Vercel's
// 4.5MB function body cap) and POSTs each one here. We forward the chunk
// to Vercel Blob using the server-side `put()` — this avoids the CORS
// problems we hit with `@vercel/blob/client`'s direct browser uploads.
//
// We keep chunks as separate blobs and stitch them together server-side
// in /api/record-to-workflow once the full recording is uploaded.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const sessionId = req.headers.get("x-session-id");
  const seqRaw = req.headers.get("x-chunk-seq");
  const contentType = req.headers.get("content-type") ?? "application/octet-stream";

  if (!sessionId || !/^[a-zA-Z0-9-]{8,64}$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }
  const seq = Number(seqRaw);
  if (!Number.isInteger(seq) || seq < 0 || seq > 999) {
    return NextResponse.json({ error: "Invalid chunk sequence" }, { status: 400 });
  }

  // The chunk lands as the raw request body — we read it as an ArrayBuffer
  // and hand it straight to the Blob `put()` helper.
  const buffer = await req.arrayBuffer();
  if (buffer.byteLength === 0) {
    return NextResponse.json({ error: "Empty chunk" }, { status: 400 });
  }
  // Defensive cap. Vercel's body limit will block bigger chunks first, but
  // belt-and-braces against a misbehaving client.
  if (buffer.byteLength > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Chunk too large" }, { status: 413 });
  }

  // Path layout: recordings/<session>/<padded-seq>.bin — padded so a
  // simple lex sort recovers chunk order downstream.
  const pathname = `recordings/${sessionId}/${String(seq).padStart(3, "0")}.bin`;

  try {
    const result = await put(pathname, buffer, {
      access: "public",
      contentType,
      // Each seq is unique per session; allow overwrites just so a retry
      // of the same chunk doesn't 409.
      allowOverwrite: true,
    });
    return NextResponse.json({ url: result.url, pathname: result.pathname });
  } catch (err) {
    console.error("[record-chunk] put failed", err);
    const msg = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
