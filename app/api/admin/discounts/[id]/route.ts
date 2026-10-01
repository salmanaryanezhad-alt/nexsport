import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/auth/adminGuard";
import {
  mergeDiscountRecords,
  readDiscountCatalogCookie,
  writeDiscountCatalogCookie,
} from "@/lib/auth/discountCatalog";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdminRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = params;
    const body = await req.json();
    const { isActive } = body;

    let updated = await db.toggleDiscountCode(id, isActive);
    const catalog = readDiscountCatalogCookie(req);
    if (!updated) {
      const found = catalog.find((item) => item.id === id);
      if (found) {
        updated = {
          ...found,
          is_active: typeof isActive === "boolean" ? isActive : !found.is_active,
          updated_at: new Date(),
        };
      }
    }
    if (!updated) {
      return NextResponse.json(
        { error: "کد تخفیف مورد نظر یافت نشد." },
        { status: 404 }
      );
    }

    const discounts = mergeDiscountRecords(catalog, await db.listDiscountCodes(), [updated]);
    const response = NextResponse.json({
      success: true,
      discount: updated,
    });
    writeDiscountCatalogCookie(response, discounts);
    return response;
  } catch (err: any) {
    console.error("[Admin Discounts PATCH Error]", err);
    return NextResponse.json(
      { error: "خطا در تغییر وضعیت کد تخفیف." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdminRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = params;
    await db.deleteDiscountCode(id);
    const remaining = mergeDiscountRecords(
      readDiscountCatalogCookie(req).filter((item) => item.id !== id),
      (await db.listDiscountCodes()).filter((item) => item.id !== id)
    );
    const response = NextResponse.json({
      success: true,
      message: "کد تخفیف با موفقیت حذف گردید.",
    });
    writeDiscountCatalogCookie(response, remaining);
    return response;
  } catch (err: any) {
    console.error("[Admin Discounts DELETE Error]", err);
    return NextResponse.json(
      { error: "خطا در حذف کد تخفیف." },
      { status: 500 }
    );
  }
}
