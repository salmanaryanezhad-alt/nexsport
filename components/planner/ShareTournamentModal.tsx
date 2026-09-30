"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { toPersianDigits } from "@/lib/digits";
import { DEDICATED_LINK_PRICE_TOMANS } from "@/lib/payment/types";

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
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [justPaidSuccess, setJustPaidSuccess] = useState(false);
  const [refId, setRefId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareTextCopied, setShareTextCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(tournamentId);
  }, [tournamentId]);

  const checkPaymentStatus = useCallback(async (id: string) => {
    setCheckingPayment(true);
    setError(null);
    try {
      const res = await fetch(`/api/tournaments/${id}/payment-status`);
      if (res.ok) {
        const data = await res.json();
        setIsPaid(Boolean(data.isPaid));
        if (data.paymentInfo?.refId) {
          setRefId(data.paymentInfo.refId);
        }
      } else {
        // Fallback default
        setIsPaid(false);
      }
    } catch {
      setIsPaid(false);
    } finally {
      setCheckingPayment(false);
    }
  }, []);

  const handleAutoSave = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const newId = await onEnsureSaved();
      if (newId) {
        setActiveId(newId);
        await checkPaymentStatus(newId);
      } else {
        setError("خطا در ایجاد شناسه مسابقه. لطفاً دوباره تلاش فرمایید.");
      }
    } catch {
      setError("خطا در برقراری ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  }, [onEnsureSaved, checkPaymentStatus]);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setShareTextCopied(false);
      setJustPaidSuccess(false);
      setError(null);

      if (user) {
        if (activeId) {
          checkPaymentStatus(activeId);
        } else {
          handleAutoSave();
        }
      }
    }
  }, [isOpen, user, activeId, checkPaymentStatus, handleAutoSave]);

  if (!isOpen) return null;

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://nexsport.ir";
  const shareUrl = activeId ? `${baseUrl}/t/${activeId}` : "";
  const displayTitle = tournamentTitle || "مسابقات ورزشی";

  const messageText = `🏆 برنامه و جدول زنده مسابقات «${displayTitle}» در NexSport:\n${shareUrl}\n\nجهت مشاهده زمان مسابقات، جدول رده‌بندی زنده و مراحل حذفی روی لینک اختصاصی بالا کلیک کنید.`;

  async function handleCopyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
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

  function handleShareEitaa() {
    if (!shareUrl) return;
    const url = `https://eitaa.com/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(messageText)}`;
    window.open(url, "_blank");
  }

  function handleShareBale() {
    if (!shareUrl) return;
    const url = `https://ble.ir/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(messageText)}`;
    window.open(url, "_blank");
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

  /**
   * Handle Payment & Link Activation
   * Calls /api/payment/create which connects to payment driver.
   * If mock gateway (current default), activates instantly without redirect.
   * If real gateway (e.g. ZarinPal), redirects to payment gateway URL.
   */
  async function handleProcessPayment() {
    if (!activeId) {
      await handleAutoSave();
      return;
    }

    setPaymentLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: activeId }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "خطا در پردازش پرداخت.");
      }

      // If mock or direct simulated success
      if (data.isDirectSuccess || data.isPaid) {
        setIsPaid(true);
        setJustPaidSuccess(true);
        if (data.refId) {
          setRefId(data.refId);
        }
      } else if (data.paymentUrl) {
        // Real payment gateway redirect (ZarinPal, IDPay, etc.)
        window.location.href = data.paymentUrl;
      }
    } catch (err: any) {
      setError(err?.message || "خطا در ثبت پرداخت و فعال‌سازی لینک اختصاصی.");
    } finally {
      setPaymentLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-white px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <span className="text-xl">🔗</span>
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base text-slate-900">
                {isPaid ? "لینک اختصاصی مسابقات" : "فعال‌سازی لینک اختصاصی"}
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

        {/* Modal Scrollable Body */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto">
          {/* Case 1: User is not logged in */}
          {!user && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <span className="text-xl">🔐</span>
                <div className="space-y-1">
                  <h4 className="font-black text-xs text-amber-950">
                    ورود به حساب برای ایجاد و فعال‌سازی لینک
                  </h4>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    برای اینکه لینک اختصاصی مسابقه شما دائمی باشد، نتایج ثبت‌شده به صورت خودکار به تماشاگران نمایش داده شود و پرداخت شما ثبت گردد، لطفاً ابتدا وارد حساب خود شوید (یا ثبت‌نام سریع کنید).
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

          {/* Case 2: Auto-saving or Checking status */}
          {user && (loading || checkingPayment) && (
            <div className="py-8 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 rounded-full border-3 border-emerald-600 border-t-transparent animate-spin" />
              <p className="text-xs font-bold text-slate-700">
                در حال بررسی وضعیت مسابقه و لینک اختصاصی...
              </p>
            </div>
          )}

          {/* Case 3: Error Banner */}
          {user && !loading && !checkingPayment && error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 space-y-2">
              <p className="font-bold">{error}</p>
              <button
                type="button"
                onClick={activeId ? handleProcessPayment : handleAutoSave}
                className="rounded-lg bg-rose-600 text-white font-bold px-3 py-1.5 text-xs hover:bg-rose-700 cursor-pointer"
              >
                تلاش مجدد
              </button>
            </div>
          )}

          {/* Case 4: Tournament is NOT PAID YET -> Show 200,000 Tomans Payment & Checkout Box */}
          {user && !loading && !checkingPayment && !isPaid && (
            <div className="space-y-4">
              {/* Order Invoice Summary Card */}
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/60 to-white p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
                  <span className="font-bold text-slate-700">عنوان خدمت:</span>
                  <span className="font-black text-slate-900">
                    فعال‌سازی لینک اختصاصی و صفحه زنده مسابقات
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
                  <span className="font-bold text-slate-700">مدت اعتبار:</span>
                  <span className="font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-lg text-[11px]">
                    دائمی و نامحدود (بدون انقضا)
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="font-black text-slate-800 text-xs sm:text-sm">
                    مبلغ قابل پرداخت:
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-black text-lg sm:text-xl text-emerald-700">
                      {toPersianDigits(
                        DEDICATED_LINK_PRICE_TOMANS.toLocaleString("en-US")
                      )}
                    </span>
                    <span className="font-bold text-slate-600 text-xs">تومان</span>
                  </div>
                </div>
              </div>

              {/* What the organizer gets */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5 text-slate-700">
                <span className="block font-black text-slate-900 text-xs">
                  امکاناتی که با فعال‌سازی لینک اختصاصی دریافت می‌کنید:
                </span>

                <div className="space-y-2 text-[11px] leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold shrink-0 text-sm">🔗</span>
                    <div>
                      <strong className="text-slate-900">لینک اختصاصی کوتاه:</strong> دریافت آدرس کوتاه منحصربه‌فرد (مانند <span className="font-mono dir-ltr text-emerald-800 font-bold">nexsport.ir/t/...</span>) برای ارائه به تیم‌ها، داوران و تماشاگران.
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold shrink-0 text-sm">👁️</span>
                    <div>
                      <strong className="text-slate-900">صفحه ویژه تماشاگران (فقط مشاهده):</strong> تماشاگران و شرکت‌کنندگان تمام برنامه، نتایج، جدول رده‌بندی زنده و براکت‌ها تا فینال را بدون دسترسی ویرایش مشاهده می‌کنند.
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold shrink-0 text-sm">⚡</span>
                    <div>
                      <strong className="text-slate-900">همگام‌سازی لحظه‌ای:</strong> هر نتیجه یا تغییری که شما ثبت کنید، بلافاصله روی صفحه تماشاگران بازتاب می‌یابد.
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold shrink-0 text-sm">📲</span>
                    <div>
                      <strong className="text-slate-900">اشتراک‌گذاری ۱-کلیکی:</strong> ابزار اشتراک مستقیم در ایتا، بله، تلگرام، واتس‌اپ و پیامک همراه با QR Code.
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold shrink-0 text-sm">🛡️</span>
                    <div>
                      <strong className="text-slate-900">سئوی ایمن (NoIndex):</strong> صفحه مسابقه در گوگل ایندکس نمی‌شود تا در صورت حذف احتمالی مسابقه توسط شما، هیچ لینک شکسته ۴۰۴ به سئوی سایت آسیب نزند.
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Payment Button */}
              <div className="pt-1 space-y-2">
                <button
                  type="button"
                  disabled={paymentLoading}
                  onClick={handleProcessPayment}
                  className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 py-3.5 px-4 text-white font-black text-sm sm:text-base shadow-lg shadow-emerald-700/20 hover:from-emerald-700 hover:to-teal-800 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {paymentLoading ? (
                    <>
                      <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>در حال تایید پرداخت و فعال‌سازی...</span>
                    </>
                  ) : (
                    <>
                      <span>💳</span>
                      <span>
                        پرداخت {toPersianDigits(DEDICATED_LINK_PRICE_TOMANS.toLocaleString("en-US"))} تومان و فعال‌سازی لینک
                      </span>
                    </>
                  )}
                </button>

                <p className="text-center text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
                  <span>🔒</span>
                  <span>
                    پرداخت امن | فعال‌سازی لینک به محض ثبت تایید می‌شود
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Case 5: Tournament IS PAID -> Reveal Short Link & Share Options */}
          {user && !loading && !checkingPayment && isPaid && (
            <div className="space-y-4">
              {/* Success celebration banner if just paid */}
              {justPaidSuccess && (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3.5 text-emerald-950 space-y-1 shadow-xs animate-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-2 font-black text-xs text-emerald-900">
                    <span className="text-lg">🎉</span>
                    <span>پرداخت با موفقیت انجام و لینک اختصاصی فعال شد!</span>
                  </div>
                  {refId && (
                    <p className="text-[11px] text-emerald-800">
                      کد پیگیری تراکنش: <strong className="font-mono dir-ltr">{toPersianDigits(refId)}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* Status Badge */}
              <div className="flex items-center justify-between rounded-xl bg-emerald-50/70 border border-emerald-200/80 px-3 py-2">
                <span className="font-bold text-slate-700 text-[11px]">
                  وضعیت لینک اختصاصی:
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-black text-xs bg-emerald-100/80 px-2.5 py-0.5 rounded-lg">
                  <span>✓</span>
                  <span>فعال و پرداخت‌شده (۲۰۰,۰۰۰ تومان)</span>
                </span>
              </div>

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

              {/* View Live Button & Quick Copy Message */}
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
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={handleShareEitaa}
                    className="flex items-center justify-center gap-1 rounded-xl border border-amber-300 bg-amber-50/80 hover:bg-amber-100 p-2 text-xs font-black text-amber-900 transition-all cursor-pointer"
                  >
                    <span>🔶</span>
                    <span>ایتا</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareBale}
                    className="flex items-center justify-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100 p-2 text-xs font-black text-emerald-900 transition-all cursor-pointer"
                  >
                    <span>🟢</span>
                    <span>بله</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="flex items-center justify-center gap-1 rounded-xl border border-teal-300 bg-teal-50/80 hover:bg-teal-100 p-2 text-xs font-black text-teal-900 transition-all cursor-pointer"
                  >
                    <span>💬</span>
                    <span>واتس‌اپ</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareTelegram}
                    className="flex items-center justify-center gap-1 rounded-xl border border-sky-300 bg-sky-50/80 hover:bg-sky-100 p-2 text-xs font-black text-sky-900 transition-all cursor-pointer"
                  >
                    <span>✈️</span>
                    <span>تلگرام</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareSms}
                    className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 p-2 text-xs font-black text-slate-800 transition-all cursor-pointer"
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
                    <strong className="text-slate-900">حالت فقط مشاهده تماشاگران:</strong>{" "}
                    تماشاگران، بازیکنان و داوران می‌توانند کل برنامه مسابقات، جداول رده‌بندی زنده و براکت‌ها را تا فینال ببینند؛ فیلدها و دکمه‌های ثبت نتیجه برای آن‌ها کاملاً مخفی و مسدود است.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <div>
                    <strong className="text-slate-900">سئوی ایمن و بدون ایندکس (NoIndex):</strong>{" "}
                    این لینک با تگ‌های امنیتی noindex و nofollow محافظت شده تا در صورت حذف یا ویرایش مسابقه توسط شما، هیچ خطای ۴۰۴ در گوگل ثبت نشود.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 shrink-0">
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
