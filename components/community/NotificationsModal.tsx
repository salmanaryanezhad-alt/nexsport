"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDateJalali } from "@/lib/jalali";

type Item = {
  id: string;
  type?: string;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  created_at: string;
};

export function NotificationsModal({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/notifications/", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setItems(Array.isArray(d?.notifications) ? d.notifications : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open]);

  async function markAll() {
    await fetch("/api/notifications/", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    onChanged?.();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 sm:p-8 bg-ink/40 backdrop-blur-xs" dir="rtl">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="font-black text-sm text-slate-900">اعلان‌ها</h2>
            <p className="text-[11px] text-slate-500">پیام‌های سایت و نتایج مسابقاتی که دنبال می‌کنید</p>
          </div>
          <div className="flex items-center gap-2">
            {items.some((n) => !n.is_read) && (
              <button type="button" onClick={markAll} className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer">
                همه خوانده شد
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 cursor-pointer">
              ✕
            </button>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-3 space-y-2">
          {loading && <p className="text-xs text-slate-500 p-3">در حال بارگذاری…</p>}
          {!loading && items.length === 0 && (
            <p className="text-xs text-slate-500 p-4 text-center leading-relaxed">اعلانی ندارید.</p>
          )}
          {items.map((n) => {
            const inner = (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="font-black text-xs text-slate-900">{n.title}</div>
                  {n.type === "broadcast" && (
                    <span className="rounded-full bg-indigo-100 text-indigo-800 px-1.5 py-0.5 text-[9px] font-black">سایت</span>
                  )}
                </div>
                {n.body && <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed whitespace-pre-wrap">{n.body}</p>}
                <p className="text-[10px] text-slate-400 mt-1">
                  {n.created_at ? formatDateJalali(new Date(n.created_at)) : ""}
                </p>
              </>
            );
            const cls = `block rounded-xl border px-3 py-2.5 ${n.is_read ? "border-slate-100 bg-white" : "border-emerald-200 bg-emerald-50/60"}`;
            if (n.link) {
              return (
                <Link key={n.id} href={n.link} onClick={onClose} className={cls}>
                  {inner}
                </Link>
              );
            }
            return (
              <div key={n.id} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
