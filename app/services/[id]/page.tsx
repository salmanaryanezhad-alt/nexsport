"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CommunityChrome } from "@/components/community/CommunityChrome";
import { serviceCategoryMeta } from "@/lib/community/catalog";
import { toPersianDigits } from "@/lib/digits";
import { useAuth } from "@/components/auth/AuthContext";

export default function ServiceDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { user } = useAuth();
  const [listing, setListing] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/services/${id}/`, { credentials: "same-origin" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "آگهی یافت نشد.");
    setListing(json.listing);
  }

  useEffect(() => {
    if (!id) return;
    load().catch((e) => setError(e.message));
  }, [id]);

  const meta = serviceCategoryMeta(listing?.category);
  const isOwner = Boolean(user && listing && user.id === listing.user_id);

  async function deactivate() {
    setBusy(true);
    try {
      await fetch(`/api/services/${id}/`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <CommunityChrome subtitle={meta.label}>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-800">{error}</div>}
      {!listing && !error && <p className="text-sm font-bold text-slate-500">در حال بارگذاری…</p>}
      {listing && (
        <div className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-card space-y-4">
          <p className="text-[11px] font-black text-amber-700">
            {meta.icon} {meta.label}
          </p>
          <h1 className="text-2xl font-black">{listing.title}</h1>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{listing.body}</p>
          <div className="text-xs text-slate-500 space-y-1">
            {listing.city && <p>شهر: {listing.city}</p>}
            {listing.sport && <p>رشته: {listing.sport}</p>}
            {listing.owner_name && <p>ثبت‌کننده: {listing.owner_name}</p>}
            {listing.contact_name && <p>رابط: {listing.contact_name}</p>}
            {listing.mobile && (
              <p dir="ltr" className="text-right font-mono">
                {toPersianDigits(listing.mobile)}
              </p>
            )}
          </div>
          {isOwner && listing.is_active && (
            <button
              type="button"
              disabled={busy}
              onClick={deactivate}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 cursor-pointer"
            >
              غیرفعال‌سازی آگهی
            </button>
          )}
        </div>
      )}
    </CommunityChrome>
  );
}
