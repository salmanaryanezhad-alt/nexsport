"use client";

import React, { useState, useEffect } from "react";
import { NexSportIcon } from "@/components/NexSportLogo";
import { useAuth } from "@/components/auth/AuthContext";

interface ShareTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string | null;
  tournamentTitle: string;
  onEnsureSaved: () => Promise<string | null>;
}

export function ShareTournamentModal({
  isOpen,
  onClose,
  tournamentId,
  tournamentTitle,
  onEnsureSaved,
}: ShareTournamentModalProps) {
  const { user, openAuthModal } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(tournamentId);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareTextCopied, setShareTextCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(tournamentId);
  }, [tournamentId]);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setShareTextCopied(false);
      setError(null);

      // If user is logged in but tournament doesn't have an ID yet, auto-save to get ID
      if (!activeId && user) {
        handleAutoSave();
      }
    }
  }, [isOpen, user, activeId]);

  async function handleAutoSave() {
    setLoading(true);
    setError(null);
    try {
      const newId = await onEnsureSaved();
      if (newId) {
        setActiveId(newId);
      } else {
        setError("خطا در ایجاد لینک اختصاصی. لطفاً دوباره تلاش فرمایید.");
      }
    } catch {
      setError("خطا در برقراری ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://nexsport.ir";
  const shareUrl = activeId ? `${baseUrl}/t/${activeId}` : "";
  const displayTitle = tournamentTitle || "مسابقات ورزشی";

  const messageText = `🏆 برنامه و جدول زنده مسابقات «${displayTitle}» در NexSport:\n${shareUrl}\n\nجهت مشاهده زمان مسابقات، جدول رده‌بندی و مراحل حذفی روی لینک بالا کلیک کنید.`;

  async function handleCopyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
    }
  }

  async function handleCopyFullMessage() {
    if (!messageText) return;
    try {
      await navigator.clipboard.writeText(messageText);
      setShareTextCopied(true);
      setTimeout(() => setShareTextCopied(false), 2500);
    } catch {
      setShareTextCopied(true);
    }
  }

  function handleShareWhatsApp() {
    if (!shareUrl) return;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
    window.open(url, "_blank");
  }

  function handleShareTelegram() {
    if (!shareUrl) return;
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`🏆 برنامه و جدول رده‌بندی مسابقات «${displayTitle}»`)}`;
    window.open(url, "_blank");
  }

  function handleShareSms() {
    if (!shareUrl) return;
    const url = `sms:?body=${encodeURIComponent(messageText)}`;
    window.open(url, "_self");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <span className="text-xl">🔗</span>
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base text-slate-900">
                ایجاد لینک اختصاصی مسابقات
              </h2>
              <p className="text-[11px] text-slate-500 truncate max-w-[280px]">
                {displayTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            title="بستن"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Case 1: User is not logged in */}
          {!user && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <span className="text-xl">🔐</span>
                <div className="space-y-1">
                  <h4 className="font-black text-xs text-amber-950">
                    ورود به حساب برای ایجاد لینک اختصاصی
                  </h4>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    برای اینکه لینک اختصاصی مسابقه شما دائمی باشد و نتایج ثبت‌شده به صورت خودکار به بینندگان نمایش داده شود، لطفاً وارد حساب خود شوید (یا در کمتر از ۳۰ ثانیه ثبت‌نام کنید).
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-3 py-1.5 font-bold text-slate-600 hover:bg-white transition-all cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openAuthModal("login");
                  }}
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-black text-white hover:bg-emerald-700 shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>ورود / ثبت‌نام سریع</span>
                  <span>←</span>
                </button>
              </div>
            </div>
          )}

          {/* Case 2: Loading State */}
          {user && loading && (
            <div className="py-8 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 rounded-full border-3 border-emerald-600 border-t-transparent animate-spin" />
              <p className="text-xs font-bold text-slate-700">
                در حال ذخیره‌سازی و ساخت لینک اختصاصی مسابقات...
              </p>
            </div>
          )}

          {/* Case 3: Error State */}
          {user && !loading && error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 space-y-2">
              <p className="font-bold">{error}</p>
              <button
                type="button"
                onClick={handleAutoSave}
                className="rounded-lg bg-rose-600 text-white font-bold px-3 py-1.5 text-xs hover:bg-rose-700 cursor-pointer"
              >
                تلاش مجدد
              </button>
            </div>
          )}

          {/* Case 4: Link Ready */}
          {user && !loading && activeId && (
            <div className="space-y-4">
              {/* Short Link Display Box */}
              <div>
                <label className="block font-black text-slate-800 text-xs mb-1.5">
                  آدرس اختصاصی صفحه مسابقات شما:
                </label>
                <div className="flex items-center gap-2 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/30 p-2 focus-within:border-emerald-600 transition-all">
                  <span className="text-base px-1">🌐</span>
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="w-full bg-transparent font-mono text-xs sm:text-sm font-bold text-emerald-950 focus:outline-none dir-ltr selection:bg-emerald-200"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1 ${
                      copied
                        ? "bg-emerald-700 text-white"
                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                    }`}
                  >
                    <span>{copied ? "✓" : "📋"}</span>
                    <span>{copied ? "کپی شد!" : "کپی لینک"}</span>
                  </button>
                </div>
              </div>

              {/* View Live Button */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <a
                  href={`/t/${activeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                >
                  <span>👁️ مشاهده صفحه از دید تماشاگران</span>
                  <span className="dir-ltr">↗</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyFullMessage}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-all cursor-pointer"
                  title="کپی متن کامل پیام همراه با توضیحات جهت ارسال در پیام‌رسان‌ها"
                >
                  <span>{shareTextCopied ? "✓ متن کپی شد" : "📝 کپی پیام آماده"}</span>
                </button>
              </div>

              {/* Share Channels */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="text-[11px] font-black text-slate-500 block">
                  ارسال مستقیم به پیام‌رسان‌ها:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100 p-2.5 text-xs font-black text-emerald-900 transition-all cursor-pointer"
                  >
                    <span>💬</span>
                    <span>واتس‌اپ</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareTelegram}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50/80 hover:bg-sky-100 p-2.5 text-xs font-black text-sky-900 transition-all cursor-pointer"
                  >
                    <span>✈️</span>
                    <span>تلگرام</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareSms}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 p-2.5 text-xs font-black text-slate-800 transition-all cursor-pointer"
                  >
                    <span>📱</span>
                    <span>پیامک</span>
                  </button>
                </div>
              </div>

              {/* Security & Access Features Banner */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200/90 p-3.5 text-[11px] space-y-2 leading-relaxed text-slate-600">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <div>
                    <strong className="text-slate-900">حالت اختصاصی فقط مشاهده:</strong>{" "}
                    بازیکنان، داوران و تماشاگران بدون نیاز به ثبت‌نام می‌توانند کل برنامه مسابقات، جداول رده‌بندی زنده و براکت‌ها را تا فینال ببینند؛ اما دکمه‌ها و فیلدهای ثبت نتیجه برای آن‌ها کاملاً مخفی و غیرفعال است.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <div>
                    <strong className="text-slate-900">محافظت حریم خصوصی و سئو (Noindex):</strong>{" "}
                    این لینک اختصاصی با متاتگ‌های امنیتی noindex و nofollow محافظت شده و در نتایج گوگل ایندکس نخواهد شد تا در صورت پاک کردن یا اتمام مسابقه، هیچ لینک شکسته‌ای به وجود نیاید.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
}
