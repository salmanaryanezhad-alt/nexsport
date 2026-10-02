"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { toPersianDigits } from "@/lib/digits";

type RegistrationItem = {
  id: string;
  team_name: string;
  short_name: string;
  city: string;
  coach: string;
  contact_name: string;
  mobile: string;
  notes: string;
  status: "pending" | "approved" | "rejected";
  reject_reason: string;
  roster: Array<{ name: string; jersey_number: string; position: string; national_id?: string }>;
  created_at: string;
};

export function RegistrationModal({
  isOpen,
  onClose,
  tournamentId,
  tournamentTitle,
  onEnsureSaved,
  onInsertApprovedNames,
}: {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string | null;
  tournamentTitle: string;
  onEnsureSaved: () => Promise<string | null>;
  onInsertApprovedNames?: (names: string[]) => void;
}) {
  const { user, openAuthModal } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(tournamentId);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isOpenReg, setIsOpenReg] = useState(true);
  const [capacity, setCapacity] = useState(8);
  const [approved, setApproved] = useState(0);
  const [items, setItems] = useState<RegistrationItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadList = useCallback(async (id: string) => {
    const res = await fetch(`/api/tournaments/${id}/registrations/`, { credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "خطا در دریافت ثبت‌نام‌ها.");
    setReady(true);
    setIsOpenReg(data.settings?.isOpen !== false);
    setCapacity(Number(data.settings?.capacity) || 8);
    setApproved(Number(data.approved) || 0);
    setItems(Array.isArray(data.registrations) ? data.registrations : []);
  }, []);

  useEffect(() => {
    setActiveId(tournamentId);
  }, [tournamentId]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setCopied(false);
    setReady(false);
    if (!user) return;
    if (!activeId) return;
    (async () => {
      setLoading(true);
      try {
        await loadList(activeId);
      } catch (e: any) {
        setError(e?.message || "خطا در آماده‌سازی لینک ثبت‌نام.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, user, activeId, loadList]);

  if (!isOpen) return null;

  const remaining = Math.max(0, capacity - approved);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://nexsport.ir";
  const shareUrl = activeId ? `${baseUrl}/r/${activeId}` : "";

  async function saveSettings(next: { isOpen?: boolean; capacity?: number }) {
    if (!activeId) return;
    const res = await fetch(`/api/tournaments/${activeId}/registrations/`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "ذخیره تنظیمات ناموفق بود.");
      return;
    }
    if (typeof next.isOpen === "boolean") setIsOpenReg(next.isOpen);
    if (typeof next.capacity === "number") setCapacity(next.capacity);
  }

  async function setStatus(id: string, status: "approved" | "rejected" | "pending") {
    if (!activeId) return;
    const reason = status === "rejected" ? window.prompt("دلیل رد (اختیاری):") || "" : "";
    const res = await fetch(`/api/tournaments/${activeId}/registrations/${id}/`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reject_reason: reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "تغییر وضعیت ناموفق بود.");
      return;
    }
    await loadList(activeId);
  }

  const statusLabel: Record<string, string> = { pending: "در انتظار", approved: "تأییدشده", rejected: "رد شده" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-violet-50 via-white to-white px-5 py-4">
          <div>
            <h2 className="font-black text-sm sm:text-base text-slate-900">لینک ثبت‌نام تیم‌ها</h2>
            <p className="text-[11px] text-slate-500 truncate max-w-[280px]">{tournamentTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <div className="p-5 space-y-4 text-xs overflow-y-auto">
          {!user && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-2">
              <p className="font-black text-amber-950">برای ساخت لینک ثبت‌نام وارد حساب شوید.</p>
              <button type="button" onClick={() => { onClose(); openAuthModal("login"); }} className="rounded-xl bg-emerald-600 px-4 py-2 font-black text-white">ورود / ثبت‌نام</button>
            </div>
          )}
          {user && loading && <p className="text-center py-8 font-bold text-slate-600">در حال آماده‌سازی...</p>}
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 font-bold text-rose-800">{error}</div>}

          {user && !loading && !activeId && (
            <button
              type="button"
              onClick={async () => {
                const id = await onEnsureSaved();
                if (id) setActiveId(id);
                else setError("ذخیره مسابقه ناموفق بود.");
              }}
              className="w-full rounded-2xl bg-violet-700 py-3 font-black text-white"
            >
              ذخیره مسابقه و نمایش لینک ثبت‌نام
            </button>
          )}

          {user && !loading && activeId && ready && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                <p className="font-black text-emerald-950">لینک ثبت‌نام فعال است</p>
                <div className="flex gap-2">
                  <input readOnly value={shareUrl} className="flex-1 rounded-xl border border-emerald-200 bg-white px-3 py-2 font-mono text-[11px] dir-ltr" />
                  <button type="button" onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="rounded-xl bg-emerald-700 px-3 py-2 font-black text-white">
                    {copied ? "کپی شد" : "کپی"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black">ثبت‌نام باز است</span>
                  <button type="button" onClick={() => saveSettings({ isOpen: !isOpenReg })} className={`rounded-full px-3 py-1 font-black ${isOpenReg ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                    {isOpenReg ? "باز" : "بسته"}
                  </button>
                </div>
                <label className="block font-bold text-slate-700">
                  ظرفیت مسابقه
                  <input type="number" min={2} max={128} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} onBlur={() => saveSettings({ capacity })} className="mt-1 w-28 rounded-xl border border-slate-200 px-2 py-1 font-black" />
                </label>
                <p className="text-slate-500">تأییدشده: {toPersianDigits(approved)} از {toPersianDigits(capacity)} — باقی‌مانده: {toPersianDigits(remaining)}</p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onInsertApprovedNames?.(items.filter((i) => i.status === "approved").map((i) => i.team_name))}
                  className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 font-black text-violet-900"
                >
                  درج تأییدشده‌ها در فهرست اسامی
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="font-black">درخواست‌های ثبت‌نام ({toPersianDigits(items.length)})</h3>
                {items.length === 0 && <p className="text-slate-500">هنوز تیمی ثبت‌نام نکرده است.</p>}
                {items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black">{item.team_name}</p>
                        <p className="text-[11px] text-slate-500">{item.city || "—"} • {item.contact_name || "مسئول"} • {item.mobile}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${item.status === "approved" ? "bg-emerald-50 text-emerald-800" : item.status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>
                        {statusLabel[item.status]}
                      </span>
                    </div>
                    <button type="button" className="text-[11px] font-bold text-violet-700" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                      {expandedId === item.id ? "بستن فهرست بازیکنان" : `بازیکنان (${toPersianDigits(item.roster?.length || 0)})`}
                    </button>
                    {expandedId === item.id && (
                      <ul className="text-[11px] space-y-1 bg-slate-50 rounded-lg p-2">
                        {(item.roster || []).map((p, i) => (
                          <li key={i}>{p.jersey_number ? `#${toPersianDigits(p.jersey_number)} ` : ""}{p.name}{p.position ? ` — ${p.position}` : ""}</li>
                        ))}
                      </ul>
                    )}
                    <div className="flex gap-2">
                      {item.status !== "approved" && (
                        <button type="button" onClick={() => setStatus(item.id, "approved")} className="rounded-lg bg-emerald-600 px-2 py-1 font-black text-white">تأیید</button>
                      )}
                      {item.status !== "rejected" && (
                        <button type="button" onClick={() => setStatus(item.id, "rejected")} className="rounded-lg bg-rose-50 px-2 py-1 font-black text-rose-700">رد</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
