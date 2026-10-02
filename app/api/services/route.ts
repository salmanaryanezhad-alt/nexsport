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
      limit: 80,
    });
    const pins = await db.listActiveCommunityPromos("listing_pin");
    const feat = new Map(pins.map((p) => [p.target_id, p.expires_at.toISOString()]));
    const sorted = [...listings].sort((a, b) => Number(feat.has(b.id)) - Number(feat.has(a.id)));
    return NextResponse.json({
      success: true,
      listings: sorted.slice(0, 40).map((s) => ({
        ...s,
        created_at: s.created_at.toISOString(),
        updated_at: s.updated_at.toISOString(),
        featuredUntil: feat.get(s.id) || null,
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
    const pricing = await db.getPricingSettings();
    const quota = await db.getUserQuota(auth.user.id);
    const activeCount = await db.countActiveServiceListings(auth.user.id);
    const clubIntroFree = Boolean(quota.isClubPro && parsed.data.category === "club_intro");
    const withinFree = activeCount < pricing.freeServiceListings;
    const isActive = Boolean(auth.isAdmin || clubIntroFree || withinFree);
    const created = await db.createServiceListing(auth.user.id, { ...parsed.data, is_active: isActive });
    return NextResponse.json({
      success: true,
      listing: created,
      needsSlotPayment: !isActive,
      quote: {
        priceTomans: pricing.extraListingPriceTomans,
        creditCost: pricing.extraListingCreditCost,
      },
    });
  } catch (err) {
    console.error("[Services POST]", err);
    return NextResponse.json({ error: "خطا در ثبت خدمت." }, { status: 500 });
  }
}
