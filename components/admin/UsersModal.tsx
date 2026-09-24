"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { NexSportIcon } from "@/components/NexSportLogo";

interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  mobile: string;
  is_verified: boolean;
  role: string;
  created_at: string;
}

export function UsersModal() {
  const { isUsersModalOpen, closeUsersModal, isAdmin } = useAuth();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        setError(data.error || `خطا در دریافت کاربران (کد ${res.status})`);
        return;
      }

      if (data.users && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch {
      setError("خطا در ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی فرمایید.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isUsersModalOpen && isAdmin) {
      fetchUsers();
    }
  }, [isUsersModalOpen, isAdmin]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.mobile.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const formatPersianDate = (dateString?: string) => {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return dateString;
    }
  };

  if (!isUsersModalOpen || !isAdmin) return null;

  const totalCount = users.length;
  const verifiedCount = users.filter((u) => u.is_verified).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-ink/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-line flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line/70 bg-chalk/70 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <NexSportIcon size={26} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-pitch">مدیریت کاربران سامانه NexSport</h2>
                <span className="rounded-full bg-pitch/10 text-pitch px-2 py-0.5 text-[10px] font-black border border-pitch/20">
                  فقط دسترسی مدیر
                </span>
              </div>
              <p className="text-[11px] text-ink/60 mt-0.5">
                مشاهده آمار و فهرست کامل اعضای ثبت‌نام‌شده
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeUsersModal}
            className="rounded-lg p-1.5 text-ink/40 hover:bg-chalk hover:text-ink transition-colors cursor-pointer"
            title="بستن پنجره"
          >
            ✕
          </button>
        </div>

        {/* Top Summary Stats */}
        <div className="border-b border-line bg-chalk/30 px-5 py-3 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
            {/* Total Users */}
            <div className="rounded-xl border border-line/80 bg-white p-3 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] text-ink/60 font-semibold">تعداد کل کاربران</p>
                <p className="text-xl font-black text-pitch mt-0.5">
                  {totalCount.toLocaleString("fa-IR")}
                  <span className="text-xs font-normal text-ink/50 mr-1">کاربر</span>
                </p>
              </div>
              <span className="text-2xl opacity-75">👥</span>
            </div>

            {/* Verified Users */}
            <div className="rounded-xl border border-line/80 bg-white p-3 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] text-ink/60 font-semibold">تاییدشده با ایمیل</p>
                <p className="text-xl font-black text-emerald-700 mt-0.5">
                  {verifiedCount.toLocaleString("fa-IR")}
                  <span className="text-xs font-normal text-ink/50 mr-1">نفر</span>
                </p>
              </div>
              <span className="text-2xl opacity-75">✓</span>
            </div>

            {/* Search Input Box */}
            <div className="col-span-2 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی نام، ایمیل یا موبایل..."
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs text-ink focus:border-pitch focus:outline-none placeholder:text-ink/40"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink/40 hover:text-ink cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={fetchUsers}
                disabled={loading}
                title="به‌روزرسانی فهرست"
                className="rounded-xl border border-line bg-white hover:bg-chalk px-3 py-2.5 text-xs font-bold text-ink transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <span className={loading ? "animate-spin" : ""}>🔄</span>
                <span className="hidden sm:inline">بروزرسانی</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body / Table View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={fetchUsers}
                className="bg-rose-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold hover:bg-rose-700 transition"
              >
                تلاش مجدد
              </button>
            </div>
          )}

          {loading && users.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="inline-block animate-spin text-3xl">⏳</div>
              <p className="text-xs text-ink/60">در حال دریافت فهرست کاربران...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="text-3xl opacity-40">🔍</div>
              <p className="text-sm font-bold text-ink/70">کاربری یافت نشد</p>
              <p className="text-xs text-ink/50">
                {searchQuery ? "نتیجه‌ای مطابق با جستجوی شما پیدا نشد." : "هنوز کاربری در سامانه ثبت نشده است."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-right text-xs">
                  <thead className="bg-chalk/80 text-ink/70 font-bold border-b border-line text-[11px]">
                    <tr>
                      <th className="py-3 px-3 text-center w-14">ردیف</th>
                      <th className="py-3 px-4">نام و نام خانوادگی</th>
                      <th className="py-3 px-4">آدرس ایمیل</th>
                      <th className="py-3 px-4">شماره تماس</th>
                      <th className="py-3 px-4">تاریخ عضویت</th>
                      <th className="py-3 px-3 text-center w-24">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {filteredUsers.map((u, index) => {
                      const isCurrentUserAdmin = u.email === "salman.aryanezhad@gmail.com" || u.role === "admin";
                      return (
                        <tr key={u.id} className="hover:bg-chalk/40 transition-colors">
                          <td className="py-3 px-3 text-center font-mono text-ink/50 font-bold">
                            {(index + 1).toLocaleString("fa-IR")}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pitch/10 text-pitch font-black text-xs shrink-0">
                                {u.name.trim().charAt(0) || "👤"}
                              </span>
                              <div>
                                <p className="font-bold text-ink">{u.name}</p>
                                {isCurrentUserAdmin && (
                                  <span className="inline-block bg-pitch text-white text-[9px] font-black px-1.5 py-0.2 rounded mt-0.5">
                                    مدیر کل
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11.5px] text-ink/80 dir-ltr text-right">
                            {u.email}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-ink/80 dir-ltr text-right">
                            {u.mobile}
                          </td>
                          <td className="py-3 px-4 text-[11px] text-ink/70">
                            {formatPersianDate(u.created_at)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {u.is_verified ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                <span>✓</span>
                                <span>تایید شده</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                <span>در انتظار</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="md:hidden space-y-3">
                {filteredUsers.map((u, index) => {
                  const isCurrentUserAdmin = u.email === "salman.aryanezhad@gmail.com" || u.role === "admin";
                  return (
                    <div
                      key={u.id}
                      className="rounded-xl border border-line bg-white p-3.5 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pitch/10 text-pitch font-black text-xs shrink-0">
                            {u.name.trim().charAt(0) || "👤"}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-ink">{u.name}</span>
                              {isCurrentUserAdmin && (
                                <span className="bg-pitch text-white text-[9px] font-black px-1.5 py-0.2 rounded">
                                  مدیر کل
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-ink/40 font-mono">
                              ردیف {(index + 1).toLocaleString("fa-IR")}
                            </span>
                          </div>
                        </div>

                        <div>
                          {u.is_verified ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              <span>✓</span>
                              <span>تایید شده</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              <span>در انتظار</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg bg-chalk/50 p-2.5 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-ink/60">ایمیل:</span>
                          <span className="font-mono text-ink/90 dir-ltr text-right max-w-[200px] truncate" title={u.email}>
                            {u.email}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-ink/60">شماره تماس:</span>
                          <span className="font-mono text-ink/90 dir-ltr">{u.mobile}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-line/40">
                          <span className="text-ink/60">تاریخ عضویت:</span>
                          <span className="text-ink/75">{formatPersianDate(u.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line/70 bg-chalk/50 px-5 py-3 flex items-center justify-between text-xs text-ink/60 shrink-0">
          <span>
            نمایش <strong>{filteredUsers.length.toLocaleString("fa-IR")}</strong> از <strong>{totalCount.toLocaleString("fa-IR")}</strong> کاربر ثبت‌شده
          </span>
          <button
            type="button"
            onClick={closeUsersModal}
            className="rounded-lg bg-pitch px-4 py-1.5 font-bold text-white shadow-2xs hover:bg-pitch-light transition-colors cursor-pointer text-xs"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}
