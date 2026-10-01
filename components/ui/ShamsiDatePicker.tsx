"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toPersianDigits } from "@/lib/digits";
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  JalaliDate,
  dateToJalali,
  daysInJalaliMonth,
  formatJalali,
  jalaliToDate,
  parseGregorianYmd,
  parseJalaliInput,
  toGregorianYmd,
} from "@/lib/jalali";

interface ShamsiDatePickerProps {
  value?: string;
  onChange: (gregorianYmd: string, jalaliLabel: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

function weekdayIndexSaturdayFirst(date: Date): number {
  // JS: 0=Sun .. 6=Sat → Shamsi week starts Saturday
  return (date.getDay() + 1) % 7;
}

export function ShamsiDatePicker({
  value,
  onChange,
  required,
  placeholder = "انتخاب تاریخ شمسی",
  className = "",
}: ShamsiDatePickerProps) {
  const today = dateToJalali(new Date());
  const parsedFromGregorian = parseGregorianYmd(value);
  const selected = parsedFromGregorian
    ? dateToJalali(parsedFromGregorian)
    : parseJalaliInput(value);

  const [open, setOpen] = useState(false);
  const [viewY, setViewY] = useState(selected?.y || today.y);
  const [viewM, setViewM] = useState(selected?.m || today.m);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) {
      setViewY(selected.y);
      setViewM(selected.m);
    }
  }, [selected?.y, selected?.m, selected?.d]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const cells = useMemo(() => {
    const first = jalaliToDate(viewY, viewM, 1);
    const offset = weekdayIndexSaturdayFirst(first);
    const dim = daysInJalaliMonth(viewY, viewM);
    const list: Array<{ j: JalaliDate | null }> = [];
    for (let i = 0; i < offset; i++) list.push({ j: null });
    for (let d = 1; d <= dim; d++) list.push({ j: { y: viewY, m: viewM, d } });
    return list;
  }, [viewY, viewM]);

  function prevMonth() {
    if (viewM === 1) {
      setViewM(12);
      setViewY((y) => y - 1);
    } else setViewM((m) => m - 1);
  }

  function nextMonth() {
    if (viewM === 12) {
      setViewM(1);
      setViewY((y) => y + 1);
    } else setViewM((m) => m + 1);
  }

  function pick(j: JalaliDate) {
    const g = jalaliToDate(j.y, j.m, j.d);
    onChange(toGregorianYmd(g), formatJalali(j, true));
    setOpen(false);
  }

  const display = selected ? formatJalali(selected, true) : "";

  return (
    <div ref={rootRef} className={`relative ${className}`} dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 text-right hover:border-pitch/50 focus:border-pitch focus:outline-none cursor-pointer flex items-center justify-between gap-2"
      >
        <span className={display ? "text-slate-900" : "text-slate-400"}>
          {display || placeholder}
        </span>
        <span>📅</span>
      </button>
      {required && <input type="hidden" value={value || ""} required />}

      {open && (
        <div className="absolute z-[70] mt-1 w-[280px] rounded-2xl border border-line bg-white shadow-2xl p-3 text-right">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={nextMonth} className="rounded-lg px-2 py-1 text-sm hover:bg-chalk cursor-pointer">
              ‹
            </button>
            <div className="font-black text-xs text-pitch">
              {JALALI_MONTHS[viewM - 1]} {toPersianDigits(viewY)}
            </div>
            <button type="button" onClick={prevMonth} className="rounded-lg px-2 py-1 text-sm hover:bg-chalk cursor-pointer">
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {JALALI_WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[10px] font-bold text-ink/50 py-1">
                {w}
              </div>
            ))}
            {cells.map((c, i) => {
              if (!c.j) return <div key={`e-${i}`} />;
              const isToday = c.j.y === today.y && c.j.m === today.m && c.j.d === today.d;
              const isSel =
                selected && c.j.y === selected.y && c.j.m === selected.m && c.j.d === selected.d;
              return (
                <button
                  key={`${c.j.y}-${c.j.m}-${c.j.d}`}
                  type="button"
                  onClick={() => pick(c.j!)}
                  className={`h-8 rounded-lg text-[11px] font-bold cursor-pointer ${
                    isSel
                      ? "bg-pitch text-white"
                      : isToday
                      ? "bg-pitch/10 text-pitch"
                      : "text-ink hover:bg-chalk"
                  }`}
                >
                  {toPersianDigits(c.j.d)}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-line/60">
            <button
              type="button"
              onClick={() => pick(today)}
              className="text-[10px] font-bold text-pitch hover:underline cursor-pointer"
            >
              امروز
            </button>
            <button
              type="button"
              onClick={() => {
                onChange("", "");
                setOpen(false);
              }}
              className="text-[10px] font-bold text-ink/50 hover:text-ink cursor-pointer"
            >
              پاک کردن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
