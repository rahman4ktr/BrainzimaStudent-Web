"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Clock,
  Search,
  Layers,
  ArrowRight,
  Award,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Compass,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useStudent } from "@/hooks/useStudent";
import {
  getCurrentStudent,
  getStudentOnlineCourses,
  getCourses,
  getOnlineCourses,
  EnrollmentItem,
  OnlineEnrolledCourse,
  Course,
  OnlineCourse,
} from "@/lib/api";
import { getCourseImageUrl } from "@/lib/session";
import CourseThumbnail from "@/components/courses/CourseThumbnail";
import { useEnrollmentRoute } from "@/hooks/useEnrollmentRoute";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] as const },
});

const COURSE_THEMES: Record<
  string,
  {
    color: string;
    bg: string;
    border: string;
    tag: string;
    tagColor: string;
    tagBg: string;
  }
> = {
  ADCA: {
    color: "#08A66A",
    bg: "#ECFDF5",
    border: "#D1FAE5",
    tag: "Diploma",
    tagColor: "#08A66A",
    tagBg: "#ECFDF5",
  },
  DWD: {
    color: "#2563EB",
    bg: "#EFF6FF",
    border: "#DBEAFE",
    tag: "Web Dev",
    tagColor: "#2563EB",
    tagBg: "#EFF6FF",
  },
  MERN: {
    color: "#5B21F4",
    bg: "#F1EEFF",
    border: "#DDD6FE",
    tag: "Full Stack",
    tagColor: "#5B21F4",
    tagBg: "#F1EEFF",
  },
  JAVA: {
    color: "#EA580C",
    bg: "#FFF7ED",
    border: "#FED7AA",
    tag: "Enterprise",
    tagColor: "#EA580C",
    tagBg: "#FFF7ED",
  },
  PYTHON: {
    color: "#0284C7",
    bg: "#F0F9FF",
    border: "#BAE6FD",
    tag: "Programming",
    tagColor: "#0284C7",
    tagBg: "#F0F9FF",
  },
  CYBER: {
    color: "#EF4444",
    bg: "#FEF2F2",
    border: "#FECACA",
    tag: "Security",
    tagColor: "#EF4444",
    tagBg: "#FEF2F2",
  },
};

const DEFAULT_THEME = {
  color: "#5B21F4",
  bg: "#F1EEFF",
  border: "#DDD6FE",
  tag: "Course",
  tagColor: "#5B21F4",
  tagBg: "#F1EEFF",
};

function getThemeForCode(code?: string) {
  if (!code) return DEFAULT_THEME;
  const upper = code.trim().toUpperCase();
  for (const [key, theme] of Object.entries(COURSE_THEMES)) {
    if (upper.includes(key)) return theme;
  }
  return DEFAULT_THEME;
}

// ── Financial Value Extractors (Backend stc_dues as single source of truth) ──
function extractEnrollmentDues(e: any): number {
  if (!e) return 0;
  if (e.stc_dues !== undefined && e.stc_dues !== null && e.stc_dues !== "") {
    const n = Number(e.stc_dues);
    if (!isNaN(n)) return n;
  }
  if (e.dues !== undefined && e.dues !== null && e.dues !== "") {
    const n = Number(e.dues);
    if (!isNaN(n)) return n;
  }
  if (e.remaining_dues !== undefined && e.remaining_dues !== null && e.remaining_dues !== "") {
    const n = Number(e.remaining_dues);
    if (!isNaN(n)) return n;
  }
  return 0;
}

function extractEnrollmentTotalFee(e: any): number {
  if (!e) return 0;
  if (e.stc_total_fee !== undefined && e.stc_total_fee !== null && e.stc_total_fee !== "") {
    const n = Number(e.stc_total_fee);
    if (!isNaN(n)) return n;
  }
  if (e.total_fee !== undefined && e.total_fee !== null && e.total_fee !== "") {
    const n = Number(e.total_fee);
    if (!isNaN(n)) return n;
  }
  return 0;
}

function extractEnrollmentDiscount(e: any): number {
  if (!e) return 0;
  if (e.stc_discount !== undefined && e.stc_discount !== null && e.stc_discount !== "") {
    const n = Number(e.stc_discount);
    if (!isNaN(n)) return n;
  }
  if (e.discount !== undefined && e.discount !== null && e.discount !== "") {
    const n = Number(e.discount);
    if (!isNaN(n)) return n;
  }
  return 0;
}

function extractEnrollmentInitialPayment(e: any): number {
  if (!e) return 0;
  if (e.stc_initial_payment !== undefined && e.stc_initial_payment !== null && e.stc_initial_payment !== "") {
    const n = Number(e.stc_initial_payment);
    if (!isNaN(n)) return n;
  }
  if (e.initial_payment !== undefined && e.initial_payment !== null && e.initial_payment !== "") {
    const n = Number(e.initial_payment);
    if (!isNaN(n)) return n;
  }
  return 0;
}

function extractEnrollmentTotalPaid(e: any): number {
  if (!e) return 0;
  if (e.total_paid !== undefined && e.total_paid !== null && e.total_paid !== "") {
    const n = Number(e.total_paid);
    if (!isNaN(n)) return n;
  }
  if (e.total_successful_paid !== undefined && e.total_successful_paid !== null && e.total_successful_paid !== "") {
    const n = Number(e.total_successful_paid);
    if (!isNaN(n)) return n;
  }
  const fee = extractEnrollmentTotalFee(e);
  const disc = extractEnrollmentDiscount(e);
  const dues = extractEnrollmentDues(e);
  const init = extractEnrollmentInitialPayment(e);
  return Math.max(init, fee - disc - dues);
}

export default function StudentCoursesPage() {
  const { getEnrollmentUrl } = useEnrollmentRoute();
  const { user_id, registration_number, isLoading: isStudentLoading } = useStudent();

  // State 1: Enrolled Courses
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [onlineCourses, setOnlineCourses] = useState<OnlineEnrolledCourse[]>([]);
  const [catalogMap, setCatalogMap] = useState<Map<number, Course>>(new Map());
  const [onlineCatalogMap, setOnlineCatalogMap] = useState<Map<number, OnlineCourse>>(new Map());
  const [coursesTab, setCoursesTab] = useState<"enrolled" | "offline" | "online">("enrolled");
  const [isEnrLoading, setIsEnrLoading] = useState(true);
  const [enrError, setEnrError] = useState<string | null>(null);

  // Search state across enrolled courses
  const [search, setSearch] = useState("");

  // ── Fetch Enrolled Courses independently ──
  // STRICT RULE:
  //   - OFFLINE courses come ONLY from offline_courses in /api/student/me
  //   - ONLINE courses come ONLY from online_courses in /api/student/me + /api/onlinecoures/enrolled
  //   - NEVER resolve online course through offline catalog
  //   - If offline_courses = [], show ZERO offline cards
  const loadEnrollments = useCallback(async () => {
    if (!user_id) return;
    setIsEnrLoading(true);
    setEnrError(null);

    try {
      const [stMeRes, onlRes, catRes, onlCatRes] = await Promise.allSettled([
        getCurrentStudent(user_id),
        getStudentOnlineCourses(user_id, "student"),
        getCourses(),
        getOnlineCourses(),
      ]);

      // Cache catalog image lookups
      if (catRes.status === "fulfilled" && catRes.value?.success && Array.isArray(catRes.value.data)) {
        const cMap = new Map<number, Course>();
        catRes.value.data.forEach((c) => cMap.set(Number(c.course_id), c));
        setCatalogMap(cMap);
      }

      if (onlCatRes.status === "fulfilled" && onlCatRes.value?.success && Array.isArray(onlCatRes.value.data)) {
        const oMap = new Map<number, OnlineCourse>();
        onlCatRes.value.data.forEach((c) => oMap.set(Number(c.course_id), c));
        setOnlineCatalogMap(oMap);
      }

      // --- OFFLINE COURSES: STRICTLY from offline_courses ---
      let offlineList: EnrollmentItem[] = [];
      if (stMeRes.status === "fulfilled" && stMeRes.value?.success && stMeRes.value?.data) {
        const pData = stMeRes.value.data;
        if (Array.isArray(pData.offline_courses)) {
          offlineList = pData.offline_courses.map((c: any) => ({
            ...c,
            course_format: "offline" as const,
          }));
        }
      }
      setEnrollments(offlineList);

      // --- ONLINE COURSES: STRICTLY from online_courses + /api/onlinecoures/enrolled ---
      const onlineMap = new Map<string, OnlineEnrolledCourse>();
      if (stMeRes.status === "fulfilled" && stMeRes.value?.success && Array.isArray(stMeRes.value?.data?.online_courses)) {
        (stMeRes.value.data.online_courses as OnlineEnrolledCourse[]).forEach((c) => {
          onlineMap.set(`online:${c.course_id}`, {
            ...c,
            course_format: "online" as const,
          });
        });
      }
      if (onlRes.status === "fulfilled" && onlRes.value?.success && Array.isArray(onlRes.value?.data)) {
        (onlRes.value.data as OnlineEnrolledCourse[]).forEach((c) => {
          const key = `online:${c.course_id}`;
          onlineMap.set(key, {
            ...(onlineMap.get(key) || {}),
            ...c,
            course_format: "online" as const,
          });
        });
      }
      setOnlineCourses(Array.from(onlineMap.values()));

      if (
        stMeRes.status === "fulfilled" &&
        !stMeRes.value?.success &&
        onlRes.status === "fulfilled" &&
        !onlRes.value?.success
      ) {
        setEnrError(stMeRes.value?.message || "Unable to load your enrolled courses.");
      }
    } catch {
      setEnrError("Network error while loading enrolled courses.");
    } finally {
      setIsEnrLoading(false);
    }
  }, [user_id]);

  useEffect(() => {
    if (!isStudentLoading && user_id) {
      loadEnrollments();
    } else if (!isStudentLoading && !user_id) {
      setIsEnrLoading(false);
    }
  }, [user_id, isStudentLoading, loadEnrollments]);

  // ── Filter Section 1A: Offline Enrolled Courses ──
  const filteredEnrollments = enrollments.filter((e) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const cName = (e.course_name || "").toLowerCase();
    const cCode = (e.course_code || "").toLowerCase();
    const bName = ((e as any).batch_name || "").toLowerCase();
    const regNo = (e.registration_number || "").toLowerCase();
    const stcId = String(e.stc_id || "");
    return (
      cName.includes(term) ||
      cCode.includes(term) ||
      bName.includes(term) ||
      regNo.includes(term) ||
      stcId.includes(term)
    );
  });

  // ── Filter Section 1B: Online Enrolled Courses ──
  const filteredOnlineCourses = onlineCourses.filter((c) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const cName = (c.course_name || "").toLowerCase();
    const cCode = (c.course_code || "").toLowerCase();
    const desc = (c.course_description || "").toLowerCase();
    const cId = String(c.course_id || "");
    return cName.includes(term) || cCode.includes(term) || desc.includes(term) || cId.includes(term);
  });

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-3 sm:p-5 md:p-6 lg:p-8 space-y-5 sm:space-y-7 lg:space-y-8 max-w-screen-2xl mx-auto">
        {/* ── Page Header & Unified Search ── */}
        <motion.div
          {...fadeUp(0)}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4"
        >
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#5B21F4] animate-pulse" />
              <span className="text-[10px] sm:text-xs font-bold text-[#5B21F4] uppercase tracking-wider">
                Academic Curriculum
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#111827] tracking-tight">
              My Enrolled Courses
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
              Your registered academic classroom programs, batch schedules, fees ledger, and online LMS courses.
            </p>
          </div>

          {/* Global Search across enrolled courses */}
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
              <input
                type="text"
                placeholder="Search enrolled courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 sm:h-10 pl-9 pr-4 rounded-xl bg-white border border-[#E2E8F0] text-xs sm:text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#5B21F4] focus:ring-2 focus:ring-[#5B21F4]/10 transition-all shadow-sm"
                aria-label="Search courses"
              />
            </div>
          </div>
        </motion.div>

        {/* ── Student Registration Profile Banner ── */}
        {registration_number && (
          <motion.div {...fadeUp(0.05)}>
            <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-[#5B21F4]/10 via-[#2563EB]/5 to-transparent border border-[#DDD6FE] flex items-center justify-between shadow-sm gap-2">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#5B21F4] text-white flex items-center justify-center font-bold shadow-md shadow-[#5B21F4]/20 shrink-0">
                  <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-[11px] font-bold text-[#5B21F4] uppercase tracking-wide truncate">
                    Verified Academic Profile
                  </p>
                  <p className="text-xs sm:text-sm font-extrabold text-[#111827] truncate">
                    Registration No: <span className="font-mono">{registration_number}</span>
                  </p>
                </div>
              </div>
              <Link
                href="/student/fees"
                className="text-xs font-bold text-[#5B21F4] hover:text-[#4C1BD4] hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Fee Summary</span>
                <span>&rarr;</span>
              </Link>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1 — MY ENROLLED COURSES (Always First at Top)                 */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <section className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#F1EEFF] text-[#5B21F4] flex items-center justify-center shrink-0">
                <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg lg:text-xl font-black text-[#111827]">
                    Courses
                  </h2>
                  <Badge variant="default" className="text-[10px] sm:text-xs">
                    {enrollments.length + onlineCourses.length} Active {enrollments.length + onlineCourses.length === 1 ? "Course" : "Courses"}
                  </Badge>
                </div>
                <p className="text-[11px] sm:text-xs text-[#64748B]">
                  Academic classroom programs and online LMS courses active in your student record
                </p>
              </div>
            </div>
          </div>

          {/* Exactly 3 Sections / Tabs: [ Enrolled Courses ] [ Offline Courses ] [ Online Courses ] */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200/80 overflow-x-auto w-fit">
            <button
              type="button"
              onClick={() => setCoursesTab("enrolled")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                coursesTab === "enrolled"
                  ? "bg-white text-[#5B21F4] shadow-sm font-extrabold"
                  : "text-[#64748B] hover:text-[#111827]"
              }`}
            >
              <span>Enrolled Courses</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  coursesTab === "enrolled"
                    ? "bg-[#F1EEFF] text-[#5B21F4]"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {enrollments.length + onlineCourses.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCoursesTab("offline")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                coursesTab === "offline"
                  ? "bg-white text-[#5B21F4] shadow-sm font-extrabold"
                  : "text-[#64748B] hover:text-[#111827]"
              }`}
            >
              <span>Offline Courses</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  coursesTab === "offline"
                    ? "bg-[#F1EEFF] text-[#5B21F4]"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {enrollments.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCoursesTab("online")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                coursesTab === "online"
                  ? "bg-white text-[#5B21F4] shadow-sm font-extrabold"
                  : "text-[#64748B] hover:text-[#111827]"
              }`}
            >
              <span>Online Courses</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  coursesTab === "online"
                    ? "bg-[#F1EEFF] text-[#5B21F4]"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {onlineCourses.length}
              </span>
            </button>
          </div>

          {/* Enrollment Error Notice */}
          {!isEnrLoading && enrError && (
            <Alert variant="destructive" className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <AlertDescription className="truncate">{enrError}</AlertDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadEnrollments}
                className="h-8 px-3 text-xs font-bold border-red-300 text-red-700 hover:bg-red-100 shrink-0"
              >
                Retry
              </Button>
            </Alert>
          )}

          {/* Enrolled Courses Skeletons (2 columns mobile, tablet & desktop; 3 columns XL) */}
          {isEnrLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="overflow-hidden border border-[#DDD6FE]/60 flex flex-col justify-between">
                  <Skeleton className="w-full aspect-[16/9]" />
                  <div className="p-2.5 sm:p-4 space-y-2.5">
                    <div className="space-y-1.5">
                      <Skeleton className="w-4/5 h-4 rounded" />
                      <Skeleton className="w-1/2 h-3 rounded" />
                    </div>
                    <Skeleton className="w-full h-16 sm:h-20 rounded-xl" />
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2 pt-1">
                      <Skeleton className="h-8 sm:h-9 rounded-lg" />
                      <Skeleton className="h-8 sm:h-9 rounded-lg" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Enrolled Course Cards (Strictly grid-cols-2 on mobile, tablet & desktop; 3 on xl) */}
          {!isEnrLoading &&
            !enrError &&
            ((coursesTab === "enrolled" && (filteredEnrollments.length > 0 || filteredOnlineCourses.length > 0)) ||
              (coursesTab === "offline" && filteredEnrollments.length > 0) ||
              (coursesTab === "online" && filteredOnlineCourses.length > 0)) && (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                {/* 1. Offline Courses */}
                {(coursesTab === "enrolled" || coursesTab === "offline") &&
                  filteredEnrollments.map((enrollment, i) => {
                    const courseCode = enrollment.course_code || "COURSE";
                    const theme = getThemeForCode(courseCode);
                    const courseName = enrollment.course_name || `Course #${enrollment.course_id}`;
                    const totalFee = extractEnrollmentTotalFee(enrollment);
                    const discount = extractEnrollmentDiscount(enrollment);
                    const initialPayment = extractEnrollmentInitialPayment(enrollment);
                    const dues = extractEnrollmentDues(enrollment);
                    const totalPaid = extractEnrollmentTotalPaid(enrollment);
                    const batchName = (enrollment as any).batch_name || "General Batch";
                    const isFullyPaid = dues <= 0;
                    const status = isFullyPaid ? "Fully Paid" : "Active";

                    const rawImg =
                      (enrollment as any).course_img_path ||
                      (enrollment as any).img_path ||
                      (enrollment as any).course_image ||
                      (enrollment as any).image ||
                      catalogMap.get(Number(enrollment.course_id))?.course_img_path;
                    const resolvedImg = getCourseImageUrl(rawImg);

                    return (
                      <motion.div
                        key={`off_${enrollment.stc_id}`}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: 0.05 + i * 0.04,
                          duration: 0.35,
                          ease: [0.4, 0, 0.2, 1] as const,
                        }}
                        className="flex"
                      >
                        <Card className="w-full flex flex-col justify-between overflow-hidden border-2 border-[#DDD6FE]/70 hover:border-[#5B21F4] transition-all md:hover:-translate-y-0.5 md:hover:shadow-md group relative bg-white">
                          {/* Top highlight indicator */}
                          <div
                            className="h-1 sm:h-1.5 w-full shrink-0"
                            style={{
                              background: `linear-gradient(90deg, ${theme.color} 0%, #2563EB 100%)`,
                            }}
                          />

                          {/* ── Top Course Image Banner ── */}
                          <div className="relative aspect-[16/9] w-full bg-slate-900 overflow-hidden shrink-0">
                            <CourseThumbnail
                              src={resolvedImg}
                              alt={courseName}
                              courseCode={courseCode}
                              courseName={courseName}
                              isOnline={false}
                              theme={theme}
                            />

                            {/* Format Badge (Top Left) */}
                            <div className="absolute top-2 left-2 z-10 flex items-center">
                              <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-blue-600/90 text-white backdrop-blur-md shadow-xs border border-blue-400/30 tracking-wide">
                                Offline Course
                              </span>
                            </div>

                            {/* Status Badge (Top Right) */}
                            <div className="absolute top-2 right-2 z-10 flex items-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold backdrop-blur-md shadow-xs border ${
                                  isFullyPaid
                                    ? "bg-emerald-600/90 text-white border-emerald-400/30"
                                    : "bg-emerald-600/90 text-white border-emerald-400/30"
                                }`}
                              >
                                {status}
                              </span>
                            </div>

                            {/* Course Code (Bottom Left) */}
                            {enrollment.course_code && (
                              <div className="absolute bottom-2 left-2 z-10 flex items-center">
                                <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black bg-black/65 text-white backdrop-blur-md border border-white/20 uppercase tracking-wider shadow-xs">
                                  {enrollment.course_code}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Header */}
                          <CardHeader className="p-2.5 sm:p-4 space-y-1.5">
                            <div>
                              <CardTitle className="line-clamp-2 text-xs sm:text-sm lg:text-base font-bold text-[#111827] leading-tight sm:leading-snug group-hover:text-[#5B21F4] transition-colors">
                                {courseName}
                              </CardTitle>

                              <div className="flex items-center gap-1 text-[10px] sm:text-xs text-[#64748B] mt-1.5 min-w-0">
                                <span className="shrink-0 font-medium text-[#475569]">Batch:</span>
                                <span className="truncate font-semibold text-[#111827]">{batchName}</span>
                              </div>

                              <div className="mt-1 flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-mono font-bold bg-[#F8FAFC] text-[#475569] px-1.5 py-0.5 rounded border border-[#E2E8F0] cursor-help">
                                      #{enrollment.stc_id}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Enrollment ID #{enrollment.stc_id}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </CardHeader>

                          {/* Financial Breakdown */}
                          <CardContent className="p-2 sm:p-4 lg:p-5 pt-0 space-y-1.5 sm:space-y-2">
                            {/* Mobile: Compact single row */}
                            <div className="flex sm:hidden items-center justify-between text-[10px] pt-1.5 border-t border-[#F1F5F9]">
                              <span className="text-[#64748B]">
                                Paid: <strong className="text-emerald-700">₹{totalPaid.toLocaleString("en-IN")}</strong>
                              </span>
                              <span className={dues > 0 ? "text-amber-700 font-bold" : "text-emerald-700 font-bold"}>
                                {dues > 0 ? `Due: ₹${dues.toLocaleString("en-IN")}` : "Paid ✓"}
                              </span>
                            </div>

                            <div className="hidden sm:block p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1 text-[10px] sm:text-xs">
                              <div className="flex items-center justify-between text-[#64748B]">
                                <span className="truncate">Total Fee:</span>
                                <span className="font-semibold text-[#111827] shrink-0">
                                  ₹{totalFee.toLocaleString("en-IN")}
                                </span>
                              </div>

                              {discount > 0 && (
                                <div className="flex items-center justify-between text-emerald-600">
                                  <span className="truncate">Discount:</span>
                                  <span className="font-semibold shrink-0">
                                    -₹{discount.toLocaleString("en-IN")}
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center justify-between text-[#64748B]">
                                <span className="truncate">Initial:</span>
                                <span className="font-semibold text-[#111827] shrink-0">
                                  ₹{initialPayment.toLocaleString("en-IN")}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[#64748B]">
                                <span className="truncate">Paid:</span>
                                <span className="font-semibold text-emerald-700 shrink-0">
                                  ₹{totalPaid.toLocaleString("en-IN")}
                                </span>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0] font-bold">
                                <span className={`truncate ${dues > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                                  Remaining Due:
                                </span>
                                <span className={`shrink-0 ${dues > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                                  ₹{dues.toLocaleString("en-IN")}
                                </span>
                              </div>
                            </div>
                          </CardContent>

                          {/* Card Footer Actions */}
                          <CardFooter className="p-2 sm:p-4 lg:p-5 pt-0 mt-auto">
                            {/* Mobile: Single primary action */}
                            <div className="block sm:hidden w-full">
                              {dues > 0 ? (
                                <Button
                                  asChild
                                  size="sm"
                                  className="w-full h-7 text-[10px] font-bold bg-[#5B21F4] hover:bg-[#4C1BD4] text-white shadow-none"
                                >
                                  <Link href="/student/fees">
                                    <span>Pay Due</span>
                                    <ArrowRight className="size-3 ml-1" />
                                  </Link>
                                </Button>
                              ) : (
                                <Button
                                  asChild
                                  size="sm"
                                  className="w-full h-7 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-none"
                                >
                                  <Link href={`/student/courses/${enrollment.course_id}`}>
                                    <span>View Course</span>
                                    <ArrowRight className="size-3 ml-1" />
                                  </Link>
                                </Button>
                              )}
                            </div>

                            {/* Desktop: Dual action buttons */}
                            <div className="hidden sm:grid grid-cols-2 gap-1.5 sm:gap-2 w-full">
                              <Button
                                asChild
                                size="sm"
                                className="w-full text-xs lg:text-sm px-1.5 sm:px-3 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white shadow-sm"
                              >
                                <Link href={`/student/courses/${enrollment.course_id}`}>
                                  <span className="truncate">View Course</span>
                                  <ArrowRight className="size-3 sm:size-3.5 shrink-0 hidden sm:inline" />
                                </Link>
                              </Button>

                              {dues > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      asChild
                                      variant="outline"
                                      size="sm"
                                      className="w-full text-xs lg:text-sm px-1.5 sm:px-3 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900 shadow-sm"
                                    >
                                      <Link href="/student/fees">
                                        <CreditCard className="size-3 sm:size-3.5 shrink-0 text-amber-700" />
                                        <span className="truncate">Pay Due</span>
                                      </Link>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Pay remaining dues</TooltipContent>
                                </Tooltip>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled
                                  className="w-full text-xs lg:text-sm px-1.5 sm:px-3 border-emerald-200 bg-emerald-50 text-emerald-700 opacity-90 cursor-not-allowed shadow-none"
                                >
                                  <CheckCircle2 className="size-3 sm:size-3.5 shrink-0 text-emerald-600" />
                                  <span className="truncate">Paid</span>
                                </Button>
                              )}
                            </div>
                          </CardFooter>
                        </Card>
                      </motion.div>
                    );
                  })}

                {/* 2. Online Courses */}
                {(coursesTab === "enrolled" || coursesTab === "online") &&
                  filteredOnlineCourses.map((course, idx) => {
                    const matchedCourse =
                      onlineCatalogMap.get(Number(course.course_id)) ||
                      catalogMap.get(Number(course.course_id));
                    const courseCode = course.course_code || matchedCourse?.course_code || "ADCA";
                    const theme = getThemeForCode(courseCode);
                    const rawImg =
                      course.course_img_path ||
                      (course as any).img_path ||
                      (course as any).course_image ||
                      (course as any).image ||
                      matchedCourse?.course_img_path;
                    const resolvedImg = getCourseImageUrl(rawImg);

                    return (
                      <motion.div
                        key={`onl_${course.course_id}`}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: 0.05 + idx * 0.04,
                          duration: 0.35,
                          ease: [0.4, 0, 0.2, 1] as const,
                        }}
                        className="flex"
                      >
                        <Card className="w-full flex flex-col justify-between overflow-hidden border-2 border-[#DDD6FE]/70 hover:border-[#5B21F4] transition-all md:hover:-translate-y-0.5 md:hover:shadow-md group relative bg-white">
                          {/* Top highlight indicator */}
                          <div
                            className="h-1 sm:h-1.5 w-full shrink-0"
                            style={{
                              background: `linear-gradient(90deg, ${theme.color} 0%, #5B21F4 100%)`,
                            }}
                          />

                          {/* ── Top Course Image Banner ── */}
                          <div className="relative aspect-[16/9] w-full bg-slate-900 overflow-hidden shrink-0">
                            <CourseThumbnail
                              src={resolvedImg}
                              alt={course.course_name}
                              courseCode={courseCode}
                              courseName={course.course_name}
                              isOnline={true}
                              theme={theme}
                            />

                            {/* Format Badge (Top Left) */}
                            <div className="absolute top-2 left-2 z-10 flex items-center">
                              <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-[#5B21F4]/90 text-white backdrop-blur-md shadow-xs border border-purple-400/30 flex items-center gap-1 tracking-wide">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                <span>Online Course</span>
                              </span>
                            </div>

                            {/* Status Badge (Top Right) */}
                            <div className="absolute top-2 right-2 z-10 flex items-center">
                              <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-emerald-600/90 text-white backdrop-blur-md shadow-xs border border-emerald-400/30">
                                Purchased
                              </span>
                            </div>

                            {/* Course Code (Bottom Left) */}
                            {courseCode && (
                              <div className="absolute bottom-2 left-2 z-10 flex items-center">
                                <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black bg-black/65 text-white backdrop-blur-md border border-white/20 uppercase tracking-wider shadow-xs">
                                  {courseCode}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Header */}
                          <CardHeader className="p-2.5 sm:p-4 space-y-1.5">
                            <div>
                              <CardTitle className="line-clamp-2 text-xs sm:text-sm lg:text-base font-bold text-[#111827] leading-tight sm:leading-snug group-hover:text-[#5B21F4] transition-colors">
                                {course.course_name}
                              </CardTitle>

                              <div className="flex items-center gap-1 text-[10px] sm:text-xs text-[#64748B] mt-1.5 min-w-0">
                                <span className="shrink-0 font-medium text-[#475569]">Type:</span>
                                <span className="truncate font-semibold text-[#111827]">Digital LMS &bull; Self-Paced</span>
                              </div>

                              <div className="mt-1 flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-mono font-bold bg-[#F8FAFC] text-[#475569] px-1.5 py-0.5 rounded border border-[#E2E8F0] cursor-help">
                                      #{course.course_id}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Course ID #{course.course_id}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </CardHeader>

                        {/* Meta Breakdown */}
                        <CardContent className="p-2 sm:p-4 lg:p-5 pt-0 space-y-1.5 sm:space-y-2">
                          {/* Mobile: Compact single row */}
                          <div className="flex sm:hidden items-center justify-between text-[10px] pt-1.5 border-t border-[#F1F5F9]">
                            <span className="text-[#64748B] flex items-center gap-1 font-medium">
                              <Clock className="w-3 h-3 text-[#5B21F4]" />
                              {course.course_duration || "Self-Paced"}
                            </span>
                            <span className="text-emerald-700 font-bold">
                              ₹{Number(course.amount_paid || course.course_fee || 0).toLocaleString("en-IN")}
                            </span>
                          </div>

                          {/* Desktop: Details Box */}
                          <div className="hidden sm:block p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1 text-[10px] sm:text-xs">
                            <div className="flex items-center justify-between text-[#64748B]">
                              <span className="truncate">Duration:</span>
                              <span className="font-semibold text-[#111827] shrink-0">
                                {course.course_duration || "Self-Paced"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[#64748B]">
                              <span className="truncate">Validity:</span>
                              <span className="font-semibold text-[#111827] shrink-0">
                                {course.course_validity || "Lifetime Access"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[#64748B] pt-0.5 border-t border-[#E2E8F0]/60">
                              <span className="truncate font-bold text-[#111827]">Amount Paid:</span>
                              <span className="font-bold text-emerald-700 shrink-0">
                                ₹{Number(course.amount_paid || course.course_fee || 0).toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>
                        </CardContent>

                        <CardFooter className="p-2 sm:p-4 lg:p-5 pt-0 mt-auto">
                          <Button
                            asChild
                            size="sm"
                            className="w-full text-xs lg:text-sm px-1.5 sm:px-3 bg-gradient-to-r from-[#5B21F4] to-[#4C1BD4] hover:from-[#4C1BD4] hover:to-[#3B12B3] text-white shadow-sm flex items-center justify-center gap-1.5 font-bold h-8 sm:h-9"
                          >
                            <Link href={`/student/online-courses/${course.course_id}`}>
                              <PlayCircle className="size-3.5 sm:size-4 shrink-0" />
                              <span className="truncate">Continue Learning</span>
                            </Link>
                          </Button>
                        </CardFooter>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}

          {/* Empty States depending on active tab */}
          {!isEnrLoading &&
            !enrError &&
            ((coursesTab === "enrolled" &&
              filteredEnrollments.length === 0 &&
              filteredOnlineCourses.length === 0) ||
              (coursesTab === "offline" && filteredEnrollments.length === 0) ||
              (coursesTab === "online" && filteredOnlineCourses.length === 0)) && (
              <Card className="text-center py-8 sm:py-10 px-4 sm:px-6 space-y-2 border-dashed border-[#E2E8F0]">
                {coursesTab === "online" ? (
                  <PlayCircle className="size-8 sm:size-10 text-[#CBD5E1] mx-auto" />
                ) : (
                  <BookOpen className="size-8 sm:size-10 text-[#CBD5E1] mx-auto" />
                )}
                <h3 className="text-xs sm:text-sm font-bold text-[#111827]">
                  {search
                    ? `No ${coursesTab} courses match "${search}"`
                    : coursesTab === "online"
                    ? "No online courses purchased yet"
                    : coursesTab === "offline"
                    ? "No offline courses enrolled"
                    : "No courses enrolled yet"}
                </h3>
                <p className="text-[11px] sm:text-xs text-[#64748B] max-w-sm mx-auto">
                  {search
                    ? "Try searching for a different keyword or check the full catalog below."
                    : coursesTab === "online"
                    ? "Explore our digital LMS courses to start learning anywhere."
                    : coursesTab === "offline"
                    ? "Offline classroom admissions will appear here once verified."
                    : "Browse the complete course catalog below to explore and enroll in programs."}
                </p>
                {!search && (
                  <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
                    {coursesTab !== "online" && (
                      <Button asChild size="sm" className="bg-[#111827] hover:bg-[#1E293B] text-white text-xs font-bold rounded-xl">
                        <Link href="/student/offline-courses">Browse Offline Courses</Link>
                      </Button>
                    )}
                    {coursesTab !== "offline" && (
                      <Button asChild size="sm" className="bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold rounded-xl shadow-md shadow-[#5B21F4]/20">
                        <Link href="/student/online-courses">Browse Online Courses</Link>
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            )}
        </section>

        {/* ── Section Divider ── */}
        <div className="relative py-1 sm:py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#E2E8F0]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[#F8FAFC] px-3 sm:px-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
              Explore Course Offerings
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2 — PROGRAM DIRECTORIES (Offline & Online Gateways)            */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gateway 1: Offline Courses */}
          <Card className="p-4 sm:p-5 rounded-2xl border border-[#E2E8F0] bg-white hover:border-[#CBD5E1] transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shadow-sm">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#111827]">
                    Offline Classroom Courses
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    In-person diploma courses &amp; practical computer lab sessions
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#64748B] leading-relaxed pt-1">
                Explore recognized diploma programs (ADCA, DCA, DTP, Tally) available at authorized Brainzima study centers with hands-on lab training.
              </p>
            </div>
            <div className="pt-2">
              <Button asChild size="sm" className="w-full bg-[#111827] hover:bg-[#1E293B] text-white text-xs font-bold rounded-xl h-10">
                <Link href="/student/offline-courses" className="flex items-center justify-center gap-1.5">
                  <span>Browse Offline Courses</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </Card>

          {/* Gateway 2: Online Courses */}
          <Card className="p-4 sm:p-5 rounded-2xl border border-[#DDD6FE] bg-gradient-to-br from-[#F1EEFF]/40 to-white hover:border-[#5B21F4] transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#F1EEFF] text-[#5B21F4] flex items-center justify-center font-bold shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#111827]">
                    Online LMS Video Courses
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Self-paced digital lectures, certificates &amp; lifetime access
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#64748B] leading-relaxed pt-1">
                Watch high-definition lessons anytime, follow curriculum syllabi, and earn verified certificates on course completion.
              </p>
            </div>
            <div className="pt-2">
              <Button asChild size="sm" className="w-full bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold rounded-xl shadow-md shadow-[#5B21F4]/20 h-10">
                <Link href="/student/online-courses" className="flex items-center justify-center gap-1.5">
                  <span>Browse Online Courses</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </TooltipProvider>
  );
}
