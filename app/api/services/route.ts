import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";
import { sanitizeServiceListingInput } from "@/lib/community/validate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const q = String(sp.get("q") || "").trim();
    const category = String(sp.get("category") || "").trim();
    const mine = sp.get("mine") === "1";
    let userId: string | undefined;
    if (mine) {
      const auth = await verifySessionRequest(req);
      if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
      userId = auth.user.id;
    }
    const listings = await db.listServiceListings({
      query: q,
      category: category || undefined,
      userId,
      includeInactive: Boolean(userId),
      limit: 40,
    });
    return NextResponse.json({
      success: true,
      listings: listings.map((s) => ({
        ...s,
        created_at: s.created_at.toISOString(),
        updated_at: s.updated_at.toISOString(),
        mobile: userId && s.user_id === userId ? s.mobile : s.mobile,
      })),
    });
  } catch (err) {
    console.error("[Services GET]", err);
    return NextResponse.json({ error: "خطا در دریافت خدمات." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifySessionRequest(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await req.json().catch(() => ({}));
    const parsed = sanitizeServiceListingInput(body || {});
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const created = await db.createServiceListing(auth.user.id, parsed.data);
    return NextResponse.json({ success: true, listing: created });
  } catch (err) {
    console.error("[Services POST]", err);
    return NextResponse.json({ error: "خطا در ثبت خدمت." }, { status: 500 });
  }
}
