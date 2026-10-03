"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  UserCircle2,
  KeyRound,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Main",
    items: [
      { href: "/user/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/user/courses", icon: BookOpen, label: "Courses" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/user/profile", icon: UserCircle2, label: "My Profile" },
      { href: "/user/change-password", icon: KeyRound, label: "Change Password" },
    ],
  },
];

export default function UserSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

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
                User Portal
              </p>
            </motion.div>
          )}
        </AnimatePresence>

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

      {/* ── Nav Groups ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1" aria-label="User navigation">
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
                    "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative overflow-hidden",
                    isActive
                      ? "bg-[#F1EEFF] text-[#5B21F4]"
                      : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#111827]",
                    collapsed && "justify-center px-2"
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="user-active-pill"
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

      {/* ── Pro Features Banner ── */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-3 mb-3 overflow-hidden"
          >
            <div
              className="p-3.5 rounded-2xl relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #5B21F4 0%, #7C3AED 55%, #2563EB 100%)" }}
            >
              {/* Decorative blobs */}
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10" />
              <div className="absolute -bottom-4 left-1/3 w-14 h-14 rounded-full bg-black/10" />

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="w-4 h-4 text-white" />
                  <span className="text-xs font-bold text-white">Pro Features</span>
                </div>
                <p className="text-[11px] text-white/75 leading-relaxed">
                  Unlock advanced analytics, mock tests & AI study tools.
                </p>
                <button className="mt-2.5 w-full py-1.5 rounded-lg text-[11px] font-bold text-[#5B21F4] bg-white hover:bg-white/90 transition-opacity cursor-pointer">
                  Explore Pro →
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Logout ── */}
      <div className="border-t border-[#E2E8F0] p-2 shrink-0">
        <Link
          href="/user/logout"
          title={collapsed ? "Logout" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#EF4444] hover:bg-[#FEF2F2] transition-all",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>
    </motion.aside>
  );
}
