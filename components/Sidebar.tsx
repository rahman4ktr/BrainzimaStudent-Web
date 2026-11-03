"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  BookMarked,
  FileText,
  CreditCard,
  Receipt,
  UserCircle2,
  KeyRound,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Bell,
  Sparkles,
  FolderOpen,
  QrCode,
  ShieldCheck,
  Award,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudent } from "@/hooks/useStudent";
import { formatRegistrationNumber } from "@/lib/studentUtils";

const navGroups = [
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

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { name, registration_number, student_id, user_id, user_image } = useStudent();

  const bisrId =
    registration_number ||
    formatRegistrationNumber(student_id) ||
    (user_id ? `BISR${String(user_id).padStart(4, "0")}` : "BISR-STUDENT");

  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(
    bisrId
  )}&centerImageUrl=https://panel.brainzima.com/assets/img/logo-brainzima-icon.png`;

  const initials = (name || "Student")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="hidden lg:flex flex-col h-screen sticky top-0 bg-white border-r border-[#E2E8F0] overflow-hidden shrink-0 z-30"
    >
      {/* ── Brand Header ── */}
      <div className="flex items-center h-16 px-4 border-b border-[#E2E8F0] shrink-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md shadow-[#5B21F4]/20 shrink-0"
          style={{ background: "linear-gradient(135deg, #5B21F4 0%, #7C3AED 55%, #2563EB 100%)" }}
        >
          <GraduationCap className="w-5 h-5" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden ml-3"
            >
              <p className="text-sm font-black tracking-tight text-[#111827] whitespace-nowrap leading-none">
                Brainzima
              </p>
              <p className="text-[10px] font-bold tracking-widest text-[#5B21F4] uppercase whitespace-nowrap">
                Student Portal
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#5B21F4] hover:bg-[#F1EEFF] transition-colors shrink-0 cursor-pointer",
            collapsed && "mx-auto ml-0"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Student Profile Widget & Logout Button Directly Below It ── */}
      <AnimatePresence>
        {!collapsed ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 pt-3 pb-2 border-b border-[#E2E8F0] shrink-0"
          >
            <div className="p-2.5 rounded-2xl bg-gradient-to-r from-[#F1EEFF] to-[#EFF6FF] border border-[#DDD6FE]/60 flex items-center gap-2.5">
              {user_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user_image}
                  alt={name || "Student"}
                  className="w-9 h-9 rounded-full object-cover shrink-0 border border-white shadow-sm"
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                  style={{ background: "linear-gradient(135deg, #5B21F4, #2563EB)" }}
                >
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#111827] truncate">{name || "Student"}</p>
                <p className="text-[10px] text-[#64748B] font-mono truncate">{bisrId}</p>
              </div>
            </div>

            {/* Logout button directly below student info card */}
            <Link
              href="/student/logout"
              className="mt-2 flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200/70 transition-all shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5 text-red-600" />
              <span>Logout</span>
            </Link>
          </motion.div>
        ) : (
          <div className="py-2 border-b border-[#E2E8F0] flex flex-col items-center gap-1.5">
            <Link
              href="/student/profile"
              title={name || "Student"}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
              style={{ background: "linear-gradient(135deg, #5B21F4, #2563EB)" }}
            >
              {initials}
            </Link>
            <Link
              href="/student/logout"
              title="Logout"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        )}
      </AnimatePresence>

      {/* ── Nav Groups ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1" aria-label="Main navigation">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-2">
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 mb-1 text-[10px] font-bold tracking-widest text-[#94A3B8] uppercase select-none"
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>

            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all relative overflow-hidden",
                    isActive
                      ? "bg-[#F1EEFF] text-[#5B21F4]"
                      : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#111827]",
                    collapsed && "justify-center px-2"
                  )}
                >
                  {/* Active Indicator */}
                  {isActive && (
                    <motion.span
                      layoutId="active-pill"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-[#5B21F4]"
                    />
                  )}

                  <item.icon
                    className={cn(
                      "w-5 h-5 shrink-0 transition-colors",
                      isActive ? "text-[#5B21F4]" : "text-[#94A3B8] group-hover:text-[#5B21F4]"
                    )}
                  />

                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden whitespace-nowrap flex-1"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── ID-CARD Section with QuickChart QR Code ── */}
      <div className="p-2 border-t border-[#E2E8F0] shrink-0">
        <AnimatePresence>
          {!collapsed ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-3 rounded-2xl bg-gradient-to-br from-[#111827] via-[#1E1B4B] to-[#311042] text-white shadow-md border border-white/10"
            >
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
                    className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#A78BFA] hover:text-white transition-colors"
                  >
                    <span>View ID Card</span>
                    <span>&rarr;</span>
                  </Link>
                </div>
              </div>
            </motion.div>
          ) : (
            <Link
              href="/student/id-card"
              title={`ID Card: ${bisrId}`}
              className="mx-auto flex items-center justify-center w-10 h-10 rounded-xl bg-[#111827] text-[#DDD6FE] hover:bg-[#5B21F4] hover:text-white transition-all shadow-sm"
            >
              <QrCode className="w-5 h-5" />
            </Link>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
