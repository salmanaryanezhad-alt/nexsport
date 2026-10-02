"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";

export function FollowButton({ tournamentId, compact = false }: { tournamentId: string; compact?: boolean }) {
  const { user, openAuthModal } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !tournamentId) return;
    fetch(`/api/follows/?tournamentId=${encodeURIComponent(tournamentId)}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setFollowing(Boolean(d.following)))
      .catch(() => {});
  }, [user, tournamentId]);

  async function toggle() {
    if (!user) {
      openAuthModal("login");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/follows/", {
        method: following ? "DELETE" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setFollowing(Boolean(data.following));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all cursor-pointer disabled:opacity-50 ${
        following
          ? "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-800"
      }`}
      title={following ? "لغو دنبال‌کردن" : "دنبال‌کردن مسابقه و دریافت اعلان نتایج"}
    >
      <span>{following ? "✓" : "☆"}</span>
      <span className={compact ? "hidden sm:inline" : ""}>{following ? "دنبال می‌کنید" : "دنبال کردن"}</span>
    </button>
  );
}
