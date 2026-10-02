import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";
import { requireClubEditor, requireClubMember } from "@/lib/clubs/access";
import { sanitizeMemberRole } from "@/lib/clubs/validate";
import { canManageMembers, clubRoleLabel } from "@/lib/clubs/roles";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const auth = await requireClubMember(req, id);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error, expired: (auth as any).expired }, { status: auth.status });
    }
    if (auth.membership && auth.membership.status !== "active" && !auth.isAdmin) {
      return NextResponse.json({ error: "عضویت شما هنوز تأیید نشده است." }, { status: 403 });
    }
    const members = await db.listClubMembers(id);
    const showContact = canManageMembers(auth.membership?.role, auth.isAdmin);
    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        roleLabel: clubRoleLabel(m.role),
        status: m.status,
        name: m.name || "",
        email: showContact ? m.email || "" : "",
        mobile: showContact ? m.mobile || "" : "",
        createdAt: m.created_at instanceof Date ? m.created_at.toISOString() : m.created_at,
      })),
    });
  } catch (err) {
    console.error("[Club members GET]", err);
    return NextResponse.json({ error: "خطا در دریافت اعضا." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const auth = await requireClubEditor(req, id);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error, expired: (auth as any).expired }, { status: auth.status });
    }
    const body = await req.json().catch(() => ({}));
    const identifier = String(body.identifier || body.email || body.mobile || "").trim();
    if (!identifier) return NextResponse.json({ error: "ایمیل یا موبایل عضو را وارد کنید." }, { status: 400 });
    const role = sanitizeMemberRole(body.role);
    if (!role) return NextResponse.json({ error: "نقش نامعتبر است." }, { status: 400 });
    const target = await db.findUserByIdentifier(identifier);
    if (!target) return NextResponse.json({ error: "کاربری با این ایمیل یا موبایل یافت نشد." }, { status: 404 });
    if (target.id === auth.user.id) return NextResponse.json({ error: "نمی‌توانید خودتان را دعوت کنید." }, { status: 400 });
    const added = await db.addClubMember(id, target.id, role, "pending");
    if ("error" in added) return NextResponse.json({ error: added.error }, { status: 409 });
    return NextResponse.json({ success: true, message: `دعوت برای «${target.name}» ارسال شد.` });
  } catch (err) {
    console.error("[Club members POST]", err);
    return NextResponse.json({ error: "خطا در دعوت عضو." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const auth = await verifySessionRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error, expired: auth.expired }, { status: auth.status });
    }
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const memberId = String(body.memberId || "").trim();
    const members = await db.listClubMembers(id);
    const target = memberId ? members.find((m) => m.id === memberId) : members.find((m) => m.user_id === auth.user.id);
    if (!target) return NextResponse.json({ error: "عضویت یافت نشد." }, { status: 404 });

    if (action === "accept" || action === "decline") {
      if (target.user_id !== auth.user.id) {
        return NextResponse.json({ error: "فقط خود مدعو می‌تواند دعوت را پاسخ دهد." }, { status: 403 });
      }
      if (target.status !== "pending") {
        return NextResponse.json({ error: "این دعوت دیگر در انتظار نیست." }, { status: 400 });
      }
      if (action === "decline") {
        await db.removeClubMember(target.id);
        return NextResponse.json({ success: true, declined: true });
      }
      await db.updateClubMember(target.id, { status: "active" });
      return NextResponse.json({ success: true, accepted: true });
    }

    const editor = await requireClubEditor(req, id);
    if ("error" in editor) {
      return NextResponse.json({ error: editor.error, expired: (editor as any).expired }, { status: editor.status });
    }
    if (target.role === "owner") {
      return NextResponse.json({ error: "نقش مالک قابل تغییر نیست." }, { status: 400 });
    }
    if (action === "role") {
      const role = sanitizeMemberRole(body.role);
      if (!role) return NextResponse.json({ error: "نقش نامعتبر است." }, { status: 400 });
      await db.updateClubMember(target.id, { role });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "عملیات نامعتبر است." }, { status: 400 });
  } catch (err) {
    console.error("[Club members PATCH]", err);
    return NextResponse.json({ error: "خطا در به‌روزرسانی عضویت." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const auth = await requireClubEditor(req, id);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error, expired: (auth as any).expired }, { status: auth.status });
    }
    const memberId = String(req.nextUrl.searchParams.get("memberId") || "").trim();
    const members = await db.listClubMembers(id);
    const target = members.find((m) => m.id === memberId);
    if (!target) return NextResponse.json({ error: "عضو یافت نشد." }, { status: 404 });
    if (target.role === "owner") return NextResponse.json({ error: "مالک باشگاه قابل حذف نیست." }, { status: 400 });
    await db.removeClubMember(target.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Club members DELETE]", err);
    return NextResponse.json({ error: "خطا در حذف عضو." }, { status: 500 });
  }
}
