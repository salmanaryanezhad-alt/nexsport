"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

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
  modalTab: "login" | "register" | "verify" | "forgot" | "reset";
  pendingEmail: string | null;
  demoVerificationCode: string | null;
  openAuthModal: (tab?: "login" | "register" | "forgot") => void;
  closeAuthModal: () => void;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  openUsersModal: () => void;
  closeUsersModal: () => void;
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
  const [modalTab, setModalTab] = useState<"login" | "register" | "verify" | "forgot" | "reset">("login");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [demoVerificationCode, setDemoVerificationCode] = useState<string | null>(null);

  const isAdmin = Boolean(
    user &&
    (user.email?.trim().toLowerCase() === "salman.aryanezhad@gmail.com" || user.role === "admin")
  );

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
    syncUser(null);
    setIsProfileModalOpen(false);
    try {
      fetch("/api/auth/logout", { method: "POST" });
    } catch {}
  }

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
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            syncUser(data.user);
          } else {
            syncUser(null);
          }
        } else {
          syncUser(null);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      }
    }
    checkMe();
  }, []);

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
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      syncUser(null);
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
        modalTab,
        pendingEmail,
        demoVerificationCode,
        openAuthModal,
        closeAuthModal,
        openProfileModal,
        closeProfileModal,
        openUsersModal,
        closeUsersModal,
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
