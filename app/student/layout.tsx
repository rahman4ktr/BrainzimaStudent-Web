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
  BookMarked,
  FileText,
  FolderOpen,
  CreditCard,
  Receipt,
  UserCircle2,
  KeyRound,
  LogOut,
  X,
  Loader2,
  Sparkles,
  QrCode,
  Award,
  ClipboardList,
} from "lucide-react";
import { getSession, getFileUrl, getInitials } from "@/lib/session";
import { useStudent } from "@/hooks/useStudent";
import { formatRegistrationNumber } from "@/lib/studentUtils";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  {
    label: "Main",
    items: [
      { href: "/student/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/student/id-card", icon: QrCode, label: "Digital ID Card" },
      { href: "/student/courses", icon: BookOpen, label: "My Courses" },
      { href: "/student/offline-courses", icon: GraduationCap, label: "Offline Courses" },
      { href: "/student/online-courses", icon: Sparkles, label: "Online Courses" },
      { href: "/student/certificate", icon: Award, label: "Certificate" },
      { href: "/student/notes", icon: FileText, label: "Notes & Materials" },
      { href: "/student/materials", icon: FolderOpen, label: "Study Materials" },
      { href: "/student/ebook-library", icon: BookMarked, label: "Ebook Library" },
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

  const { name, registration_number, student_id, user_id, user_image } = useStudent();
  const avatarUrl = getFileUrl(user_image);
  const initials = getInitials(name);

  const bisrId =
    registration_number ||
    formatRegistrationNumber(student_id) ||
    (user_id ? `BISR${String(user_id).padStart(4, "0")}` : "BISR-STUDENT");

  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(
    bisrId
  )}&centerImageUrl=https://panel.brainzima.com/assets/img/logo-brainzima-icon.png`;

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
        const userPath = pathname.startsWith("/student")
          ? pathname.replace(/^\/student/, "/user")
          : "/user/dashboard";
        router.replace(userPath);
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
          className="flex-1 overflow-y-auto pb-20 lg:pb-0 relative"
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

              {/* Logout button directly below student info card */}
              <div className="mx-3 mt-2 mb-2">
                <Link
                  href="/student/logout"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200/80 transition-all shadow-sm"
                >
                  <LogOut className="w-4 h-4 text-red-600" />
                  <span>Logout</span>
                </Link>
              </div>

              {/* ID-CARD section with QuickChart QR code */}
              <div className="mx-3 mb-2 p-3 rounded-2xl bg-gradient-to-br from-[#111827] via-[#1E1B4B] to-[#311042] text-white shadow-md border border-white/10">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-[#5B21F4] flex items-center justify-center">
                      <GraduationCap className="w-2.5 h-2.5 text-white" />
                    </div>
                    <span className="text-[10px] font-black tracking-widest text-[#DDD6FE] uppercase">
                      ID CARD
                    </span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                    {bisrId}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 pt-2">
                  <div className="bg-white p-1 rounded-xl shadow-sm shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrUrl}
                      alt={`QR for ${bisrId}`}
                      className="w-12 h-12 object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{name || "Student"}</p>
                    <Link
                      href="/student/id-card"
                      onClick={() => setMobileMenuOpen(false)}
                      className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#A78BFA] hover:text-white transition-colors"
                    >
                      <span>View ID Card</span>
                      <span>&rarr;</span>
                    </Link>
                  </div>
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
                            <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-l-full bg-[#5B21F4]" />
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
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
