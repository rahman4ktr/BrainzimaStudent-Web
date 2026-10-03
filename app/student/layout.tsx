"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  FileText,
  FolderOpen,
  CreditCard,
  Receipt,
  UserCircle2,
  KeyRound,
  LogOut,
  X,
  Loader2,
} from "lucide-react";
import { getSession, getFileUrl, getInitials } from "@/lib/session";
import { useStudent } from "@/hooks/useStudent";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  {
    label: "Main",
    items: [
      { href: "/student/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/student/courses", icon: BookOpen, label: "My Courses" },
      { href: "/student/notes", icon: FileText, label: "Notes & Materials" },
      { href: "/student/materials", icon: FolderOpen, label: "Study Materials" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/student/fees", icon: CreditCard, label: "Fee Details" },
      { href: "/student/payments", icon: Receipt, label: "Payments" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/student/profile", icon: UserCircle2, label: "My Profile" },
      { href: "/student/documents", icon: FolderOpen, label: "Documents" },
      { href: "/student/change-password", icon: KeyRound, label: "Change Password" },
    ],
  },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const { name, registration_number, user_image } = useStudent();
  const avatarUrl = getFileUrl(user_image);
  const initials = getInitials(name);

  useEffect(() => {
    const verifyStudentSession = () => {
      const session = getSession();

      const isStudent = Boolean(
        session &&
        session.is_student === true &&
        session.student_id !== null &&
        session.student_id !== undefined &&
        String(session.student_id).trim() !== "" &&
        Number(session.student_id) > 0
      );

      if (!isStudent) {
        setIsAuthorized(false);
        router.replace("/user/courses");
        return;
      }

      setIsAuthorized(true);
    };

    verifyStudentSession();
    window.addEventListener("brainzima_session_change", verifyStudentSession);
    return () => {
      window.removeEventListener("brainzima_session_change", verifyStudentSession);
    };
  }, [router, pathname]);

  if (isAuthorized !== true) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#1E1B4B]/25"
            style={{
              background:
                "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)",
            }}
          >
            <GraduationCap className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5B21F4]" />
            <span>Verifying student session...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* ── Desktop Sidebar ── */}
      <Sidebar />

      {/* ── Main Content Area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <Header
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          mobileMenuOpen={mobileMenuOpen}
        />

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto pb-20 lg:pb-0"
          id="main-content"
        >
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Navigation ── */}
      <BottomNav
        onSidebarToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        isSidebarOpen={mobileMenuOpen}
      />

      {/* ── Mobile Drawer Overlay ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col shadow-2xl"
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
                  <p className="text-[10px] font-bold tracking-widest text-[#5B21F4] uppercase">Student Portal</p>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="ml-auto w-8 h-8 rounded-xl flex items-center justify-center text-[#94A3B8] hover:text-[#5B21F4] hover:bg-[#F1EEFF] transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Student info card */}
              <div className="mx-3 mt-3 p-3 rounded-2xl bg-gradient-to-r from-[#F1EEFF] to-[#EFF6FF] border border-[#DDD6FE]/60 flex items-center gap-3">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={name}
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-white shadow-sm"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: "linear-gradient(135deg, #5B21F4, #2563EB)" }}
                  >
                    {initials}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#111827] truncate">{name}</p>
                  <p className="text-[11px] text-[#64748B]">
                    {registration_number || "Enrolled Student"}
                  </p>
                </div>
              </div>

              {/* Nav Groups */}
              <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
                {mobileNavItems.map((group) => (
                  <div key={group.label} className="mb-2">
                    <p className="px-3 mb-1 text-[10px] font-bold tracking-widest text-[#94A3B8] uppercase select-none">
                      {group.label}
                    </p>
                    {group.items.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative",
                            isActive
                              ? "bg-[#F1EEFF] text-[#5B21F4]"
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
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>

              {/* Drawer Footer - Logout */}
              <div className="border-t border-[#E2E8F0] p-3 shrink-0">
                <Link
                  href="/student/logout"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#EF4444] hover:bg-[#FEF2F2] transition-all"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  Logout
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
