"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "./AuthContext";

export function AuthHeaderNav() {
  const { user, isAdmin, openAuthModal, openProfileModal, openUsersModal, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Position calculation: mathematically clamps the dropdown so it NEVER overflows the screen
  function updatePosition() {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    const menuWidth = Math.min(260, screenWidth - 24);

    // In RTL, prefer aligning with the button's position, but clamp inside [12px, screenWidth - menuWidth - 12px]
    // If button is on the left side of screen (like on homepage): rect.left is small -> align near rect.left
    // If button is on the right side of screen: rect.right is large -> align so it fits
    let targetLeft = rect.left;
    if (rect.left + menuWidth > screenWidth - 12) {
      targetLeft = screenWidth - menuWidth - 12;
    }
    if (targetLeft < 12) {
      targetLeft = 12;
    }

    setDropdownStyle({
      position: "fixed",
      top: `${rect.bottom + 6}px`,
      left: `${targetLeft}px`,
      width: `${menuWidth}px`,
      zIndex: 9999,
    });
  }

  function handleToggle() {
    if (!dropdownOpen) {
      updatePosition();
      setDropdownOpen(true);
    } else {
      setDropdownOpen(false);
    }
  }

  // Update on window resize / scroll while open
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleScrollOrResize() {
      updatePosition();
    }
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [dropdownOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [dropdownOpen]);

  // Close on Escape key
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
        className="inline-flex items-center gap-1.5 rounded-lg border border-pitch/20 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-bold text-pitch shadow-2xs hover:bg-pitch hover:text-white transition-all cursor-pointer shrink-0"
      >
        <span>👤</span>
        <span>ورود / ثبت‌نام</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {isAdmin && (
        <button
          type="button"
          onClick={openUsersModal}
          className="inline-flex items-center gap-1.5 rounded-lg bg-pitch/10 hover:bg-pitch/15 border border-pitch/25 text-pitch px-2.5 py-1 text-xs font-bold transition-all cursor-pointer shrink-0 shadow-2xs"
          title="مشاهده آمار و مدیریت اعضای ثبت‌نام شده"
        >
          <span>👥</span>
          <span className="hidden sm:inline">مدیریت کاربران</span>
        </button>
      )}

      <div className="relative inline-block text-right" ref={dropdownRef}>
        {/* Trigger Button */}
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border border-pitch/20 bg-white px-2 sm:px-3 py-1 text-xs font-bold text-pitch shadow-2xs hover:border-pitch/40 transition-all cursor-pointer shrink-0"
          aria-expanded={dropdownOpen}
          aria-label="منوی حساب کاربری"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pitch text-white text-[11px] font-bold shrink-0">
            {user.name.trim().charAt(0) || "👤"}
          </span>
          <span className="max-w-[70px] sm:max-w-[120px] truncate text-ink">{user.name}</span>
          <span className="text-[10px] text-ink/40">▼</span>
        </button>

        {/* Floating Dropdown (Mathematically clamped to viewport so it never overflows left or right) */}
        {dropdownOpen && (
          <div
            ref={menuRef}
            style={dropdownStyle}
            className="rounded-xl border border-line bg-white p-3 shadow-2xl text-right animate-in fade-in duration-150"
          >
            {/* User profile info header */}
            <div className="border-b border-line/60 pb-2.5 mb-2">
              <div className="flex items-center justify-between">
                <p className="font-bold text-xs text-ink">{user.name}</p>
                {isAdmin && (
                  <span className="bg-pitch text-white text-[9px] font-black px-1.5 py-0.2 rounded">
                    مدیر کل
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink/60 truncate mt-0.5 dir-ltr text-right" title={user.email}>
                {user.email}
              </p>
              <p className="text-[11px] text-ink/50 dir-ltr text-right mt-0.5 font-mono">
                {user.mobile}
              </p>
              <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                <span>✓</span>
                <span>ایمیل تایید شده</span>
              </div>
            </div>

            {/* Action links */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  openUsersModal();
                }}
                className="w-full text-right rounded-lg px-2.5 py-2 text-xs font-bold text-pitch bg-pitch/10 hover:bg-pitch/15 border border-pitch/20 transition-colors flex items-center justify-between cursor-pointer mb-1.5 shadow-2xs"
              >
                <span className="flex items-center gap-1.5">
                  <span>👥</span>
                  <span>مدیریت کاربران سامانه</span>
                </span>
                <span className="text-[10px] bg-pitch text-white px-1.5 py-0.5 rounded-full font-bold">
                  مدیر
                </span>
              </button>
            )}

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
              className="w-full text-right rounded-lg px-2.5 py-2 text-xs font-semibold text-ink hover:bg-chalk transition-colors flex items-center justify-between cursor-pointer mb-1"
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
              className="w-full text-right rounded-lg px-2.5 py-2 text-xs font-semibold text-ink hover:bg-chalk transition-colors flex items-center justify-between cursor-pointer mb-1"
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
              className="w-full text-right rounded-lg px-2.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors flex items-center justify-between cursor-pointer"
            >
              <span>خروج از حساب کاربری</span>
              <span>🚪</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
