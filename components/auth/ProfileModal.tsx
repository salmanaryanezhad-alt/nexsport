"use client";

import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { hasPersianLetters } from "@/lib/auth/utils";

export function ProfileModal() {
  const { user, isAdmin, isProfileModalOpen, closeProfileModal, openUsersModal, updateProfile, changePassword } = useAuth();

  const [activeTab, setActiveTab] = useState<"info" | "password">("info");
  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isProfileModalOpen || !user) return null;

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await updateProfile(name);
      if (res.success) {
        setSuccess("نام شما با موفقیت به‌روزرسانی شد.");
      } else {
        setError(res.error || "خطا در به‌روزرسانی مشخصات.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (hasPersianLetters(newPassword) || hasPersianLetters(currentPassword)) {
      setError("صفحه کلید را به انگلیسی تغییر دهید");
      return;
    }
    if (newPassword.length < 8) {
      setError("رمز عبور جدید باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    setLoading(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res.success) {
        setSuccess("رمز عبور با موفقیت تغییر یافت.");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        setError(res.error || "خطا در تغییر رمز عبور.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-line overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line/60 bg-chalk/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <span className="font-bold text-base text-pitch">مدیریت حساب کاربری</span>
          </div>
          <button
            type="button"
            onClick={closeProfileModal}
            className="rounded-lg p-1 text-ink/40 hover:bg-chalk hover:text-ink transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-line bg-chalk/20 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab("info");
              setError(null);
              setSuccess(null);
            }}
            className={
              "flex-1 py-3 transition-colors cursor-pointer " +
              (activeTab === "info"
                ? "border-b-2 border-pitch text-pitch bg-white"
                : "text-ink/60 hover:text-ink")
            }
          >
            مشخصات فردی
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("password");
              setError(null);
              setSuccess(null);
            }}
            className={
              "flex-1 py-3 transition-colors cursor-pointer " +
              (activeTab === "password"
                ? "border-b-2 border-pitch text-pitch bg-white"
                : "text-ink/60 hover:text-ink")
            }
          >
            تغییر رمز عبور
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {isAdmin && (
            <div className="mb-4 rounded-xl border border-pitch/20 bg-pitch/5 p-3 text-xs flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2 text-pitch font-bold">
                <span>👑</span>
                <span>دسترسی مدیر کل سامانه NexSport</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeProfileModal();
                  openUsersModal();
                }}
                className="bg-pitch text-white px-2.5 py-1 rounded-lg text-[11px] font-bold hover:bg-pitch-light transition cursor-pointer"
              >
                مدیریت کاربران
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
              <span>✓</span>
              <span>{success}</span>
            </div>
          )}

          {activeTab === "info" && (
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1">
                  نام و نام خانوادگی
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3.5 py-2 text-sm focus:border-pitch focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/60 mb-1">
                  آدرس ایمیل (شناسه غیرقابل تغییر)
                </label>
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="w-full rounded-lg border border-line bg-gray-50 px-3.5 py-2 text-sm text-ink/60 cursor-not-allowed"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/60 mb-1">
                  شماره موبایل
                </label>
                <input
                  type="text"
                  disabled
                  value={user.mobile}
                  className="w-full rounded-lg border border-line bg-gray-50 px-3.5 py-2 text-sm text-ink/60 cursor-not-allowed"
                  dir="ltr"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-pitch py-2.5 text-sm font-bold text-white shadow-sm hover:bg-pitch-light transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </button>
            </form>
          )}

          {activeTab === "password" && (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1">
                  رمز عبور فعلی
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="رمز عبور فعلی را وارد نمایید"
                  className={`w-full rounded-lg border ${
                    hasPersianLetters(currentPassword)
                      ? "border-rose-500 bg-rose-50/30 text-rose-900 focus:border-rose-500"
                      : "border-line bg-white focus:border-pitch"
                  } px-3.5 py-2 text-sm focus:outline-none transition-colors`}
                  dir="ltr"
                />
                {hasPersianLetters(currentPassword) && (
                  <p className="text-xs font-semibold text-rose-600 mt-1.5 flex items-center gap-1 animate-pulse">
                    <span>⚠️</span>
                    <span>صفحه کلید را به انگلیسی تغییر دهید</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1">
                  رمز عبور جدید (حداقل ۸ کاراکتر)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="حداقل ۸ کاراکتر"
                  className={`w-full rounded-lg border ${
                    hasPersianLetters(newPassword)
                      ? "border-rose-500 bg-rose-50/30 text-rose-900 focus:border-rose-500"
                      : "border-line bg-white focus:border-pitch"
                  } px-3.5 py-2 text-sm focus:outline-none transition-colors`}
                  dir="ltr"
                />
                {hasPersianLetters(newPassword) ? (
                  <p className="text-xs font-semibold text-rose-600 mt-1.5 flex items-center gap-1 animate-pulse">
                    <span>⚠️</span>
                    <span>صفحه کلید را به انگلیسی تغییر دهید</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-ink/50 mt-1">
                    رمز عبور جدید باید حداقل ۸ کاراکتر باشد.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || hasPersianLetters(newPassword) || hasPersianLetters(currentPassword)}
                className="w-full rounded-lg bg-pitch py-2.5 text-sm font-bold text-white shadow-sm hover:bg-pitch-light transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? "در حال ثبت..." : "به‌روزرسانی رمز عبور"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
