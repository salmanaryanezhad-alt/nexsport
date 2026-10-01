"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { hasPersianLetters, shouldSkipAdminSensitiveReauth } from "@/lib/auth/utils";

export function AdminPasswordGate() {
  const {
    isAdmin,
    sensitiveUnlockTarget,
    closeSensitiveUnlock,
    unlockSensitiveAdmin,
  } = useAuth();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sensitiveUnlockTarget) {
      setPassword("");
      setError(null);
      setLoading(false);
    }
  }, [sensitiveUnlockTarget]);

  useEffect(() => {
    if (isAdmin && sensitiveUnlockTarget && shouldSkipAdminSensitiveReauth()) {
      unlockSensitiveAdmin();
    }
  }, [isAdmin, sensitiveUnlockTarget]);

  if (!isAdmin || !sensitiveUnlockTarget) return null;
  if (shouldSkipAdminSensitiveReauth()) return null;

  const title =
    sensitiveUnlockTarget === "pricing" ? "پلن‌های مالی" : "کدهای تخفیف";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError("رمز عبور را وارد نمایید.");
      return;
    }
    if (hasPersianLetters(password)) {
      setError("صفحه کلید را به انگلیسی تغییر دهید");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/confirm-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "رمز عبور وارد شده صحیح نیست.");
        return;
      }
      unlockSensitiveAdmin();
    } catch {
      setError("خطا در برقراری ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-in fade-in duration-200">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-line overflow-hidden text-right"
        dir="rtl"
      >
        <div className="flex items-center justify-between border-b border-line/70 bg-chalk/70 px-5 py-4">
          <div>
            <h3 className="font-black text-sm text-pitch">تایید هویت مدیر</h3>
            <p className="text-[11px] text-ink/60 mt-0.5">ورود به بخش {title}</p>
          </div>
          <button
            type="button"
            onClick={closeSensitiveUnlock}
            className="rounded-lg p-1.5 text-ink/40 hover:bg-chalk hover:text-ink cursor-pointer"
            title="انصراف"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-950 leading-relaxed">
            این بخش حساس است. فقط رمز عبور حساب مدیر را وارد کنید — نیازی به ایمیل نیست.
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              رمز عبور حساب کاربری
            </label>
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="رمز عبور را وارد کنید"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-pitch focus:outline-none dir-ltr text-right"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-800">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-pitch py-2.5 text-xs font-black text-white hover:bg-pitch-light shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? "در حال بررسی..." : "ورود به بخش"}
            </button>
            <button
              type="button"
              onClick={closeSensitiveUnlock}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              انصراف
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
