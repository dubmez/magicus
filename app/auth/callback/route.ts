import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Supabase routes the user back here after Google OAuth with a short-lived
// `code` query param. We exchange it for a session (which Supabase's SSR
// helper writes into HttpOnly cookies), then bounce the user to the
// landing page where the canvas + storage hooks pick up the new session.
//
// On error we still redirect home; the user sees the sign-in modal again
// with no half-state. We surface the failure reason via a query param so
// the UI can show a helpful message.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL(`/?auth_error=missing_code`, req.url));
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const reason = encodeURIComponent(error.message || "exchange_failed");
    return NextResponse.redirect(new URL(`/?auth_error=${reason}`, req.url));
  }

  return NextResponse.redirect(new URL(next, req.url));
}
