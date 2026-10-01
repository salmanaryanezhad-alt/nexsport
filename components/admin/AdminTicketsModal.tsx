"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { NexSportIcon } from "@/components/NexSportLogo";
import { toPersianDigits } from "@/lib/digits";

interface AdminTicketItem {
  id: string;
  user_id: string;
  subject: string;
  status: "unanswered" | "answered";
  last_preview: string;
  last_message_at: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
  user_mobile?: string;
}

interface TicketMessage {
  id: string;
  sender: "user" | "admin";
  body: string;
  created_at: string;
}

function formatWhen(value: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function AdminTicketsModal() {
  const { isAdminTicketsModalOpen, closeAdminTicketsModal, isAdmin, refreshTicketBadge } = useAuth();
  const [tickets, setTickets] = useState<AdminTicketItem[]>([]);
  const [filter, setFilter] = useState<"all" | "unanswered" | "answered">("unanswered");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminTicketItem | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadList() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tickets");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "خطا در دریافت تیکت‌ها.");
        return;
      }
      setTickets(data.tickets || []);
      await refreshTicketBadge();
    } catch {
      setError("خطا در ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  }

  async function openTicket(id: string) {
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/tickets/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تیکت یافت نشد.");
        return;
      }
      setSelectedId(id);
      setSelected(data.ticket);
      setMessages(data.messages || []);
    } catch {
      setError("خطا در دریافت گفتگو.");
    }
  }

  useEffect(() => {
    if (isAdminTicketsModalOpen && isAdmin) {
      setSelectedId(null);
      setSelected(null);
      setReplyBody("");
      setFilter("unanswered");
      loadList();
    }
  }, [isAdminTicketsModalOpen, isAdmin]);

  const unansweredCount = tickets.filter((t) => t.status === "unanswered").length;
  const answeredCount = tickets.length - unansweredCount;
  const filtered = useMemo(() => {
    if (filter === "all") return tickets;
    return tickets.filter((t) => t.status === filter);
  }, [tickets, filter]);

  if (!isAdminTicketsModalOpen || !isAdmin) return null;

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/tickets/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || "خطا در ارسال پاسخ.");
        return;
      }
      setReplyBody("");
      setMessages(data.messages || []);
      setSelected(data.ticket);
      await loadList();
    } catch {
      setNotice("خطا در ارتباط با سرور.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-ink/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl max-h-[92vh] rounded-2xl bg-white shadow-2xl border border-line flex flex-col overflow-hidden text-right"
        dir="rtl"
      >
        <div className="flex items-center justify-between border-b border-line/70 bg-chalk/70 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <NexSportIcon size={26} />
            <div>
              <h2 className="font-bold text-base text-pitch">پنل تیکت‌های پشتیبانی</h2>
              <p className="text-[11px] text-ink/60 mt-0.5">گفتگوها به‌ترتیب زمان، با تفکیک پاسخ‌داده و پاسخ‌نداده</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAdminTicketsModal}
            className="rounded-lg p-1.5 text-ink/40 hover:bg-chalk cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-line bg-chalk/30 px-5 py-3 grid grid-cols-3 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFilter("unanswered")}
            className={`rounded-xl border p-2.5 text-right cursor-pointer ${
              filter === "unanswered" ? "border-rose-400 bg-rose-50" : "border-line bg-white"
            }`}
          >
            <p className="text-[10px] text-ink/60 font-semibold">پاسخ‌نداده</p>
            <p className="text-lg font-black text-rose-700">{toPersianDigits(unansweredCount)}</p>
          </button>
          <button
            type="button"
            onClick={() => setFilter("answered")}
            className={`rounded-xl border p-2.5 text-right cursor-pointer ${
              filter === "answered" ? "border-emerald-400 bg-emerald-50" : "border-line bg-white"
            }`}
          >
            <p className="text-[10px] text-ink/60 font-semibold">پاسخ‌داده</p>
            <p className="text-lg font-black text-emerald-700">{toPersianDigits(answeredCount)}</p>
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-xl border p-2.5 text-right cursor-pointer ${
              filter === "all" ? "border-pitch bg-pitch/5" : "border-line bg-white"
            }`}
          >
            <p className="text-[10px] text-ink/60 font-semibold">همه تیکت‌ها</p>
            <p className="text-lg font-black text-pitch">{toPersianDigits(tickets.length)}</p>
          </button>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 sm:grid-cols-[280px_1fr]">
          <div className="border-l border-line overflow-y-auto p-3 space-y-2 bg-chalk/15">
            {loading && tickets.length === 0 ? (
              <p className="text-[11px] text-ink/50 py-10 text-center">در حال بارگذاری...</p>
            ) : error ? (
              <p className="text-[11px] text-rose-700 font-bold">{error}</p>
            ) : filtered.length === 0 ? (
              <p className="text-[11px] text-ink/50 py-10 text-center">تیکتی در این فهرست نیست.</p>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTicket(t.id)}
                  className={`w-full text-right rounded-xl border p-2.5 cursor-pointer transition ${
                    selectedId === t.id
                      ? "border-pitch bg-white shadow-2xs"
                      : t.status === "unanswered"
                      ? "border-rose-200 bg-rose-50/70"
                      : "border-line bg-white hover:border-pitch/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-ink truncate">{t.subject}</span>
                    <span
                      className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                        t.status === "unanswered"
                          ? "bg-rose-600 text-white"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {t.status === "unanswered" ? "پاسخ‌نداده" : "پاسخ‌داده"}
                    </span>
                  </div>
                  <p className="text-[10px] text-ink/70 mt-1 truncate">{t.user_name || "کاربر"}</p>
                  <p className="text-[10px] text-ink/45 mt-0.5 line-clamp-2">{t.last_preview}</p>
                  <p className="text-[10px] text-ink/35 mt-1">{formatWhen(t.last_message_at)}</p>
                </button>
              ))
            )}
          </div>

          <div className="overflow-y-auto p-4">
            {!selected ? (
              <div className="h-full min-h-[240px] flex items-center justify-center text-xs text-ink/50">
                یک تیکت را از فهرست انتخاب کنید.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-2xl border border-line bg-chalk/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black text-sm text-slate-900">{selected.subject}</h3>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        selected.status === "unanswered"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {selected.status === "unanswered" ? "نیاز به پاسخ" : "پاسخ داده شده"}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink/70 mt-1">
                    {selected.user_name} — {selected.user_email} — {selected.user_mobile}
                  </p>
                </div>

                <div className="space-y-2 max-h-[40vh] overflow-y-auto pe-1">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${
                        m.sender === "admin"
                          ? "bg-pitch/5 border border-pitch/20 text-pitch"
                          : "bg-slate-50 border border-slate-200 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-[10px]">
                          {m.sender === "admin" ? "پاسخ شما (مدیر)" : selected.user_name || "کاربر"}
                        </span>
                        <span className="text-[10px] text-ink/40">{formatWhen(m.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))}
                </div>

                {notice && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-800">
                    {notice}
                  </div>
                )}

                <form onSubmit={handleReply} className="space-y-2">
                  <textarea
                    required
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={4}
                    placeholder="پاسخ خود را برای کاربر بنویسید..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-pitch focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    className="rounded-xl bg-pitch text-white px-4 py-2 text-xs font-black cursor-pointer disabled:opacity-50"
                  >
                    {sending ? "در حال ارسال..." : "ارسال پاسخ"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
