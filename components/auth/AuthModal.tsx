"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { NexSportIcon } from "@/components/NexSportLogo";

export function AuthModal() {
  const {
    isAuthModalOpen,
    modalTab,
    pendingEmail,
    demoVerificationCode,
    closeAuthModal,
    openAuthModal,
    login,
    register,
    verifyEmail,
    resendCode,
  } = useAuth();

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regMobile, setRegMobile] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // Verify form state
  const [verifyCodeVal, setVerifyCodeVal] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Common UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setSuccessMsg(null);
  }, [modalTab, isAuthModalOpen]);

  useEffect(() => {
    if (demoVerificationCode && modalTab === "verify") {
      setVerifyCodeVal(demoVerificationCode);
    }
  }, [demoVerificationCode, modalTab]);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  if (!isAuthModalOpen) return null;

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login(loginIdentifier, loginPassword);
      if (!res.success) {
        setError(res.error || "ورود ناموفق بود.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await register(regName, regEmail, regMobile, regPassword);
      if (!res.success) {
        setError(res.error || "ثبت‌نام با خطا مواجه شد.");
      } else {
        setResendCooldown(60);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingEmail) return;
    setError(null);
    setLoading(true);
    try {
      const res = await verifyEmail(pendingEmail, verifyCodeVal);
      if (!res.success) {
        setError(res.error || "کد تایید اشتباه است.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!pendingEmail || resendCooldown > 0) return;
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await resendCode(pendingEmail);
      if (res.success) {
        setSuccessMsg("کد تایید جدید ارسال شد.");
        setResendCooldown(60);
        if (res.demoCode) setVerifyCodeVal(res.demoCode);
      } else {
        setError(res.error || "خطا در ارسال مجدد.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-line overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line/60 bg-chalk/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <NexSportIcon size={24} />
            <span className="font-bold text-base text-pitch">حساب کاربری نکس‌پورت</span>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            className="rounded-lg p-1 text-ink/40 hover:bg-chalk hover:text-ink transition-colors"
            title="بستن پنجره"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher (Login vs Register) */}
        {modalTab !== "verify" && (
          <div className="flex border-b border-line bg-chalk/20">
            <button
              type="button"
              onClick={() => openAuthModal("login")}
              className={
                "flex-1 py-3 text-sm font-bold transition-all " +
                (modalTab === "login"
                  ? "border-b-2 border-pitch text-pitch bg-white"
                  : "text-ink/60 hover:text-ink")
              }
            >
              ورود به حساب
            </button>
            <button
              type="button"
              onClick={() => openAuthModal("register")}
              className={
                "flex-1 py-3 text-sm font-bold transition-all " +
                (modalTab === "register"
                  ? "border-b-2 border-pitch text-pitch bg-white"
                  : "text-ink/60 hover:text-ink")
              }
            >
              ثبت‌نام جدید
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
              <span>✓</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {modalTab === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1">
                  ایمیل یا شماره موبایل
                </label>
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="مثال: ali@example.com یا 09123456789"
                  className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm focus:border-pitch focus:outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1">
                  رمز عبور
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="رمز عبور خود را وارد کنید"
                  className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm focus:border-pitch focus:outline-none"
                  dir="ltr"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-pitch py-2.5 text-sm font-bold text-white shadow-sm hover:bg-pitch-light transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? "در حال بررسی..." : "ورود به حساب کاربری"}
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-ink/60">حساب کاربری ندارید؟ </span>
                <button
                  type="button"
                  onClick={() => openAuthModal("register")}
                  className="text-xs font-bold text-pitch hover:underline"
                >
                  ثبت‌نام رایگان
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {modalTab === "register" && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1">
                  نام و نام خانوادگی
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="مثال: علی رضایی"
                  className="w-full rounded-lg border border-line bg-white px-3.5 py-2 text-sm focus:border-pitch focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1">
                  آدرس ایمیل (جهت تایید هویت)
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-lg border border-line bg-white px-3.5 py-2 text-sm focus:border-pitch focus:outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1">
                  شماره موبایل
                </label>
                <input
                  type="tel"
                  required
                  value={regMobile}
                  onChange={(e) => setRegMobile(e.target.value)}
                  placeholder="09123456789"
                  className="w-full rounded-lg border border-line bg-white px-3.5 py-2 text-sm focus:border-pitch focus:outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1">
                  رمز عبور دلخواه
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="یک رمز عبور وارد کنید"
                  className="w-full rounded-lg border border-line bg-white px-3.5 py-2 text-sm focus:border-pitch focus:outline-none"
                  dir="ltr"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-pitch py-2.5 text-sm font-bold text-white shadow-sm hover:bg-pitch-light transition-colors disabled:opacity-50 cursor-pointer mt-1"
              >
                {loading ? "در حال ثبت‌نام..." : "ثبت‌نام و ارسال کد تایید"}
              </button>

              <div className="text-center pt-1">
                <span className="text-xs text-ink/60">قبلاً ثبت‌نام کرده‌اید؟ </span>
                <button
                  type="button"
                  onClick={() => openAuthModal("login")}
                  className="text-xs font-bold text-pitch hover:underline"
                >
                  ورود به حساب
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: VERIFY EMAIL */}
          {modalTab === "verify" && (
            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div className="text-center space-y-1">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-pitch/10 text-pitch text-2xl mb-1">
                  ✉️
                </div>
                <h3 className="font-bold text-sm text-pitch">تایید آدرس ایمیل</h3>
                <p className="text-xs text-ink/70 leading-relaxed">
                  کد تایید ۶ رقمی به آدرس <strong>{pendingEmail}</strong> ارسال شد. لطفاً آن را وارد فرمایید:
                </p>
              </div>

              {demoVerificationCode && (
                <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 text-xs text-amber-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <span>💡</span>
                    <span>کد تایید تستی (حالت ورسل / دمو):</span>
                  </div>
                  <p className="text-[11px] text-amber-900/90 leading-normal">
                    کد فعال‌سازی شما: <b className="font-mono text-sm bg-white px-2 py-0.5 rounded border border-amber-400">{demoVerificationCode}</b>
                  </p>
                  <p className="text-[10px] text-amber-800">
                    (برای ارسال واقعی به ایمیل، کافی است کلید Resend یا SMTP را در متغیرهای ورسل قرار دهید).
                  </p>
                </div>
              )}

              <div>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={verifyCodeVal}
                  onChange={(e) => setVerifyCodeVal(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.5em] font-mono text-xl font-bold rounded-lg border-2 border-pitch/40 bg-white py-2.5 focus:border-pitch focus:outline-none"
                  dir="ltr"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || verifyCodeVal.length < 6}
                className="w-full rounded-lg bg-pitch py-2.5 text-sm font-bold text-white shadow-sm hover:bg-pitch-light transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? "در حال بررسی..." : "تایید و ورود به سامانه"}
              </button>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className={
                    "font-bold transition-colors " +
                    (resendCooldown > 0
                      ? "text-ink/40 cursor-not-allowed"
                      : "text-pitch hover:underline cursor-pointer")
                  }
                >
                  {resendCooldown > 0
                    ? `ارسال مجدد (${resendCooldown} ثانیه)`
                    : "ارسال مجدد کد تایید"}
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal("register")}
                  className="text-ink/60 hover:underline"
                >
                  تغییر ایمیل / بازگشت
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
