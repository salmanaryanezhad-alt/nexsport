"use client";

import Link from "next/link";
import { NexSportIcon } from "@/components/NexSportLogo";
import { AuthHeaderNav } from "@/components/auth/AuthHeaderNav";

export function CommunityChrome({
  children,
  subtitle = "جامعه ورزشی",
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen bg-chalk text-ink">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md shadow-2xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-95 transition-opacity">
            <NexSportIcon className="w-8 h-8 shrink-0" />
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-slate-900 leading-tight">
                Nex<span className="text-emerald-700">Sport</span>
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">{subtitle}</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <AuthHeaderNav />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  );
}
