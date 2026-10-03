"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Search,
  ChevronDown,
  GraduationCap,
  UserCircle2,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getFileUrl, getInitials } from "@/lib/session";

const routeLabels: Record<string, string> = {
  "/user/dashboard": "Dashboard",
  "/user/courses": "Courses",
  "/user/profile": "My Profile",
  "/user/change-password": "Change Password",
};

interface UserHeaderProps {
  onMobileMenuToggle?: () => void;
  mobileMenuOpen?: boolean;
}

export default function UserHeader({ onMobileMenuToggle, mobileMenuOpen }: UserHeaderProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const avatarUrl = getFileUrl(user?.user_image);
  const initials = getInitials(user?.name);
  const displayName = user?.name || "User";

  const pageTitle = routeLabels[pathname] ?? "Portal";

  const notifications = [
    { id: 1, text: "Your account has been activated successfully.", time: "1h ago", unread: true },
    { id: 2, text: "New course available: Python AI & Machine Learning.", time: "3h ago", unread: true },
    { id: 3, text: "Complete your profile to unlock all features.", time: "1d ago", unread: false },
  ];

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur-md border-b border-[#E2E8F0] flex items-center px-4 md:px-6 gap-4 shrink-0">
      {/* Mobile Brand */}
      <div className="lg:hidden flex items-center gap-2 flex-1">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
          style={{ background: "linear-gradient(135deg, #5B21F4, #2563EB)" }}
        >
          <GraduationCap className="w-4 h-4" />
        </div>
        <span className="text-sm font-black text-[#111827]">Brainzima</span>
      </div>

      {/* Desktop Page Title */}
      <div className="hidden lg:block">
        <h1 className="text-base font-bold text-[#111827]">{pageTitle}</h1>
        <p className="text-[11px] text-[#94A3B8]">Brainzima User Portal</p>
      </div>



      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <div className="relative">
          <button
            id="user-notif-btn"
            onClick={() => {
              setNotifOpen(!notifOpen);
              setProfileOpen(false);
            }}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center text-[#475569] hover:bg-[#F8FAFC] hover:text-[#5B21F4] transition-colors cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4444] ring-2 ring-white" />
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-80 bg-white rounded-2xl border border-[#E2E8F0] shadow-xl shadow-slate-900/10 z-50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
                  <span className="text-sm font-bold text-[#111827]">Notifications</span>
                  <span className="text-xs text-[#5B21F4] font-semibold cursor-pointer hover:underline">
                    Mark all read
                  </span>
                </div>
                <div className="divide-y divide-[#F1F5F9]">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`px-4 py-3 text-xs hover:bg-[#F8FAFC] transition-colors cursor-pointer ${n.unread ? "bg-[#FAFAFF]" : ""
                        }`}
                    >
                      <div className="flex items-start gap-2">
                        {n.unread && (
                          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#5B21F4] shrink-0" />
                        )}
                        <div className={n.unread ? "" : "pl-3.5"}>
                          <p className="text-[#111827] leading-relaxed">{n.text}</p>
                          <p className="text-[#94A3B8] mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-[#F1F5F9] text-center">
                  <span className="text-xs text-[#5B21F4] font-semibold cursor-pointer hover:underline">
                    View all notifications →
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            id="user-profile-btn"
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            aria-label="Account menu"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-7 h-7 rounded-full object-cover shrink-0"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                style={{ background: "linear-gradient(135deg, #5B21F4, #2563EB)" }}
              >
                {initials}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-[#111827] leading-none">{displayName}</p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5 capitalize">
                {user?.role ? `${user.role} Account` : "User Account"}
              </p>
            </div>
            <ChevronDown
              className={`hidden sm:block w-3.5 h-3.5 text-[#94A3B8] transition-transform ${profileOpen ? "rotate-180" : ""
                }`}
            />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-56 bg-white rounded-2xl border border-[#E2E8F0] shadow-xl shadow-slate-900/10 z-50 overflow-hidden"
              >
                <div className="px-4 py-3 bg-gradient-to-r from-[#F1EEFF] to-[#EFF6FF] border-b border-[#E2E8F0]">
                  <p className="text-sm font-bold text-[#111827]">{displayName}</p>
                  <p className="text-[11px] text-[#64748B] truncate">{user?.email || "User Account"}</p>
                </div>

                <div className="py-1.5">
                  {[
                    { href: "/user/profile", icon: UserCircle2, label: "My Profile" },
                    { href: "/user/change-password", icon: Settings, label: "Change Password" },
                  ].map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#475569] hover:bg-[#F8FAFC] hover:text-[#111827] transition-colors"
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </a>
                  ))}
                </div>

                <div className="border-t border-[#F1F5F9] py-1.5">
                  <a
                    href="/user/logout"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
