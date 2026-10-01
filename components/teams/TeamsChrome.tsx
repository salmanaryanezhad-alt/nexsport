"use client";

import Link from "next/link";
import { NexSportIcon } from "@/components/NexSportLogo";
import { AuthHeaderNav } from "@/components/auth/AuthHeaderNav";

export function TeamsChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-chalk text-ink">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md shadow-2xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5 text-pitch hover:opacity-95 transition-opacity">
            <NexSportIcon className="w-8 h-8 shrink-0" />
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-slate-900 leading-tight">
                Nex<span className="text-emerald-700">Sport</span>
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">مدیریت تیم و بازیکن</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/planner"
              className="hidden sm:inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-emerald-500 hover:text-emerald-800 transition-colors"
            >
              برنامه‌ریز مسابقات
            </Link>
            <AuthHeaderNav />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
