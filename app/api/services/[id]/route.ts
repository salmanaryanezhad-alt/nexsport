import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";
import { sanitizeServiceListingInput } from "@/lib/community/validate";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const listing = await db.getServiceListing(id);
    if (!listing) {
      return NextResponse.json({ error: "این آگهی یافت نشد." }, { status: 404 });
    }
    const auth = await verifySessionRequest(req);
    const isOwner = !("error" in auth) && (auth.user.id === listing.user_id || auth.isAdmin);
    if (!listing.is_active && !isOwner) {
      return NextResponse.json({ error: "این آگهی یافت نشد." }, { status: 404 });
    }
    const pin = await db.getActiveCommunityPromo("listing_pin", id);
    return NextResponse.json({
      listing: {
        ...listing,
        created_at: listing.created_at.toISOString(),
        updated_at: listing.updated_at.toISOString(),
      },
      featuredUntil: pin?.expires_at?.toISOString() || null,
      isOwner: Boolean(isOwner),
    });
  } catch (err) {
    console.error("[Service GET]", err);
    return NextResponse.json({ error: "خطا در دریافت آگهی." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const auth = await verifySessionRequest(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await req.json().catch(() => ({}));
    if (typeof body.is_active === "boolean" && Object.keys(body).length === 1) {
      const updated = await db.updateServiceListing(id, auth.user.id, { is_active: body.is_active }, auth.isAdmin);
      if (!updated) return NextResponse.json({ error: "آگهی یافت نشد." }, { status: 404 });
      return NextResponse.json({ success: true, listing: updated });
    }
    const parsed = sanitizeServiceListingInput(body || {});
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const updated = await db.updateServiceListing(id, auth.user.id, parsed.data, auth.isAdmin);
    if (!updated) return NextResponse.json({ error: "آگهی یافت نشد." }, { status: 404 });
    return NextResponse.json({ success: true, listing: updated });
  } catch (err) {
    console.error("[Service PATCH]", err);
    return NextResponse.json({ error: "خطا در ویرایش آگهی." }, { status: 500 });
  }
}
