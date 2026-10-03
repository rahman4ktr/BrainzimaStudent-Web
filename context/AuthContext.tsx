"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  getSession,
  saveSession,
  clearSession,
  updateSession,
  type BrainzimaSession,
} from "@/lib/session";
import type { LoginData } from "@/lib/api";

interface AuthContextType {
  user: BrainzimaSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginData | Partial<BrainzimaSession>) => BrainzimaSession;
  logout: () => void;
  updateUserImage: (newPath: string | null) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => {
    throw new Error("AuthProvider not mounted");
  },
  logout: () => {},
  updateUserImage: () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<BrainzimaSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize session from sessionStorage on client mount
  useEffect(() => {
    const current = getSession();
    setUser(current);
    setIsLoading(false);

    // Listen to session changes across the app
    const handleSessionChange = (e: Event) => {
      const customEvent = e as CustomEvent<BrainzimaSession | null>;
      setUser(customEvent.detail ?? getSession());
    };

    window.addEventListener("brainzima_session_change", handleSessionChange);
    return () => {
      window.removeEventListener("brainzima_session_change", handleSessionChange);
    };
  }, []);

  const login = useCallback(
    (data: LoginData | Partial<BrainzimaSession>) => {
      const newSession = saveSession(data as any);
      setUser(newSession);
      return newSession;
    },
    []
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const updateUserImage = useCallback((newPath: string | null) => {
    const updated = updateSession({ user_image: newPath });
    if (updated) setUser(updated);
  }, []);

  const refreshProfile = useCallback(async () => {
    const current = getSession();
    if (!current?.user_id) return;

    try {
      const res = await fetch(`/api/user/me`, {
        headers: {
          "X-User-Id": String(current.user_id),
          "X-User-Role": current.role || "user",
        },
      });
      const json = await res.json();
      if (json.success && json.data) {
        const updated = updateSession({
          name: json.data.name ?? current.name,
          email: json.data.email ?? current.email,
          mobile: json.data.mobile ?? current.mobile,
          role: json.data.role ?? current.role,
          is_student: json.data.is_student ?? current.is_student,
          student_id: json.data.student_id ?? current.student_id,
          registration_number:
            json.data.registration_number ?? current.registration_number,
          user_image: json.data.user_image ?? current.user_image,
          user_verified: json.data.verified ?? current.user_verified,
          last_login_at: json.data.last_login_at ?? current.last_login_at,
          last_login_ip: json.data.last_login_ip ?? current.last_login_ip,
        });
        if (updated) setUser(updated);
      }
    } catch (err) {
      console.warn("[Auth] Failed to refresh profile:", err);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        updateUserImage,
        refreshProfile,
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
