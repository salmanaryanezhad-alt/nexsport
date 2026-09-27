"use client";

import React, { useState } from "react";
import { NexSportIcon } from "@/components/NexSportLogo";

export interface PrintSettings {
  orientation: "landscape" | "portrait";
  bracketStyle: "stages" | "tree" | "both";
  section: "both" | "matches" | "standings";
}

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentTitle?: string;
  hasKnockout: boolean;
  hasStandings: boolean;
  currentSettings: PrintSettings;
  onApplyAndPrint: (settings: PrintSettings) => void;
}

export function PrintModal({
  isOpen,
  onClose,
  tournamentTitle,
  hasKnockout,
  hasStandings,
  currentSettings,
  onApplyAndPrint,
}: PrintModalProps) {
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(
    currentSettings.orientation
  );
  const [bracketStyle, setBracketStyle] = useState<"stages" | "tree" | "both">(
    currentSettings.bracketStyle
  );
  const [section, setSection] = useState<"both" | "matches" | "standings">(
    currentSettings.section
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApplyAndPrint({
      orientation,
      bracketStyle,
      section,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-ink/50 backdrop-blur-xs animate-in fade-in duration-200 no-print">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-line flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line bg-chalk/70 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <NexSportIcon size={24} />
            <div>
              <h2 className="font-bold text-sm text-pitch">
                تنظیمات پیشرفته چاپ و خروجی PDF
              </h2>
              <p className="text-[11px] text-ink/60 truncate max-w-[280px]">
                {tournamentTitle || "گزارش رسمی مسابقات NexSport"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink/40 hover:bg-chalk hover:text-ink transition-colors cursor-pointer"
            title="بستن"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
          {/* Section 1: Page Orientation */}
          <div>
            <label className="block font-bold text-ink mb-1.5">
              ۱. جهت صفحه کاغذ (Orientation)
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center cursor-pointer transition-all ${
                  orientation === "landscape"
                    ? "border-pitch bg-pitch/5 text-pitch font-bold shadow-xs"
                    : "border-line bg-white text-ink/70 hover:bg-chalk"
                }`}
              >
                <input
                  type="radio"
                  name="orientation"
                  value="landscape"
                  checked={orientation === "landscape"}
                  onChange={() => setOrientation("landscape")}
                  className="sr-only"
                />
                <span className="text-2xl mb-1">📑</span>
                <span className="text-xs font-bold">افقی (Landscape)</span>
                <span className="text-[10px] text-ink/50 mt-0.5">
                  پیشنهادی برای براکت‌ها و جداول عریض
                </span>
              </label>

              <label
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center cursor-pointer transition-all ${
                  orientation === "portrait"
                    ? "border-pitch bg-pitch/5 text-pitch font-bold shadow-xs"
                    : "border-line bg-white text-ink/70 hover:bg-chalk"
                }`}
              >
                <input
                  type="radio"
                  name="orientation"
                  value="portrait"
                  checked={orientation === "portrait"}
                  onChange={() => setOrientation("portrait")}
                  className="sr-only"
                />
                <span className="text-2xl mb-1">📄</span>
                <span className="text-xs font-bold">عمودی (Portrait)</span>
                <span className="text-[10px] text-ink/50 mt-0.5">
                  استاندارد برای لیگ و جداول رده‌بندی
                </span>
              </label>
            </div>
          </div>

          {/* Section 2: Knockout Bracket Format (if knockout exists) */}
          {hasKnockout && (
            <div className="border-t border-line/60 pt-3.5">
              <label className="block font-bold text-ink mb-1.5">
                ۲. شیوه نمایش براکت مرحله حذفی
              </label>
              <div className="space-y-2">
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    bracketStyle === "stages"
                      ? "border-pitch bg-pitch/5 text-pitch font-semibold shadow-xs"
                      : "border-line bg-white text-ink/70 hover:bg-chalk"
                  }`}
                >
                  <input
                    type="radio"
                    name="bracketStyle"
                    value="stages"
                    checked={bracketStyle === "stages"}
                    onChange={() => setBracketStyle("stages")}
                    className="mt-0.5 text-pitch"
                  />
                  <div>
                    <span className="text-xs font-bold block text-ink">
                      📋 برنامه چاپی مرحله‌به‌مرحله (توصیه شده برای تیم‌های زیاد)
                    </span>
                    <span className="text-[11px] text-ink/60 leading-normal block mt-0.5">
                      مسابقات دور به دور در کارت‌های استاندارد تفکیک می‌شوند. هیچ مسابقه یا جدولی در مرز صفحات نصف نمی‌شود و ۱۰۰٪ خواناست.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    bracketStyle === "tree"
                      ? "border-pitch bg-pitch/5 text-pitch font-semibold shadow-xs"
                      : "border-line bg-white text-ink/70 hover:bg-chalk"
                  }`}
                >
                  <input
                    type="radio"
                    name="bracketStyle"
                    value="tree"
                    checked={bracketStyle === "tree"}
                    onChange={() => setBracketStyle("tree")}
                    className="mt-0.5 text-pitch"
                  />
                  <div>
                    <span className="text-xs font-bold block text-ink">
                      🌲 نمای درختی براکت با مقیاس خودکار (Fit-to-Page)
                    </span>
                    <span className="text-[11px] text-ink/60 leading-normal block mt-0.5">
                      نمودار درختی کامل به طور خودکار در عرض صفحه افقی کوچک شده و در یک نگاه جا می‌گیرد.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    bracketStyle === "both"
                      ? "border-pitch bg-pitch/5 text-pitch font-semibold shadow-xs"
                      : "border-line bg-white text-ink/70 hover:bg-chalk"
                  }`}
                >
                  <input
                    type="radio"
                    name="bracketStyle"
                    value="both"
                    checked={bracketStyle === "both"}
                    onChange={() => setBracketStyle("both")}
                    className="mt-0.5 text-pitch"
                  />
                  <div>
                    <span className="text-xs font-bold block text-ink">
                      🌟 چاپ کامل (هم براکت درختی و هم برنامه تفکیک‌شده)
                    </span>
                    <span className="text-[11px] text-ink/60 leading-normal block mt-0.5">
                      ابتدا نمودار درختی و سپس مسابقات دور به دور برای پرینت چندصفحه‌ای آماده می‌شود.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Section 3: Report Content (if tournament has standings) */}
          {hasStandings && (
            <div className="border-t border-line/60 pt-3.5">
              <label className="block font-bold text-ink mb-1.5">
                ۳. بخش‌های مورد نیاز در پرینت
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSection("both")}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    section === "both"
                      ? "border-pitch bg-pitch text-white font-bold"
                      : "border-line bg-white text-ink/70 hover:bg-chalk"
                  }`}
                >
                  کل گزارش مسابقات
                </button>
                <button
                  type="button"
                  onClick={() => setSection("matches")}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    section === "matches"
                      ? "border-pitch bg-pitch text-white font-bold"
                      : "border-line bg-white text-ink/70 hover:bg-chalk"
                  }`}
                >
                  فقط برنامه مسابقات
                </button>
                <button
                  type="button"
                  onClick={() => setSection("standings")}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    section === "standings"
                      ? "border-pitch bg-pitch text-white font-bold"
                      : "border-line bg-white text-ink/70 hover:bg-chalk"
                  }`}
                >
                  فقط جدول رده‌بندی
                </button>
              </div>
            </div>
          )}

          {/* Highlights & Guarantees */}
          <div className="rounded-xl bg-chalk/60 border border-line/70 p-3 text-[11px] text-ink/70 space-y-1">
            <p className="font-bold text-pitch flex items-center gap-1">
              <span>✨</span>
              <span>تضمین استانداردهای چاپ NexSport:</span>
            </p>
            <p>✓ جلوگیری قطعی از نصف شدن جداول و سطرها بین صفحات کاغذ</p>
            <p>✓ حفظ کامل فونت‌ها، رنگ‌ها و لوگوی رسمی سامانه nexsport.ir</p>
            <p>✓ عدم بریدگی مراحل پایانی براکت‌های پر تیم در لبه کاغذ</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-line bg-white hover:bg-chalk text-ink/70 font-semibold cursor-pointer transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-pitch hover:bg-pitch-light active:bg-pitch-dark text-white font-bold shadow-sm cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <span>🖨️</span>
              <span>شروع چاپ / خروجی PDF</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
