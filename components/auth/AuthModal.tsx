"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { NexSportIcon } from "@/components/NexSportLogo";

export function AuthModal() {
  const {
    isAuthModalOpen,
    modalTab,
    pendingEmail,
    closeAuthModal,
    openAuthModal,
    login,
    register,
    verifyEmail,
    resendCode,
    forgotPassword,
    resetPassword,
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

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetCodeVal, setResetCodeVal] = useState("");
  const [newPasswordVal, setNewPasswordVal] = useState("");

  // Common UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setSuccessMsg(null);
  }, [modalTab, isAuthModalOpen]);

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

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await forgotPassword(forgotEmail);
      if (!res.success) {
        setError(res.error || "خطا در ارسال کد بازیابی.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingEmail) return;
    setError(null);
    setLoading(true);
    try {
      const res = await resetPassword(pendingEmail, resetCodeVal, newPasswordVal);
      if (!res.success) {
        setError(res.error || "خطا در بازنشانی رمز عبور.");
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
        setSuccessMsg("کد تایید جدید به ایمیل شما ارسال شد.");
        setResendCooldown(60);
      } else {
        setError(res.error || "خطا در ارسال مجدد.");
      }
    } finally {
      setLoading(false);
    }
  }

  const isTabsVisible = modalTab === "login" || modalTab === "register";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-line overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line/60 bg-chalk/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <NexSportIcon size={24} />
            <span className="font-bold text-base text-pitch">
              {modalTab === "forgot" || modalTab === "reset"
                ? "بازیابی رمز عبور"
                : "حساب کاربری NexSport"}
            </span>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            className="rounded-lg p-1 text-ink/40 hover:bg-chalk hover:text-ink transition-colors cursor-pointer"
            title="بستن پنجره"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher (Login vs Register) */}
        {isTabsVisible && (
          <div className="flex border-b border-line bg-chalk/20">
            <button
              type="button"
              onClick={() => openAuthModal("login")}
              className={
                "flex-1 py-3 text-sm font-bold transition-all " +
                (modalTab === "login"
                  ? "border-b-2 border-pitch text-pitch bg-white"
                  : "text-ink/60 hover:text-ink cursor-pointer")
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
                  : "text-ink/60 hover:text-ink cursor-pointer")
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-ink/80">
                    رمز عبور
                  </label>
                  <button
                    type="button"
                    onClick={() => openAuthModal("forgot")}
                    className="text-[11px] text-pitch font-medium hover:underline cursor-pointer"
                  >
                    رمز عبور را فراموش کردید؟
                  </button>
                </div>
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
                  className="text-xs font-bold text-pitch hover:underline cursor-pointer"
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
                  className="text-xs font-bold text-pitch hover:underline cursor-pointer"
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
                  کد تایید ۶ رقمی به آدرس <strong>{pendingEmail}</strong> ایمیل گردید. لطفاً صندوق ورودی (و در صورت نیاز پوشه هرزنامه/Spam) را بررسی کرده و کد را در کادر زیر وارد فرمایید:
                </p>
              </div>

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
                  className="text-ink/60 hover:underline cursor-pointer"
                >
                  تغییر ایمیل / بازگشت
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: FORGOT PASSWORD */}
          {modalTab === "forgot" && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div className="text-center space-y-1">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold-dark text-2xl mb-1">
                  🔑
                </div>
                <h3 className="font-bold text-sm text-pitch">بازیابی رمز عبور</h3>
                <p className="text-xs text-ink/70 leading-relaxed">
                  آدرس ایمیل حسابتان را وارد فرمایید تا کد ۶ رقمی بازیابی رمز عبور برای شما ارسال گردد:
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1">
                  آدرس ایمیل
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm focus:border-pitch focus:outline-none"
                  dir="ltr"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-pitch py-2.5 text-sm font-bold text-white shadow-sm hover:bg-pitch-light transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? "در حال ارسال..." : "ارسال کد بازیابی به ایمیل"}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => openAuthModal("login")}
                  className="text-xs text-ink/70 hover:text-pitch font-medium hover:underline cursor-pointer"
                >
                  بازگشت به صفحه ورود
                </button>
              </div>
            </form>
          )}

          {/* TAB 5: RESET PASSWORD */}
          {modalTab === "reset" && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="text-center space-y-1">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-pitch/10 text-pitch text-2xl mb-1">
                  🔒
                </div>
                <h3 className="font-bold text-sm text-pitch">تعیین رمز عبور جدید</h3>
                <p className="text-xs text-ink/70 leading-relaxed">
                  کد بازیابی ۶ رقمی به ایمیل <strong>{pendingEmail}</strong> ارسال شد. لطفاً کد را به همراه رمز عبور جدید وارد نمایید:
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1">
                  کد تایید ۶ رقمی
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={resetCodeVal}
                  onChange={(e) => setResetCodeVal(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.4em] font-mono text-lg font-bold rounded-lg border border-line bg-white py-2 focus:border-pitch focus:outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1">
                  رمز عبور جدید
                </label>
                <input
                  type="password"
                  required
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  placeholder="رمز عبور جدید را وارد فرمایید"
                  className="w-full rounded-lg border border-line bg-white px-3.5 py-2 text-sm focus:border-pitch focus:outline-none"
                  dir="ltr"
                />
              </div>

              <button
                type="submit"
                disabled={loading || resetCodeVal.length < 6}
                className="w-full rounded-lg bg-pitch py-2.5 text-sm font-bold text-white shadow-sm hover:bg-pitch-light transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? "در حال ثبت..." : "تغییر رمز عبور و ورود"}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => openAuthModal("login")}
                  className="text-xs text-ink/70 hover:text-pitch font-medium hover:underline cursor-pointer"
                >
                  انصراف و بازگشت
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
