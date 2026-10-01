"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { shouldSkipAdminSensitiveReauth } from "@/lib/auth/utils";

const CLIENT_SESSION_KEY = "nexsport_session";

function saveClientSession(token?: string | null) {
  try {
    if (typeof window === "undefined") return;
    if (token) localStorage.setItem(CLIENT_SESSION_KEY, token);
    else localStorage.removeItem(CLIENT_SESSION_KEY);
  } catch {}
}

function readClientSession(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const fromLs = localStorage.getItem(CLIENT_SESSION_KEY);
    if (fromLs) return fromLs;
    const match = document.cookie.match(/(?:^|; )nexsport_client_token=([^;]*)/);
    const fromCookie = match ? decodeURIComponent(match[1]) : "";
    if (fromCookie) {
      localStorage.setItem(CLIENT_SESSION_KEY, fromCookie);
      return fromCookie;
    }
  } catch {}
  return null;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  is_verified: boolean;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  isAuthModalOpen: boolean;
  isProfileModalOpen: boolean;
  isUsersModalOpen: boolean;
  isAdminTournamentsModalOpen: boolean;
  isAdminTeamsModalOpen: boolean;
  adminTournamentsFilterUserId: string | null;
  isDiscountsModalOpen: boolean;
  isPricingModalOpen: boolean;
  isTicketsModalOpen: boolean;
  isAdminTicketsModalOpen: boolean;
  ticketUnreadCount: number;
  ticketUnansweredCount: number;
  sensitiveUnlockTarget: "discounts" | "pricing" | null;
  modalTab: "login" | "register" | "verify" | "forgot" | "reset";
  pendingEmail: string | null;
  demoVerificationCode: string | null;
  openAuthModal: (tab?: "login" | "register" | "forgot") => void;
  closeAuthModal: () => void;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  openUsersModal: () => void;
  closeUsersModal: () => void;
  openAdminTournamentsModal: (userId?: string) => void;
  closeAdminTournamentsModal: () => void;
  openAdminTeamsModal: () => void;
  closeAdminTeamsModal: () => void;
  openDiscountsModal: () => void;
  closeDiscountsModal: () => void;
  openPricingModal: () => void;
  closePricingModal: () => void;
  requestOpenDiscountsModal: () => void;
  requestOpenPricingModal: () => void;
  closeSensitiveUnlock: () => void;
  unlockSensitiveAdmin: () => void;
  openTicketsModal: () => void;
  closeTicketsModal: () => void;
  openAdminTicketsModal: () => void;
  closeAdminTicketsModal: () => void;
  refreshTicketBadge: () => Promise<void>;
  setPendingVerification: (email: string) => void;
  login: (
    identifier: string,
    password: string,
    forceKick?: boolean
  ) => Promise<{
    success: boolean;
    error?: string;
    requiresVerification?: boolean;
    requiresConfirmation?: boolean;
    conflictingDevice?: "mobile" | "desktop";
    deviceLabel?: string;
    message?: string;
    email?: string;
  }>;
  register: (name: string, email: string, mobile: string, password: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; email?: string }>;
  verifyEmail: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  resendCode: (email: string) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (name: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  handleSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isAdminTournamentsModalOpen, setIsAdminTournamentsModalOpen] = useState(false);
  const [isAdminTeamsModalOpen, setIsAdminTeamsModalOpen] = useState(false);
  const [adminTournamentsFilterUserId, setAdminTournamentsFilterUserId] = useState<string | null>(null);
  const [isDiscountsModalOpen, setIsDiscountsModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isTicketsModalOpen, setIsTicketsModalOpen] = useState(false);
  const [isAdminTicketsModalOpen, setIsAdminTicketsModalOpen] = useState(false);
  const [ticketUnreadCount, setTicketUnreadCount] = useState(0);
  const [ticketUnansweredCount, setTicketUnansweredCount] = useState(0);
  const [sensitiveUnlockTarget, setSensitiveUnlockTarget] = useState<"discounts" | "pricing" | null>(null);
  const [skipSensitiveReauth, setSkipSensitiveReauth] = useState(() => shouldSkipAdminSensitiveReauth());
  const [modalTab, setModalTab] = useState<"login" | "register" | "verify" | "forgot" | "reset">("login");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [demoVerificationCode, setDemoVerificationCode] = useState<string | null>(null);

  const isAdmin = Boolean(user && user.role === "admin");

  function syncUser(u: AuthUser | null) {
    setUser(u);
    try {
      if (typeof window !== "undefined") {
        if (u) {
          localStorage.setItem("nexsport_user_cache", JSON.stringify(u));
        } else {
          localStorage.removeItem("nexsport_user_cache");
        }
      }
    } catch {}
  }

  function handleSessionExpired() {
    saveClientSession(null);
    syncUser(null);
    setIsProfileModalOpen(false);
    try {
      fetch("/api/auth/logout/", { method: "POST", credentials: "same-origin" });
    } catch {}
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const orig = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
            ? input.toString()
            : (input as Request).url;
        if (url && (url.startsWith("/api/") || url.includes("/api/"))) {
          const headers = new Headers(init?.headers);
          const token = readClientSession();
          if (token && !headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${token}`);
          }
          return orig(input, { ...init, headers, credentials: init?.credentials || "same-origin" });
        }
      } catch {}
      return orig(input, init);
    };
    return () => {
      window.fetch = orig;
    };
  }, []);

  // Restore cached user immediately on mount for zero-delay rendering
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("nexsport_user_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id) {
            setUser(parsed);
          }
        }
      }
    } catch {}

    async function checkMe() {
      try {
        const res = await fetch("/api/auth/me/", { credentials: "same-origin" });
        if (!res.ok) {
          // Transient 5xx on serverless must not wipe a cached login.
          return;
        }
        const data = await res.json();
        if (data && data.skipSensitiveReauth === true) setSkipSensitiveReauth(true);
        if (data && data.user) {
          if (data.token) saveClientSession(data.token);
          syncUser(data.user);
        } else if (data && data.expired) {
          saveClientSession(null);
          syncUser(null);
        }
        // No user and not expired: keep the cached login (cookie may be late).
      } catch (err) {
        console.error("Auth check failed:", err);
      }
    }
    checkMe();
  }, []);

  useEffect(() => {
    if (!user) {
      setTicketUnreadCount(0);
      setTicketUnansweredCount(0);
      return;
    }
    refreshTicketBadge();
    const timer = setInterval(() => {
      refreshTicketBadge();
    }, 45000);
    return () => clearInterval(timer);
  }, [user?.id]);

  function openAuthModal(tab: "login" | "register" | "forgot" = "login") {
    setModalTab(tab);
    setIsAuthModalOpen(true);
  }

  function closeAuthModal() {
    setIsAuthModalOpen(false);
  }

  function openProfileModal() {
    setIsProfileModalOpen(true);
  }

  function closeProfileModal() {
    setIsProfileModalOpen(false);
  }

  function openUsersModal() {
    setIsUsersModalOpen(true);
  }

  function closeUsersModal() {
    setIsUsersModalOpen(false);
  }

  function openAdminTournamentsModal(userId?: string) {
    setIsUsersModalOpen(false);
    setIsProfileModalOpen(false);
    setAdminTournamentsFilterUserId(userId || null);
    setIsAdminTournamentsModalOpen(true);
  }

  function closeAdminTournamentsModal() {
    setIsAdminTournamentsModalOpen(false);
    setAdminTournamentsFilterUserId(null);
  }

  function openAdminTeamsModal() {
    setIsUsersModalOpen(false);
    setIsAdminTeamsModalOpen(true);
  }

  function closeAdminTeamsModal() {
    setIsAdminTeamsModalOpen(false);
  }

  function openDiscountsModal() {
    setIsDiscountsModalOpen(true);
  }

  function closeDiscountsModal() {
    setIsDiscountsModalOpen(false);
  }

  function openPricingModal() {
    setIsPricingModalOpen(true);
  }

  function closePricingModal() {
    setIsPricingModalOpen(false);
  }

  function requestOpenDiscountsModal() {
    setIsUsersModalOpen(false);
    setIsProfileModalOpen(false);
    setIsPricingModalOpen(false);
    if (skipSensitiveReauth || shouldSkipAdminSensitiveReauth()) {
      setSensitiveUnlockTarget(null);
      setIsDiscountsModalOpen(true);
      return;
    }
    setSensitiveUnlockTarget("discounts");
  }

  function requestOpenPricingModal() {
    setIsUsersModalOpen(false);
    setIsProfileModalOpen(false);
    setIsDiscountsModalOpen(false);
    if (skipSensitiveReauth || shouldSkipAdminSensitiveReauth()) {
      setSensitiveUnlockTarget(null);
      setIsPricingModalOpen(true);
      return;
    }
    setSensitiveUnlockTarget("pricing");
  }

  function closeSensitiveUnlock() {
    setSensitiveUnlockTarget(null);
  }

  function unlockSensitiveAdmin() {
    const target = sensitiveUnlockTarget;
    setSensitiveUnlockTarget(null);
    if (target === "discounts") {
      setIsDiscountsModalOpen(true);
    } else if (target === "pricing") {
      setIsPricingModalOpen(true);
    }
  }

  function openTicketsModal() {
    setIsAdminTicketsModalOpen(false);
    setIsTicketsModalOpen(true);
  }

  function closeTicketsModal() {
    setIsTicketsModalOpen(false);
  }

  function openAdminTicketsModal() {
    setIsTicketsModalOpen(false);
    setIsUsersModalOpen(false);
    setIsAdminTicketsModalOpen(true);
  }

  function closeAdminTicketsModal() {
    setIsAdminTicketsModalOpen(false);
  }

  async function refreshTicketBadge() {
    try {
      const res = await fetch("/api/tickets/badge");
      if (!res.ok) return;
      const data = await res.json();
      setTicketUnreadCount(Number(data.unreadCount || 0));
      setTicketUnansweredCount(Number(data.unansweredCount || 0));
    } catch {}
  }

  function setPendingVerification(email: string) {
    setPendingEmail(email);
    setModalTab("verify");
  }

  async function login(identifier: string, password: string, forceKick = false) {
    try {
      const deviceType =
        typeof window !== "undefined" &&
        /android|iphone|ipad|ipod|blackberry|mobile|touch/i.test(navigator.userAgent || "")
          ? "mobile"
          : "desktop";

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          password,
          deviceType,
          forceKick: !!forceKick,
        }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        return {
          success: false,
          error: data.error || (res.status === 404 ? "مسیر سرور یافت نشد (کد ۴۰۴)." : `خطای سرور (${res.status})`),
        };
      }

      if (data.requiresVerification) {
        setPendingEmail(data.email);
        if (data.demoCode) {
          setDemoVerificationCode(data.demoCode);
        }
        setModalTab("verify");
        return {
          success: false,
          requiresVerification: true,
          email: data.email,
        };
      }

      if (data.requiresConfirmation) {
        return {
          success: false,
          requiresConfirmation: true,
          conflictingDevice: data.conflictingDevice,
          deviceLabel: data.deviceLabel,
          message: data.message,
        };
      }

      if (data.token) saveClientSession(data.token);
      syncUser(data.user);
      closeAuthModal();
      return { success: true };
    } catch {
      return { success: false, error: "خطای ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی نمایید." };
    }
  }

  async function register(name: string, email: string, mobile: string, password: string) {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, mobile, password }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        return {
          success: false,
          error: data.error || (res.status === 404 ? "مسیر سرور یافت نشد (کد ۴۰۴)." : `خطای سرور (${res.status})`),
        };
      }

      setPendingEmail(data.email);
      if (data.demoCode) {
        setDemoVerificationCode(data.demoCode);
      }
      setModalTab("verify");
      return {
        success: true,
        requiresVerification: true,
        email: data.email,
      };
    } catch {
      return { success: false, error: "خطای ارتباط با سرور" };
    }
  }

  async function verifyEmail(email: string, code: string) {
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || "کد نامعتبر است" };
      }

      if (data.token) saveClientSession(data.token);
      syncUser(data.user);
      closeAuthModal();
      return { success: true };
    } catch {
      return { success: false, error: "خطای ارتباط با سرور" };
    }
  }

  async function resendCode(email: string) {
    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (data.demoCode) {
        setDemoVerificationCode(data.demoCode);
      }

      if (!res.ok) {
        return { success: false, error: data.error || "خطا در ارسال مجدد کد" };
      }

      return { success: true };
    } catch {
      return { success: false, error: "خطای ارتباط با سرور" };
    }
  }

  async function forgotPassword(email: string) {
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (data.demoCode) {
        setDemoVerificationCode(data.demoCode);
      }

      if (!res.ok) {
        return { success: false, error: data.error || "خطا در درخواست بازیابی رمز" };
      }

      setPendingEmail(email);
      setModalTab("reset");
      return { success: true };
    } catch {
      return { success: false, error: "خطای ارتباط با سرور" };
    }
  }

  async function resetPassword(email: string, code: string, newPassword: string) {
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || "کد بازیابی نامعتبر است" };
      }

      if (data.token) saveClientSession(data.token);
      syncUser(data.user);
      closeAuthModal();
      return { success: true };
    } catch {
      return { success: false, error: "خطای ارتباط با سرور" };
    }
  }

  async function updateProfile(name: string) {
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();

      if (res.status === 401 || data.expired) {
        handleSessionExpired();
        return { success: false, error: "نشست شما منقضی شده است. لطفاً مجدداً وارد شوید." };
      }

      if (!res.ok) {
        return { success: false, error: data.error || "خطا در به‌روزرسانی نام" };
      }

      syncUser(data.user);
      return { success: true };
    } catch {
      return { success: false, error: "خطای ارتباط با سرور" };
    }
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (res.status === 401 || data.expired) {
        handleSessionExpired();
        return { success: false, error: "نشست شما منقضی شده است. لطفاً مجدداً وارد شوید." };
      }

      if (!res.ok) {
        return { success: false, error: data.error || "خطا در تغییر رمز عبور" };
      }

      return { success: true };
    } catch {
      return { success: false, error: "خطای ارتباط با سرور" };
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout/", { method: "POST", credentials: "same-origin" });
    } finally {
      saveClientSession(null);
      syncUser(null);
      setTicketUnreadCount(0);
      setTicketUnansweredCount(0);
      setIsTicketsModalOpen(false);
      setIsAdminTicketsModalOpen(false);
      setIsAdminTournamentsModalOpen(false);
      setIsAdminTeamsModalOpen(false);
      setAdminTournamentsFilterUserId(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        isAuthModalOpen,
        isProfileModalOpen,
        isUsersModalOpen,
        isAdminTournamentsModalOpen,
        isAdminTeamsModalOpen,
        adminTournamentsFilterUserId,
        isDiscountsModalOpen,
        isPricingModalOpen,
        isTicketsModalOpen,
        isAdminTicketsModalOpen,
        ticketUnreadCount,
        ticketUnansweredCount,
        sensitiveUnlockTarget,
        modalTab,
        pendingEmail,
        demoVerificationCode,
        openAuthModal,
        closeAuthModal,
        openProfileModal,
        closeProfileModal,
        openUsersModal,
        closeUsersModal,
        openAdminTournamentsModal,
        closeAdminTournamentsModal,
        openAdminTeamsModal,
        closeAdminTeamsModal,
        openDiscountsModal,
        closeDiscountsModal,
        openPricingModal,
        closePricingModal,
        requestOpenDiscountsModal,
        requestOpenPricingModal,
        closeSensitiveUnlock,
        unlockSensitiveAdmin,
        openTicketsModal,
        closeTicketsModal,
        openAdminTicketsModal,
        closeAdminTicketsModal,
        refreshTicketBadge,
        setPendingVerification,
        login,
        register,
        verifyEmail,
        resendCode,
        forgotPassword,
        resetPassword,
        updateProfile,
        changePassword,
        logout,
        handleSessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
