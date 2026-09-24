"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "./AuthContext";

export function AuthHeaderNav() {
  const { user, openAuthModal, openProfileModal, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal("login")}
        className="inline-flex items-center gap-1.5 rounded-lg border border-pitch/20 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-bold text-pitch shadow-2xs hover:bg-pitch hover:text-white transition-all cursor-pointer"
      >
        <span>👤</span>
        <span>ورود / ثبت‌نام</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setDropdownOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border border-pitch/20 bg-white px-2 sm:px-3 py-1 text-xs font-bold text-pitch shadow-2xs hover:border-pitch/40 transition-all cursor-pointer"
        aria-expanded={dropdownOpen}
        aria-label="منوی حساب کاربری"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pitch text-white text-[11px] font-bold shrink-0">
          {user.name.trim().charAt(0) || "👤"}
        </span>
        <span className="max-w-[75px] sm:max-w-[120px] truncate text-ink">{user.name}</span>
        <span className="text-[10px] text-ink/40">▼</span>
      </button>

      {/* 1. DESKTOP DROPDOWN (sm: and above) */}
      {dropdownOpen && (
        <div className="hidden sm:block absolute left-0 mt-2 w-64 rounded-xl border border-line bg-white p-3 shadow-xl z-50 text-right animate-in fade-in duration-150">
          <div className="border-b border-line/60 pb-2.5 mb-2">
            <p className="font-bold text-xs text-ink">{user.name}</p>
            <p className="text-[11px] text-ink/60 truncate mt-0.5 dir-ltr text-right" title={user.email}>
              {user.email}
            </p>
            <p className="text-[11px] text-ink/50 dir-ltr text-right mt-0.5">
              {user.mobile}
            </p>
            <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
              <span>✓</span>
              <span>ایمیل تایید شده</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setDropdownOpen(false);
              if (typeof window !== "undefined" && window.location.pathname.startsWith("/planner")) {
                window.dispatchEvent(new CustomEvent("open-saved-tournaments"));
              } else if (typeof window !== "undefined") {
                window.location.href = "/planner?open=saved";
              }
            }}
            className="w-full text-right rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-chalk transition-colors flex items-center justify-between cursor-pointer mb-1"
          >
            <span>مسابقات ذخیره شده من</span>
            <span>📂</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDropdownOpen(false);
              openProfileModal();
            }}
            className="w-full text-right rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-chalk transition-colors flex items-center justify-between cursor-pointer mb-1"
          >
            <span>مدیریت مشخصات و رمز عبور</span>
            <span>⚙️</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              setDropdownOpen(false);
              await logout();
            }}
            className="w-full text-right rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors flex items-center justify-between cursor-pointer"
          >
            <span>خروج از حساب کاربری</span>
            <span>🚪</span>
          </button>
        </div>
      )}

      {/* 2. MOBILE BOTTOM SHEET (Screen < sm) */}
      {dropdownOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:hidden p-0">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-pitch/50 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setDropdownOpen(false)}
          />

          {/* Bottom Drawer Card */}
          <div className="relative w-full max-w-md rounded-t-3xl border-t border-line bg-white p-5 shadow-2xl z-10 text-right animate-in slide-in-from-bottom duration-200">
            {/* Grab Handle */}
            <div className="mx-auto -mt-2 mb-3 h-1 w-10 rounded-full bg-line/80" />

            {/* Profile Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-line/60 mb-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pitch text-white text-base font-black shadow-xs">
                  {user.name.trim().charAt(0) || "👤"}
                </span>
                <div>
                  <h4 className="font-black text-sm text-pitch">{user.name}</h4>
                  <p className="text-xs text-ink/70 dir-ltr text-right truncate max-w-[210px] mt-0.5">
                    {user.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDropdownOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-chalk text-ink/60 hover:text-pitch transition-colors cursor-pointer"
                aria-label="بستن منو"
              >
                ✕
              </button>
            </div>

            {/* Mobile & Status Badge */}
            <div className="flex items-center justify-between rounded-xl bg-chalk/60 px-3 py-2 mb-3.5 text-xs">
              <span className="text-ink/70 font-mono dir-ltr">{user.mobile}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                <span>✓</span>
                <span>ایمیل فعال و تایید شده</span>
              </span>
            </div>

            {/* Touch Action Buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  if (typeof window !== "undefined" && window.location.pathname.startsWith("/planner")) {
                    window.dispatchEvent(new CustomEvent("open-saved-tournaments"));
                  } else if (typeof window !== "undefined") {
                    window.location.href = "/planner?open=saved";
                  }
                }}
                className="w-full text-right rounded-xl p-3 text-xs font-bold text-ink bg-chalk/40 hover:bg-chalk transition-colors flex items-center justify-between cursor-pointer border border-line/50"
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-base">📂</span>
                  <span>مسابقات من (ذخیره‌سازی ابری)</span>
                </span>
                <span className="text-ink/40 text-sm">←</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  openProfileModal();
                }}
                className="w-full text-right rounded-xl p-3 text-xs font-bold text-ink bg-chalk/40 hover:bg-chalk transition-colors flex items-center justify-between cursor-pointer border border-line/50"
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-base">⚙️</span>
                  <span>مدیریت حساب و تغییر رمز عبور</span>
                </span>
                <span className="text-ink/40 text-sm">←</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setDropdownOpen(false);
                  await logout();
                }}
                className="w-full text-right rounded-xl p-3 text-xs font-bold text-rose-700 bg-rose-50/70 hover:bg-rose-100 transition-colors flex items-center justify-between cursor-pointer border border-rose-100"
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-base">🚪</span>
                  <span>خروج از حساب کاربری</span>
                </span>
                <span className="text-rose-400 text-sm">←</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
