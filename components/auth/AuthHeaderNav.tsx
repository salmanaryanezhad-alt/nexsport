"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "./AuthContext";

export function AuthHeaderNav() {
  const { user, loading, openAuthModal, openProfileModal, logout } = useAuth();
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

  if (loading) {
    return (
      <div className="h-8 w-20 animate-pulse rounded-lg bg-chalk/60" />
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal("login")}
        className="inline-flex items-center gap-1.5 rounded-lg border border-pitch/20 bg-white px-3 py-1.5 text-xs font-bold text-pitch shadow-2xs hover:bg-pitch hover:text-white transition-all cursor-pointer"
      >
        <span>👤</span>
        <span>ورود / ثبت‌نام</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-pitch/20 bg-white px-3 py-1 text-xs font-bold text-pitch shadow-2xs hover:border-pitch/40 transition-all cursor-pointer"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pitch text-white text-[11px] font-bold">
          {user.name.trim().charAt(0) || "👤"}
        </span>
        <span className="max-w-[120px] truncate text-ink">{user.name}</span>
        <span className="text-[10px] text-ink/40">▼</span>
      </button>

      {dropdownOpen && (
        <div className="absolute left-0 mt-2 w-64 rounded-xl border border-line bg-white p-3 shadow-xl z-50 text-right animate-in fade-in duration-150">
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

          <Link
            href="/planner?open=saved"
            onClick={() => setDropdownOpen(false)}
            className="w-full text-right rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-chalk transition-colors flex items-center justify-between cursor-pointer mb-1"
          >
            <span>مسابقات ذخیره شده من</span>
            <span>📂</span>
          </Link>

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
    </div>
  );
}
