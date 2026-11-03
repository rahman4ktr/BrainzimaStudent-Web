"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Sparkles,
  Tag,
  Copy,
  Check,
  Calendar,
  Gift,
  ArrowRight,
  ShieldCheck,
  Volume2,
  VolumeX,
  ExternalLink,
  Flame,
  Award,
  Layers,
  BookOpen,
  GraduationCap,
  RefreshCw,
  Clock,
  CheckCheck,
} from "lucide-react";
import {
  getOfflineCoupons,
  getOnlineCoupons,
  type CouponItem,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getSession } from "@/lib/session";
import {
  playNotificationSound,
  soundManager,
} from "@/lib/sound";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface OfferNotification extends CouponItem {
  courseType: "offline" | "online";
  isExclusive: boolean;
  isRead: boolean;
  daysRemaining: number | null;
}

const READ_STORAGE_KEY = "brainzima_read_notifications";

export default function UserNotificationsPage() {
  const { user } = useAuth();
  const session = getSession() || user;
  const { toast } = useToast();

  const [offlineCoupons, setOfflineCoupons] = useState<CouponItem[]>([]);
  const [onlineCoupons, setOnlineCoupons] = useState<CouponItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "exclusive" | "online" | "offline" | "unread">("all");
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.isSoundMuted());

  // Load read notification IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(READ_STORAGE_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          setReadIds(new Set(arr));
        }
      }
    } catch {
      /* ignore storage error */
    }
  }, []);

  // Save read IDs helper
  const markAsRead = (uniqueKey: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(uniqueKey);
      try {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const markAllAsRead = () => {
    const allKeys = allOffers.map((o) => `${o.courseType}_${o.coupon_id}`);
    const next = new Set([...Array.from(readIds), ...allKeys]);
    setReadIds(next);
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(next)));
    } catch {}
    toast({
      variant: "success",
      title: "All Caught Up!",
      description: "All offer notifications have been marked as read.",
    });
  };

  // ── Fetch Both Offline and Online Coupons ──────────────────────────────────
  const fetchOffers = useCallback(async () => {
    setIsLoading(true);
    const uId = session?.user_id ? Number(session.user_id) : undefined;
    const uRole = (session?.role || "user") as any;

    try {
      // Parallel fetch with zero extra API overhead
      const [offRes, onRes] = await Promise.allSettled([
        getOfflineCoupons({ status: "active", user_id: uId }, uId, uRole),
        getOnlineCoupons({ status: "active", user_id: uId }, uId, uRole),
      ]);

      const offList = offRes.status === "fulfilled" && offRes.value.success && Array.isArray(offRes.value.data)
        ? offRes.value.data
        : [];
      const onList = onRes.status === "fulfilled" && onRes.value.success && Array.isArray(onRes.value.data)
        ? onRes.value.data
        : [];

      setOfflineCoupons(offList);
      setOnlineCoupons(onList);

      // Play sound if fresh login or first notification load
      if (typeof window !== "undefined") {
        const justLoggedIn = sessionStorage.getItem("brainzima_just_logged_in");
        if (justLoggedIn === "1" || offList.length > 0 || onList.length > 0) {
          playNotificationSound();
          sessionStorage.removeItem("brainzima_just_logged_in");
        }
      }
    } catch (err) {
      console.warn("[Notifications] Load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user_id, session?.role]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  // ── Filter and Format Eligible Offers ──────────────────────────────────────
  const allOffers = useMemo<OfferNotification[]>(() => {
    const currentUserId = session?.user_id ? Number(session.user_id) : 0;
    const currentUserEmail = (session?.email || "").toLowerCase().trim();
    const currentUserMobile = (session?.mobile || "").trim();

    const processList = (list: CouponItem[], type: "offline" | "online"): OfferNotification[] => {
      return list
        .filter((c) => {
          // Check expired
          if (c.coupon_expired === 1 || c.coupon_expired === true) return false;
          if (c.coupon_validity) {
            const exp = new Date(c.coupon_validity).getTime();
            if (!isNaN(exp) && exp < Date.now()) return false;
          }

          // Rule: Show if for ALL, OR specifically for user's ID, OR email, OR mobile
          const isForAll = c.coupon_for === "all";
          const isForThisUser =
            c.coupon_for === "user_id" &&
            c.coupon_for_user_id !== null &&
            Number(c.coupon_for_user_id) === currentUserId;
          const isForThisEmail =
            Boolean(c.coupon_for_email) &&
            Boolean(currentUserEmail) &&
            c.coupon_for_email?.toLowerCase().trim() === currentUserEmail;
          const isForThisMobile =
            Boolean(c.coupon_for_mobile) &&
            Boolean(currentUserMobile) &&
            c.coupon_for_mobile?.trim() === currentUserMobile;

          // Exclude coupons restricted to another specific user
          if (c.coupon_for === "user_id" && !isForThisUser) return false;
          if (c.coupon_for_email && !isForThisEmail) return false;
          if (c.coupon_for_mobile && !isForThisMobile) return false;

          return isForAll || isForThisUser || isForThisEmail || isForThisMobile;
        })
        .map((c) => {
          const uniqueKey = `${type}_${c.coupon_id}`;
          const isExclusive =
            c.coupon_for === "user_id" ||
            Boolean(c.coupon_for_email) ||
            Boolean(c.coupon_for_mobile);

          let daysRemaining: number | null = null;
          if (c.coupon_validity) {
            const exp = new Date(c.coupon_validity).getTime();
            if (!isNaN(exp)) {
              daysRemaining = Math.max(0, Math.ceil((exp - Date.now()) / (1000 * 60 * 60 * 24)));
            }
          }

          return {
            ...c,
            courseType: type,
            isExclusive,
            isRead: readIds.has(uniqueKey),
            daysRemaining,
          };
        });
    };

    const combined = [
      ...processList(offlineCoupons, "offline"),
      ...processList(onlineCoupons, "online"),
    ];

    // Sort: unread first, then exclusive first, then newest
    return combined.sort((a, b) => {
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      if (a.isExclusive !== b.isExclusive) return a.isExclusive ? -1 : 1;
      return b.coupon_id - a.coupon_id;
    });
  }, [offlineCoupons, onlineCoupons, session, readIds]);

  // Tab Filtering
  const filteredOffers = useMemo(() => {
    switch (activeTab) {
      case "exclusive":
        return allOffers.filter((o) => o.isExclusive);
      case "online":
        return allOffers.filter((o) => o.courseType === "online");
      case "offline":
        return allOffers.filter((o) => o.courseType === "offline");
      case "unread":
        return allOffers.filter((o) => !o.isRead);
      case "all":
      default:
        return allOffers;
    }
  }, [allOffers, activeTab]);

  const unreadCount = allOffers.filter((o) => !o.isRead).length;
  const exclusiveCount = allOffers.filter((o) => o.isExclusive).length;
  const onlineCount = allOffers.filter((o) => o.courseType === "online").length;
  const offlineCount = allOffers.filter((o) => o.courseType === "offline").length;

  const handleCopyCode = (code: string, uniqueKey: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      markAsRead(uniqueKey);
      playNotificationSound();
      toast({
        variant: "success",
        title: "Coupon Code Copied!",
        description: `Code "${code}" copied to clipboard. Apply it at checkout.`,
      });
      setTimeout(() => setCopiedCode(null), 2500);
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundManager.setSoundMuted(nextMuted);
    if (!nextMuted) {
      playNotificationSound();
    }
    toast({
      variant: "info",
      title: nextMuted ? "Sound Alerts Muted" : "Sound Alerts Active",
      description: nextMuted
        ? "Notification sounds are now turned off."
        : "You will hear a chime when new offers and alerts arrive.",
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* ── Page Header & Quick Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#5B21F4] to-[#7C3AED] text-white flex items-center justify-center shadow-lg shadow-[#5B21F4]/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#111827] tracking-tight">
                Notifications & Course Offers
              </h1>
              <p className="text-xs sm:text-sm text-[#64748B]">
                Discover personalized discounts and active offers tailored for your account.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Sound Chime Test & Mark All Read */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleMute}
            className="h-9 px-3 rounded-xl border-[#CBD5E1] text-xs font-bold text-[#334155] hover:bg-[#F8FAFC]"
            title={isMuted ? "Unmute notification chime" : "Mute notification chime"}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-4 h-4 mr-1.5 text-slate-400" />
                <span>Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 mr-1.5 text-[#5B21F4]" />
                <span>Sound On</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              playNotificationSound();
              toast({
                variant: "success",
                title: "Chime Played",
                description: "This sound plays automatically when you log in or receive new offers.",
              });
            }}
            className="h-9 px-3 rounded-xl border-[#CBD5E1] text-xs font-bold text-[#5B21F4] hover:bg-purple-50"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#5B21F4]" />
            <span>Test Chime</span>
          </Button>

          {unreadCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="h-9 px-3 rounded-xl border-[#CBD5E1] text-xs font-bold text-[#475569] hover:bg-[#F8FAFC]"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              <span>Mark All Read</span>
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={fetchOffers}
            disabled={isLoading}
            className="h-9 px-3 rounded-xl bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* ── Summary Stats Badges ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#5B21F4] flex items-center justify-center font-black">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#64748B] block uppercase">Total Offers</span>
            <span className="text-lg font-black text-[#111827]">{allOffers.length}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#64748B] block uppercase">Exclusive for You</span>
            <span className="text-lg font-black text-amber-700">{exclusiveCount}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-black">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#64748B] block uppercase">Online Courses</span>
            <span className="text-lg font-black text-blue-700">{onlineCount}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#64748B] block uppercase">Offline Courses</span>
            <span className="text-lg font-black text-emerald-700">{offlineCount}</span>
          </div>
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: "all", label: `All Offers (${allOffers.length})` },
          { key: "exclusive", label: `Exclusive for You (${exclusiveCount})` },
          { key: "offline", label: `Offline Courses (${offlineCount})` },
          { key: "online", label: `Online LMS (${onlineCount})` },
          { key: "unread", label: `Unread (${unreadCount})` },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? "bg-[#5B21F4] text-white shadow-md shadow-[#5B21F4]/20"
                  : "bg-white hover:bg-slate-50 text-[#64748B] border border-[#E2E8F0]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Notification Offer Cards List ── */}
      <div className="space-y-3.5">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 rounded-2xl border border-dashed border-[#CBD5E1] bg-white animate-pulse space-y-3"
              >
                <div className="flex justify-between">
                  <div className="h-5 bg-slate-200 rounded w-28" />
                  <div className="h-5 bg-slate-200 rounded w-20" />
                </div>
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-8 bg-slate-200 rounded-xl w-full" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && filteredOffers.length === 0 && (
          <div className="p-8 sm:p-12 rounded-3xl bg-white border border-[#E2E8F0] text-center space-y-3 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 text-[#5B21F4] flex items-center justify-center mx-auto">
              <Gift className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-[#111827]">
              No Offers Found in this View
            </h3>
            <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
              {activeTab === "unread"
                ? "You've read all available offers! Switch to 'All Offers' to see all active discount coupons."
                : "There are currently no active offers in this category. Check back soon for new discounts and promotions."}
            </p>
            {activeTab !== "all" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("all")}
                className="rounded-xl text-xs font-bold"
              >
                Show All Offers
              </Button>
            )}
          </div>
        )}

        {!isLoading && filteredOffers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOffers.map((offer) => {
              const uniqueKey = `${offer.courseType}_${offer.coupon_id}`;
              const discountText =
                offer.coupon_discount_type === "percentage"
                  ? `${Number(offer.coupon_discount)}% OFF`
                  : `₹${Number(offer.coupon_discount).toLocaleString("en-IN")} OFF`;

              const isOffline = offer.courseType === "offline";
              const targetCourseText =
                offer.coupon_for_course === "specific" && offer.coupon_for_course_id
                  ? offer.target_course_name
                    ? `Valid for: ${offer.target_course_name}`
                    : `Valid for Specific Course #${offer.coupon_for_course_id}`
                  : isOffline
                  ? "Applicable to all Classroom Courses"
                  : "Applicable to all Online LMS Courses";

              const expiryFormatted = offer.coupon_validity
                ? new Date(offer.coupon_validity).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : null;

              const isCopied = copiedCode === offer.coupon_code;

              return (
                <motion.div
                  key={uniqueKey}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 relative overflow-hidden ${
                    !offer.isRead
                      ? "bg-gradient-to-br from-white via-[#FAF5FF]/30 to-white border-[#C4B5FD] shadow-md ring-1 ring-[#5B21F4]/10"
                      : "bg-white hover:bg-slate-50/50 border-[#E2E8F0] shadow-sm"
                  }`}
                >
                  {/* Unread Indicator Bar */}
                  {!offer.isRead && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5B21F4] to-[#2563EB]" />
                  )}

                  {/* Header: Badges & Discount */}
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Course Type Badge */}
                        <Badge
                          className={`text-[10px] font-black px-2 py-0.5 shadow-none ${
                            isOffline
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          }`}
                        >
                          {isOffline ? "Offline Classroom" : "Online LMS"}
                        </Badge>

                        {/* Exclusivity Tag */}
                        {offer.isExclusive ? (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                            <Flame className="w-3 h-3 text-amber-600" />
                            <span>Exclusive for You</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-[#64748B] bg-slate-100 px-2 py-0.5 rounded-full">
                            For All Students
                          </span>
                        )}

                        {!offer.isRead && (
                          <span className="text-[9px] font-black text-[#5B21F4] bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                            NEW
                          </span>
                        )}
                      </div>

                      {/* Big Discount Tag */}
                      <div className="text-right shrink-0">
                        <span className="text-base sm:text-lg font-black text-[#5B21F4] block leading-none">
                          {discountText}
                        </span>
                      </div>
                    </div>

                    {/* Offer Title & Applicable Description */}
                    <div>
                      <h4 className="text-sm font-bold text-[#111827] flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#5B21F4] shrink-0" />
                        <span>Code: <span className="font-mono tracking-wider">{offer.coupon_code}</span></span>
                      </h4>
                      <p className="text-xs text-[#475569] mt-1 line-clamp-2 leading-relaxed">
                        {targetCourseText}
                      </p>
                    </div>

                    {/* Expiry & Countdown */}
                    <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1">
                      {expiryFormatted && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#94A3B8]" />
                          <span>Valid till {expiryFormatted}</span>
                        </span>
                      )}
                      {offer.daysRemaining !== null && (
                        <span
                          className={`font-semibold flex items-center gap-1 ${
                            offer.daysRemaining <= 3
                              ? "text-red-600 font-bold"
                              : "text-[#64748B]"
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>
                            {offer.daysRemaining === 0
                              ? "Expires today!"
                              : `${offer.daysRemaining} days left`}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar: Copy Code + Direct Enroll/Explore Link */}
                  <div className="pt-2 border-t border-[#F1F5F9] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    {/* Copy Coupon Code Button */}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyCode(offer.coupon_code, uniqueKey)}
                      className={`h-8 px-3 rounded-xl font-bold text-xs transition-all shrink-0 cursor-pointer ${
                        isCopied
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                          : "bg-slate-50 hover:bg-[#F1EEFF] text-[#111827] hover:text-[#5B21F4] border-[#CBD5E1]"
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          <span>Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1 text-[#64748B]" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </Button>

                    {/* Direct Course Application CTA */}
                    <div className="flex items-center gap-2">
                      {!offer.isRead ? (
                        <button
                          type="button"
                          onClick={() => markAsRead(uniqueKey)}
                          className="text-[11px] font-semibold text-[#64748B] hover:text-[#111827] underline shrink-0 cursor-pointer"
                        >
                          Mark as read
                        </button>
                      ) : null}

                      {isOffline ? (
                        <Link
                          href={`/user/courses/enroll${
                            offer.coupon_for_course_id ? `?course_id=${offer.coupon_for_course_id}` : ""
                          }`}
                          onClick={() => markAsRead(uniqueKey)}
                          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#111827] to-[#1F2937] hover:from-[#5B21F4] hover:to-[#7C3AED] text-white text-xs font-bold transition-all shadow-sm"
                        >
                          <span>Apply in Enrollment</span>
                          <ArrowRight className="w-3 h-3 ml-0.5" />
                        </Link>
                      ) : (
                        <Link
                          href={
                            offer.coupon_for_course_id
                              ? `/user/online-courses/${offer.coupon_for_course_id}`
                              : "/user/online-courses"
                          }
                          onClick={() => markAsRead(uniqueKey)}
                          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#5B21F4] to-[#7C3AED] hover:from-[#4C1BD4] hover:to-[#6D28D9] text-white text-xs font-bold transition-all shadow-sm shadow-[#5B21F4]/20"
                        >
                          <span>Explore Online</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
