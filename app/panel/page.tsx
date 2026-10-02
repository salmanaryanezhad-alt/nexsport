"use client";

import { Suspense } from "react";
import { OrganizerChrome } from "@/components/organizer/OrganizerChrome";
import { OrganizerPanel } from "@/components/organizer/OrganizerPanel";

export default function OrganizerPanelPage() {
  return (
    <OrganizerChrome>
      <Suspense fallback={<p className="text-sm font-bold text-slate-500">در حال بارگذاری پنل…</p>}>
        <OrganizerPanel />
      </Suspense>
    </OrganizerChrome>
  );
}
