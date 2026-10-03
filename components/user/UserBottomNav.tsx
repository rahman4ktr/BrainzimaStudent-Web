"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  UserCircle2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserBottomNavProps {
  onSidebarToggle?: () => void;
  isSidebarOpen?: boolean;
}

const bottomNavItems = [
  { href: "/user/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/user/courses", icon: BookOpen, label: "Courses" },
  { href: "/user/profile", icon: UserCircle2, label: "Profile" },
];

export default function UserBottomNav({
  onSidebarToggle,
  isSidebarOpen = false,
}: UserBottomNavProps) {
  const pathname = usePathname();

  const isSettingsActive = Boolean(
    isSidebarOpen ||
      pathname === "/user/change-password" ||
      pathname.startsWith("/user/change-password/")
  );

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-xl border-t border-[#E2E8F0]/80 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] safe-bottom"
      aria-label="Mobile user navigation"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around px-2 h-16 relative">
        {bottomNavItems.map((item) => {
          const isActive =
            !isSidebarOpen &&
            (pathname === item.href || pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center flex-1 h-full py-1 px-0.5 relative group cursor-pointer select-none focus:outline-none"
            >
              {isActive && (
                <motion.div
                  layoutId="user-mobile-active-bg"
                  className="absolute inset-x-1.5 inset-y-1.5 rounded-2xl bg-gradient-to-b from-[#F5F3FF] to-[#EDE9FE] border border-[#DDD6FE]/80 shadow-[0_2px_8px_rgba(91,33,244,0.08)]"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}

              <div className="relative flex flex-col items-center justify-center gap-1 z-10">
                <item.icon
                  className={cn(
                    "w-5 h-5 transition-all duration-200",
                    isActive
                      ? "text-[#5B21F4] scale-110 drop-shadow-[0_2px_6px_rgba(91,33,244,0.25)]"
                      : "text-[#64748B] group-hover:text-[#5B21F4] group-active:scale-95"
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] leading-tight tracking-tight transition-all duration-200",
                    isActive
                      ? "text-[#5B21F4] font-bold"
                      : "text-[#64748B] font-medium group-hover:text-[#5B21F4]"
                  )}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}

        {/* Sidebar / Settings Toggle Button */}
        <button
          type="button"
          onClick={onSidebarToggle}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 px-0.5 relative group cursor-pointer select-none focus:outline-none"
          aria-label="Toggle navigation menu and settings"
          aria-expanded={isSidebarOpen}
        >
          {isSettingsActive && (
            <motion.div
              layoutId="user-mobile-active-bg"
              className="absolute inset-x-1.5 inset-y-1.5 rounded-2xl bg-gradient-to-b from-[#F5F3FF] to-[#EDE9FE] border border-[#DDD6FE]/80 shadow-[0_2px_8px_rgba(91,33,244,0.08)]"
              transition={{ type: "spring", stiffness: 450, damping: 32 }}
            />
          )}

          <div className="relative flex flex-col items-center justify-center gap-1 z-10">
            <Settings
              className={cn(
                "w-5 h-5 transition-all duration-300",
                isSettingsActive
                  ? "text-[#5B21F4] scale-110 drop-shadow-[0_2px_6px_rgba(91,33,244,0.25)]" +
                    (isSidebarOpen ? " rotate-90" : "")
                  : "text-[#64748B] group-hover:text-[#5B21F4] group-active:scale-95"
              )}
            />
            <span
              className={cn(
                "text-[10px] leading-tight tracking-tight transition-all duration-200",
                isSettingsActive
                  ? "text-[#5B21F4] font-bold"
                  : "text-[#64748B] font-medium group-hover:text-[#5B21F4]"
              )}
            >
              Settings
            </span>
          </div>
        </button>
      </div>
    </nav>
  );
}
