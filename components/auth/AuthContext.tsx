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
  modalTab: "login" | "register" | "verify";
  pendingEmail: string | null;
  demoVerificationCode: string | null;
  openAuthModal: (tab?: "login" | "register") => void;
  closeAuthModal: () => void;
  setPendingVerification: (email: string, demoCode?: string | null) => void;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; email?: string; demoCode?: string }>;
  register: (name: string, email: string, mobile: string, password: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; email?: string; demoCode?: string }>;
  verifyEmail: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  resendCode: (email: string) => Promise<{ success: boolean; error?: string; demoCode?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"login" | "register" | "verify">("login");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [demoVerificationCode, setDemoVerificationCode] = useState<string | null>(null);

  useEffect(() => {
    async function checkMe() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || null);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        setLoading(false);
      }
    }
    checkMe();
  }, []);

  function openAuthModal(tab: "login" | "register" = "login") {
    setModalTab(tab);
    setDemoVerificationCode(null);
    setIsAuthModalOpen(true);
  }

  function closeAuthModal() {
    setIsAuthModalOpen(false);
    setDemoVerificationCode(null);
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
        modalTab,
        pendingEmail,
        demoVerificationCode,
        openAuthModal,
        closeAuthModal,
        setPendingVerification,
        login,
        register,
        verifyEmail,
        resendCode,
        logout,
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
