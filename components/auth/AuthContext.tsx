"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

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
  isAuthModalOpen: boolean;
  isProfileModalOpen: boolean;
  modalTab: "login" | "register" | "verify" | "forgot" | "reset";
  pendingEmail: string | null;
  demoVerificationCode: string | null;
  openAuthModal: (tab?: "login" | "register" | "forgot") => void;
  closeAuthModal: () => void;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  setPendingVerification: (email: string, demoCode?: string | null) => void;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; email?: string; demoCode?: string }>;
  register: (name: string, email: string, mobile: string, password: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; email?: string; demoCode?: string }>;
  verifyEmail: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  resendCode: (email: string) => Promise<{ success: boolean; error?: string; demoCode?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string; demoCode?: string }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (name: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  handleSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"login" | "register" | "verify" | "forgot" | "reset">("login");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [demoVerificationCode, setDemoVerificationCode] = useState<string | null>(null);

  function handleSessionExpired() {
    setUser(null);
    setIsProfileModalOpen(false);
    try {
      fetch("/api/auth/logout", { method: "POST" });
    } catch {}
  }

  useEffect(() => {
    async function checkMe() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || null);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkMe();
  }, []);

  function openAuthModal(tab: "login" | "register" | "forgot" = "login") {
    setModalTab(tab);
    setDemoVerificationCode(null);
    setIsAuthModalOpen(true);
  }

  function closeAuthModal() {
    setIsAuthModalOpen(false);
    setDemoVerificationCode(null);
  }

  function openProfileModal() {
    setIsProfileModalOpen(true);
  }

  function closeProfileModal() {
    setIsProfileModalOpen(false);
  }

  function setPendingVerification(email: string, demoCode?: string | null) {
    setPendingEmail(email);
    if (demoCode) setDemoVerificationCode(demoCode);
    setModalTab("verify");
  }

  async function login(identifier: string, password: string) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error: data.error || "خطا در ورود به حساب کاربری",
        };
      }

      if (data.requiresVerification) {
        setPendingEmail(data.email);
        if (data.demoCode) setDemoVerificationCode(data.demoCode);
        setModalTab("verify");
        return {
          success: false,
          requiresVerification: true,
          email: data.email,
          demoCode: data.demoCode,
        };
      }

      setUser(data.user);
      closeAuthModal();
      return { success: true };
    } catch {
      return { success: false, error: "خطای ارتباط با سرور" };
    }
  }

  async function register(name: string, email: string, mobile: string, password: string) {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, mobile, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error: data.error || "خطا در ثبت‌نام",
        };
      }

      setPendingEmail(data.email);
      if (data.demoCode) setDemoVerificationCode(data.demoCode);
      setModalTab("verify");
      return {
        success: true,
        requiresVerification: true,
        email: data.email,
        demoCode: data.demoCode,
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

      setUser(data.user);
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
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || "خطا در ارسال مجدد کد" };
      }

      if (data.demoCode) setDemoVerificationCode(data.demoCode);
      return { success: true, demoCode: data.demoCode };
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
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || "خطا در درخواست بازیابی رمز" };
      }

      setPendingEmail(email);
      if (data.demoCode) setDemoVerificationCode(data.demoCode);
      setModalTab("reset");
      return { success: true, demoCode: data.demoCode };
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

      setUser(data.user);
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

      setUser(data.user);
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
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthModalOpen,
        isProfileModalOpen,
        modalTab,
        pendingEmail,
        demoVerificationCode,
        openAuthModal,
        closeAuthModal,
        openProfileModal,
        closeProfileModal,
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
