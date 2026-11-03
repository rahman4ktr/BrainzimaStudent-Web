"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Search,
  ChevronDown,
  GraduationCap,
  UserCircle2,
  Settings,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getFileUrl, getInitials, getSession } from "@/lib/session";
import { getOfflineCoupons, getOnlineCoupons } from "@/lib/api";
import { playNotificationSound } from "@/lib/sound";
import { Tag, Sparkles, Gift } from "lucide-react";

const routeLabels: Record<string, string> = {
  "/user/dashboard": "Dashboard",
  "/user/id-card": "Digital ID Card",
  "/user/my-courses": "My Courses",
  "/user/courses": "Offline Courses",
  "/user/offline-courses": "Offline Courses",
  "/user/online-courses": "Online Courses",
  "/user/notes": "Notes & Materials",
  "/user/materials": "Study Materials",
  "/user/ebook-library": "Ebook Library",
  "/user/fees": "Fee Details",
  "/user/payments": "Payments",
  "/user/documents": "Documents",
  "/user/notifications": "Offers & Notifications",
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
  const [offerNotifications, setOfferNotifications] = useState<
    {
      id: string;
      code: string;
      title: string;
      discount: string;
      time: string;
      type: "offline" | "online";
      isExclusive: boolean;
      unread: boolean;
    }[]
  >([]);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const avatarUrl = getFileUrl(user?.user_image);
  const [avatarError, setAvatarError] = useState(false);
  const initials = getInitials(user?.name);
  const displayName = user?.name || "User";

  const pageTitle = routeLabels[pathname] ?? "Portal";

  // Automatically close all dropdowns when navigating to a new route
  useEffect(() => {
    setProfileOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  // Click-outside listener to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Fetch real offers for the user
  useEffect(() => {
    let active = true;

    async function loadUserOffers() {
      const s = getSession() || user;
      const uId = s?.user_id ? Number(s.user_id) : undefined;
      const uEmail = (s?.email || "").toLowerCase().trim();
      const uMobile = (s?.mobile || "").trim();
      const uRole = (s?.role || "user") as any;

      try {
        const [offRes, onRes] = await Promise.allSettled([
          getOfflineCoupons({ status: "active", user_id: uId }, uId, uRole),
          getOnlineCoupons({ status: "active", user_id: uId }, uId, uRole),
        ]);

        if (!active) return;

        let readSet = new Set<string>();
        try {
          const stored = localStorage.getItem("brainzima_read_notifications");
          if (stored) readSet = new Set(JSON.parse(stored));
        } catch {}

        const parsed: typeof offerNotifications = [];

        // Offline offers
        if (offRes.status === "fulfilled" && offRes.value.success && Array.isArray(offRes.value.data)) {
          for (const c of offRes.value.data) {
            if (c.coupon_expired === 1 || c.coupon_expired === true) continue;
            const isForThisUser = c.coupon_for === "user_id" && Number(c.coupon_for_user_id) === uId;
            const isForThisEmail = c.coupon_for_email && c.coupon_for_email.toLowerCase().trim() === uEmail;
            const isForThisMobile = c.coupon_for_mobile && c.coupon_for_mobile.trim() === uMobile;
            const isForAll = c.coupon_for === "all";

            if (isForAll || isForThisUser || isForThisEmail || isForThisMobile) {
              const key = `offline_${c.coupon_id}`;
              const disc = c.coupon_discount_type === "percentage" ? `${Number(c.coupon_discount)}% OFF` : `₹${Number(c.coupon_discount)} OFF`;
              parsed.push({
                id: key,
                code: c.coupon_code,
                title: c.target_course_name ? `Classroom: ${c.target_course_name}` : "All Offline Courses",
                discount: disc,
                time: "Limited offer",
                type: "offline",
                isExclusive: Boolean(isForThisUser || isForThisEmail || isForThisMobile),
                unread: !readSet.has(key),
              });
            }
          }
        }

        // Online offers
        if (onRes.status === "fulfilled" && onRes.value.success && Array.isArray(onRes.value.data)) {
          for (const c of onRes.value.data) {
            if (c.coupon_expired === 1 || c.coupon_expired === true) continue;
            const isForThisUser = c.coupon_for === "user_id" && Number(c.coupon_for_user_id) === uId;
            const isForThisEmail = c.coupon_for_email && c.coupon_for_email.toLowerCase().trim() === uEmail;
            const isForThisMobile = c.coupon_for_mobile && c.coupon_for_mobile.trim() === uMobile;
            const isForAll = c.coupon_for === "all";

            if (isForAll || isForThisUser || isForThisEmail || isForThisMobile) {
              const key = `online_${c.coupon_id}`;
              const disc = c.coupon_discount_type === "percentage" ? `${Number(c.coupon_discount)}% OFF` : `₹${Number(c.coupon_discount)} OFF`;
              parsed.push({
                id: key,
                code: c.coupon_code,
                title: c.target_course_name ? `Online: ${c.target_course_name}` : "All Online LMS Courses",
                discount: disc,
                time: "Active now",
                type: "online",
                isExclusive: Boolean(isForThisUser || isForThisEmail || isForThisMobile),
                unread: !readSet.has(key),
              });
            }
          }
        }

        setOfferNotifications(parsed);
      } catch (err) {
        console.warn("[UserHeader] Notification sync notice:", err);
      }
    }

    loadUserOffers();
    return () => {
      active = false;
    };
  }, [user, pathname]);

  const unreadCount = offerNotifications.filter((n) => n.unread).length;

  const handleMarkAllRead = () => {
    try {
      const allKeys = offerNotifications.map((n) => n.id);
      localStorage.setItem("brainzima_read_notifications", JSON.stringify(allKeys));
      setOfferNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    } catch {}
  };

  return (
    <header className="sticky top-0 z-50 h-16 bg-white/90 backdrop-blur-md border-b border-[#E2E8F0] flex items-center px-4 md:px-6 gap-4 shrink-0">
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
        <div ref={notifRef} className="relative">
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
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-80 sm:w-88 bg-white rounded-2xl border border-[#E2E8F0] shadow-xl shadow-slate-900/10 z-50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-[#111827]">Offers & Alerts</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold bg-purple-50 text-[#5B21F4] px-2 py-0.5 rounded-full border border-purple-100">
                        {unreadCount} New
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-xs text-[#5B21F4] font-semibold cursor-pointer hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="divide-y divide-[#F1F5F9] max-h-72 overflow-y-auto">
                  {offerNotifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#64748B] space-y-1">
                      <Gift className="w-6 h-6 mx-auto text-slate-300" />
                      <p className="font-semibold text-[#334155]">No offers right now</p>
                      <p className="text-[11px] text-[#94A3B8]">Check back soon for new promotions.</p>
                    </div>
                  ) : (
                    offerNotifications.slice(0, 4).map((n) => (
                      <Link
                        key={n.id}
                        href="/user/notifications"
                        onClick={() => setNotifOpen(false)}
                        className={`block px-4 py-3 text-xs hover:bg-[#F8FAFC] transition-colors cursor-pointer ${
                          n.unread ? "bg-[#FAFAFF]" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            {n.unread && (
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#5B21F4] shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-[#111827]">
                                  {n.code}
                                </span>
                                {n.isExclusive && (
                                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">
                                    Exclusive
                                  </span>
                                )}
                              </div>
                              <p className="text-[#64748B] text-[11px] truncate mt-0.5">
                                {n.title}
                              </p>
                            </div>
                          </div>
                          <span className="text-[11px] font-black text-[#5B21F4] shrink-0 bg-purple-50 px-1.5 py-0.5 rounded">
                            {n.discount}
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>

                <div className="px-4 py-2.5 border-t border-[#F1F5F9] text-center bg-slate-50/50">
                  <Link
                    href="/user/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs text-[#5B21F4] font-bold hover:underline inline-flex items-center gap-1"
                  >
                    <span>View all offers & notifications →</span>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile Dropdown */}
        <div ref={profileRef} className="relative">
          <button
            id="user-profile-btn"
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            aria-label="Account menu"
          >
            {avatarUrl && !avatarError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                onError={() => setAvatarError(true)}
                className="w-7 h-7 rounded-full object-cover shrink-0"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-xs"
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
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#475569] hover:bg-[#F8FAFC] hover:text-[#111827] transition-colors"
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
