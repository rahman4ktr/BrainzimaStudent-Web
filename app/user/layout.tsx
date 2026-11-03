"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import UserSidebar from "@/components/user/UserSidebar";
import UserHeader from "@/components/user/UserHeader";
import UserBottomNav from "@/components/user/UserBottomNav";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  BookMarked,
  UserCircle2,
  KeyRound,
  LogOut,
  X,
  Loader2,
  Sparkles,
  ChevronRight,
  Bell,
  QrCode,
  FileText,
  FolderOpen,
  CreditCard,
  Receipt,
  Lock,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSession, getFileUrl, getInitials } from "@/lib/session";
import { useAuth } from "@/context/AuthContext";

interface MobileNavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isPro?: boolean;
}

interface MobileNavGroup {
  label: string;
  items: MobileNavItem[];
}

const mobileNavItems: MobileNavGroup[] = [
  {
    label: "Main",
    items: [
      { href: "/user/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/user/id-card", icon: QrCode, label: "Digital ID Card", isPro: true },
      { href: "/user/my-courses", icon: BookOpen, label: "My Courses", isPro: true },
      { href: "/user/courses", icon: GraduationCap, label: "Offline Courses" },
      { href: "/user/online-courses", icon: Sparkles, label: "Online Courses" },
      { href: "/user/certificate", icon: Award, label: "Certificate" },
      { href: "/user/notes", icon: FileText, label: "Notes & Materials", isPro: true },
      { href: "/user/materials", icon: FolderOpen, label: "Study Materials", isPro: true },
      { href: "/user/ebook-library", icon: BookMarked, label: "Ebook Library" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/user/fees", icon: CreditCard, label: "Fee Details", isPro: true },
      { href: "/user/payments", icon: Receipt, label: "Payments", isPro: true },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/user/profile", icon: UserCircle2, label: "My Profile" },
      { href: "/user/documents", icon: FolderOpen, label: "Documents", isPro: true },
      { href: "/user/notifications", icon: Bell, label: "Offers & Alerts" },
      { href: "/user/change-password", icon: KeyRound, label: "Change Password" },
    ],
  },
];

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const avatarUrl = getFileUrl(user?.user_image);
  const initials = getInitials(user?.name);
  const displayName = user?.name || "Ajit Kumar";

  useEffect(() => {
    const verifyUserSession = () => {
      const session = getSession();
      const hasValidAccess = Boolean(
        (session?.user_id && Number(session.user_id) > 0) ||
        (session?.student_id && Number(session.student_id) > 0)
      );

      if (!hasValidAccess) {
        setIsAuthorized(false);
        router.replace("/");
      } else {
        setIsAuthorized(true);
      }
    };

    verifyUserSession();
    window.addEventListener("brainzima_session_change", verifyUserSession);
    return () => {
      window.removeEventListener("brainzima_session_change", verifyUserSession);
    };
  }, [router]);

  if (isAuthorized !== true) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#5B21F4]/25"
            style={{
              background:
                "linear-gradient(135deg, #5B21F4 0%, #7C3AED 55%, #2563EB 100%)",
            }}
          >
            <GraduationCap className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5B21F4]" />
            <span>Verifying session...</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Dedicated Distraction-Free Full-Screen Examination Mode (No Sidebar, No Header, No BottomNav) ──
  const isQuizMode = pathname?.includes("/quiz");
  if (isQuizMode) {
    return (
      <div className="min-h-screen w-full bg-[#F8F6FD]">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* ── Desktop Sidebar ── */}
      <UserSidebar />

      {/* ── Main Content Area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <UserHeader
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          mobileMenuOpen={mobileMenuOpen}
        />
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0 relative" id="user-main-content">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Navigation ── */}
      <UserBottomNav
        onSidebarToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        isSidebarOpen={mobileMenuOpen}
      />

      {/* ── Mobile Drawer Overlay ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              key="user-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />

            <motion.aside
              key="user-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="lg:hidden fixed inset-y-0 right-0 z-50 w-72 sm:w-80 bg-white flex flex-col shadow-2xl border-l border-[#E2E8F0]"
            >
              {/* Drawer Header */}
              <div className="flex items-center h-16 px-4 border-b border-[#E2E8F0] shrink-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md shadow-[#5B21F4]/20 shrink-0"
                  style={{ background: "linear-gradient(135deg, #5B21F4 0%, #7C3AED 55%, #2563EB 100%)" }}
                >
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-black tracking-tight text-[#111827] leading-none">Brainzima</p>
                  <p className="text-[10px] font-bold tracking-widest text-[#5B21F4] uppercase">User Portal</p>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="ml-auto w-8 h-8 rounded-xl flex items-center justify-center text-[#94A3B8] hover:text-[#5B21F4] hover:bg-[#F1EEFF] transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User info card */}
              <div className="mx-3 mt-3 p-3 rounded-2xl bg-gradient-to-r from-[#F1EEFF] to-[#EFF6FF] border border-[#DDD6FE]/60 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: "linear-gradient(135deg, #5B21F4, #2563EB)" }}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#111827] truncate">{displayName}</p>
                  <p className="text-[11px] text-[#64748B]">Prospective Student</p>
                </div>
              </div>

              {/* Logout button directly below user info card */}
              <div className="mx-3 mt-2 mb-2">
                <Link
                  href="/user/logout"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200/80 transition-all shadow-sm"
                >
                  <LogOut className="w-4 h-4 text-red-600" />
                  <span>Logout</span>
                </Link>
              </div>

              {/* Nav Groups */}
              <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
                {mobileNavItems.map((group) => (
                  <div key={group.label} className="mb-2">
                    <p className="px-3 mb-1 text-[10px] font-bold tracking-widest text-[#94A3B8] uppercase select-none">
                      {group.label}
                    </p>
                    {group.items.map((item) => {
                      const isActive =
                        item.href === "/user/courses"
                          ? pathname === "/user/courses" ||
                            pathname.startsWith("/user/courses/") ||
                            pathname === "/user/offline-courses" ||
                            pathname.startsWith("/user/offline-courses/")
                          : pathname === item.href ||
                            (item.href !== "/user/dashboard" && pathname.startsWith(item.href + "/"));

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative",
                            isActive
                              ? "bg-[#F1EEFF] text-[#5B21F4] font-semibold"
                              : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#111827]"
                          )}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-[#5B21F4]" />
                          )}
                          <item.icon
                            className={cn(
                              "w-5 h-5 shrink-0",
                              isActive ? "text-[#5B21F4]" : "text-[#94A3B8]"
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                          {item.isPro && (
                            <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0 ml-auto" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
