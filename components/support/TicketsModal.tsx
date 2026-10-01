"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";

interface TicketItem {
  id: string;
  subject: string;
  status: "unanswered" | "answered";
  user_has_unread: boolean;
  last_preview: string;
  last_message_at: string;
  created_at: string;
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

export function TicketsModal() {
  const { isTicketsModalOpen, closeTicketsModal, user, refreshTicketBadge } = useAuth();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"unanswered" | "answered">("unanswered");

  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadList() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tickets");
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
    setShowNew(false);
    setNotice(null);
    try {
      const res = await fetch(`/api/tickets/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تیکت یافت نشد.");
        return;
      }
      setSelectedId(id);
      setSelectedSubject(data.ticket.subject);
      setSelectedStatus(data.ticket.status);
      setMessages(data.messages || []);
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, user_has_unread: false } : t))
      );
      await refreshTicketBadge();
    } catch {
      setError("خطا در دریافت گفتگو.");
    }
  }

  useEffect(() => {
    if (isTicketsModalOpen) {
      setSelectedId(null);
      setShowNew(false);
      setNewSubject("");
      setNewBody("");
      setReplyBody("");
      setNotice(null);
      loadList();
    }
  }, [isTicketsModalOpen]);

  if (!isTicketsModalOpen || !user) return null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: newSubject, body: newBody }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || "خطا در ثبت تیکت.");
        return;
      }
      setNewSubject("");
      setNewBody("");
      setShowNew(false);
      await loadList();
      if (data.ticket?.id) await openTicket(data.ticket.id);
    } catch {
      setNotice("خطا در ارتباط با سرور.");
    } finally {
      setSending(false);
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/tickets/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || "خطا در ارسال پیام.");
        return;
      }
      setReplyBody("");
      setMessages(data.messages || []);
      if (data.ticket) setSelectedStatus(data.ticket.status);
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
        className="relative w-full max-w-3xl max-h-[92vh] rounded-2xl bg-white shadow-2xl border border-line flex flex-col overflow-hidden text-right"
        dir="rtl"
      >
        <div className="flex items-center justify-between border-b border-line/70 bg-chalk/70 px-5 py-4 shrink-0">
          <div>
            <h2 className="font-bold text-base text-pitch">پشتیبانی و تیکت</h2>
            <p className="text-[11px] text-ink/60 mt-0.5">
              مشکل، سوال یا پیشنهاد خود را برای ما بفرستید
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowNew(true);
                setSelectedId(null);
                setNotice(null);
              }}
              className="rounded-lg bg-pitch text-white px-3 py-1.5 text-[11px] font-bold hover:bg-pitch-light cursor-pointer"
            >
              تیکت جدید
            </button>
            <button
              type="button"
              onClick={closeTicketsModal}
              className="rounded-lg p-1.5 text-ink/40 hover:bg-chalk cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 sm:grid-cols-[240px_1fr]">
          <div className="border-l border-line overflow-y-auto p-3 space-y-2 bg-chalk/20">
            {loading && tickets.length === 0 ? (
              <p className="text-[11px] text-ink/50 py-8 text-center">در حال بارگذاری...</p>
            ) : tickets.length === 0 ? (
              <p className="text-[11px] text-ink/50 py-8 text-center leading-relaxed">
                هنوز تیکتی ندارید. از دکمه «تیکت جدید» شروع کنید.
              </p>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTicket(t.id)}
                  className={`w-full text-right rounded-xl border p-2.5 cursor-pointer transition ${
                    selectedId === t.id
                      ? "border-pitch bg-white shadow-2xs"
                      : t.user_has_unread
                      ? "border-rose-300 bg-rose-50"
                      : "border-line bg-white hover:border-pitch/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-ink truncate">{t.subject}</span>
                    {t.user_has_unread && (
                      <span className="shrink-0 h-2 w-2 rounded-full bg-rose-600" />
                    )}
                  </div>
                  <p className="text-[10px] text-ink/50 mt-1 line-clamp-2">{t.last_preview}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span
                      className={`text-[10px] font-bold ${
                        t.status === "answered" ? "text-emerald-700" : "text-amber-800"
                      }`}
                    >
                      {t.status === "answered" ? "پاسخ داده شده" : "در انتظار پاسخ"}
                    </span>
                    <span className="text-[10px] text-ink/40">{formatWhen(t.last_message_at)}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="overflow-y-auto p-4 space-y-3">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-800">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900">
                {notice}
              </div>
            )}

            {showNew && (
              <form onSubmit={handleCreate} className="space-y-3">
                <h3 className="font-black text-sm text-slate-900">ثبت تیکت جدید</h3>
                <label className="block text-[11px] font-bold text-slate-700">
                  موضوع
                  <input
                    required
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    maxLength={120}
                    placeholder="مثلاً مشکل در فعال‌سازی لینک"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-pitch focus:outline-none"
                  />
                </label>
                <label className="block text-[11px] font-bold text-slate-700">
                  متن پیام
                  <textarea
                    required
                    value={newBody}
                    onChange={(e) => setNewBody(e.target.value)}
                    rows={6}
                    maxLength={4000}
                    placeholder="توضیح دهید چه کمکی لازم دارید یا چه پیشنهادی دارید..."
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-pitch focus:outline-none leading-relaxed"
                  />
                </label>
                <button
                  type="submit"
                  disabled={sending}
                  className="rounded-xl bg-pitch text-white px-4 py-2 text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  {sending ? "در حال ارسال..." : "ارسال تیکت"}
                </button>
              </form>
            )}

            {!showNew && !selectedId && (
              <div className="h-full min-h-[220px] flex items-center justify-center text-center text-xs text-ink/50 leading-relaxed">
                یک تیکت را از فهرست انتخاب کنید یا تیکت جدید بسازید.
              </div>
            )}

            {selectedId && !showNew && (
              <div className="flex flex-col h-full min-h-[280px]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-black text-sm text-slate-900">{selectedSubject}</h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      selectedStatus === "answered"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {selectedStatus === "answered" ? "پاسخ داده شده" : "در انتظار پاسخ"}
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[42vh] pe-1">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${
                        m.sender === "admin"
                          ? "bg-emerald-50 border border-emerald-200 text-emerald-950"
                          : "bg-slate-50 border border-slate-200 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-[10px]">
                          {m.sender === "admin" ? "پشتیبانی NexSport" : "شما"}
                        </span>
                        <span className="text-[10px] text-ink/40">{formatWhen(m.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleReply} className="mt-3 space-y-2">
                  <textarea
                    required
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={3}
                    placeholder="پیام بعدی خود را بنویسید..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-pitch focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    className="rounded-xl bg-pitch text-white px-4 py-2 text-xs font-black cursor-pointer disabled:opacity-50"
                  >
                    {sending ? "در حال ارسال..." : "ارسال پیام"}
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
