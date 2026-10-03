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
} from "lucide-react";
import Link from "next/link";
import {
  getStudentEnrollments,
  getCourses,
  type EnrollmentItem,
  type Course,
} from "@/lib/api";
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

// ── Financial Value Extractors ──
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

export default function UserCoursesPage() {
  const { isExistingStudent, session, getEnrollmentUrl } = useEnrollmentRoute();

  // State 1: Enrolled Courses (if user has active enrollments)
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [isEnrLoading, setIsEnrLoading] = useState(true);
  const [enrError, setEnrError] = useState<string | null>(null);

  // State 2: Complete Course Catalog
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Search state across both sections
  const [search, setSearch] = useState("");

  const userId = session?.user_id ? Number(session.user_id) : undefined;
  const registrationNumber = session?.registration_number;

  // ── Fetch Enrolled Courses independently ──
  const loadEnrollments = useCallback(async () => {
    if (!userId) {
      setIsEnrLoading(false);
      return;
    }
    setIsEnrLoading(true);
    setEnrError(null);

    try {
      const res = await getStudentEnrollments(userId);
      if (res.success && res.data) {
        let list: EnrollmentItem[] = [];
        if (Array.isArray(res.data)) {
          list = res.data;
        } else if ("enrollments" in res.data && Array.isArray((res.data as any).enrollments)) {
          list = (res.data as any).enrollments;
        }
        setEnrollments(list);
      } else {
        // Non-student users may not have enrollments yet; don't treat as breaking error
        setEnrollments([]);
      }
    } catch {
      setEnrError("Unable to load enrolled courses.");
    } finally {
      setIsEnrLoading(false);
    }
  }, [userId]);

  // ── Fetch All Courses (Catalog) independently ──
  const loadCatalog = useCallback(async () => {
    setIsCatalogLoading(true);
    setCatalogError(null);

    try {
      const res = await getCourses();
      if (res.success && res.data) {
        let list: Course[] = [];
        if (Array.isArray(res.data)) {
          list = res.data;
        } else if ("courses" in res.data && Array.isArray((res.data as any).courses)) {
          list = (res.data as any).courses;
        }
        setAllCourses(list);
      } else {
        setCatalogError(res.message || "Unable to load course catalog.");
      }
    } catch {
      setCatalogError("Network error while connecting to course catalog.");
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (userId) {
      loadEnrollments();
    } else {
      setIsEnrLoading(false);
    }
  }, [userId, loadEnrollments]);

  // ── Build Enrolled Course ID Set ──
  const enrolledCourseIdSet = new Set<number>();
  enrollments.forEach((e) => {
    const cId = Number((e as any).stc_course_id ?? e.course_id);
    if (cId) enrolledCourseIdSet.add(cId);
  });

  // ── Filter Section 1: Enrolled Courses ──
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

  // ── Filter Section 2: All Catalog Courses ──
  const filteredCatalog = allCourses.filter((c) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const cName = (c.course_name || "").toLowerCase();
    const cCode = (c.course_code || "").toLowerCase();
    const desc = (c.course_description || "").toLowerCase();
    const duration = (c.course_duration || "").toLowerCase();
    const modules = (c.course_modules || "").toLowerCase();
    const cId = String(c.course_id || "");
    return (
      cName.includes(term) ||
      cCode.includes(term) ||
      desc.includes(term) ||
      duration.includes(term) ||
      modules.includes(term) ||
      cId.includes(term)
    );
  });

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-3 sm:p-5 md:p-6 lg:p-8 space-y-5 sm:space-y-7 lg:space-y-8 max-w-screen-xl mx-auto">
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
              {enrollments.length > 0 ? "My Enrolled Courses & Catalog" : "Course Catalog"}
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
              Explore industry-standard certifications, modules, syllabus details, and admission options.
            </p>
          </div>

          {/* Global Search across both enrolled & catalog courses */}
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
              <input
                type="text"
                placeholder="Search all courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 sm:h-10 pl-9 pr-4 rounded-xl bg-white border border-[#E2E8F0] text-xs sm:text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#5B21F4] focus:ring-2 focus:ring-[#5B21F4]/10 transition-all shadow-sm"
                aria-label="Search courses"
              />
            </div>
          </div>
        </motion.div>

        {/* ── Student Registration Profile Banner (if student) ── */}
        {registrationNumber && (
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
                    Registration No: <span className="font-mono">{registrationNumber}</span>
                  </p>
                </div>
              </div>
              <Link
                href={isExistingStudent ? "/student/fees" : "/user/dashboard"}
                className="text-xs font-bold text-[#5B21F4] hover:text-[#4C1BD4] hover:underline flex items-center gap-1 shrink-0"
              >
                <span>{isExistingStudent ? "Fee Summary" : "My Dashboard"}</span>
                <span>&rarr;</span>
              </Link>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1 — MY ENROLLED COURSES (Only shown when user has enrollments) */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {enrollments.length > 0 && (
          <>
            <section className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#F1EEFF] text-[#5B21F4] flex items-center justify-center shrink-0">
                    <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg lg:text-xl font-black text-[#111827]">
                        My Enrolled Courses
                      </h2>
                      <Badge variant="default" className="text-[10px] sm:text-xs">
                        {enrollments.length} Active {enrollments.length === 1 ? "Course" : "Courses"}
                      </Badge>
                    </div>
                    <p className="text-[11px] sm:text-xs text-[#64748B]">
                      Academic programs currently active in your student record
                    </p>
                  </div>
                </div>
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

              {/* Enrolled Courses Skeletons */}
              {isEnrLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="p-3 sm:p-4 lg:p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <Skeleton className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-xl sm:rounded-2xl" />
                        <Skeleton className="w-14 sm:w-16 h-5 rounded-full" />
                      </div>
                      <div className="space-y-1.5">
                        <Skeleton className="w-4/5 h-4 rounded" />
                        <Skeleton className="w-1/2 h-3 rounded" />
                        <Skeleton className="w-full h-16 sm:h-20 rounded-xl" />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 pt-1">
                        <Skeleton className="h-8 sm:h-9 rounded-lg" />
                        <Skeleton className="h-8 sm:h-9 rounded-lg" />
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Enrolled Course Cards */}
              {!isEnrLoading && !enrError && filteredEnrollments.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
                  {filteredEnrollments.map((enrollment, i) => {
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
                    const syllabusUrl = isExistingStudent
                      ? `/student/courses/${enrollment.course_id}`
                      : `/user/courses/${enrollment.course_id}`;

                    return (
                      <motion.div
                        key={enrollment.stc_id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: 0.05 + i * 0.04,
                          duration: 0.35,
                          ease: [0.4, 0, 0.2, 1] as const,
                        }}
                        className="flex"
                      >
                        <Card className="w-full flex flex-col justify-between overflow-hidden border-2 border-[#DDD6FE]/70 hover:border-[#5B21F4] transition-all md:hover:-translate-y-0.5 md:hover:shadow-md group relative">
                          {/* Top highlight indicator */}
                          <div
                            className="h-1 sm:h-1.5 w-full shrink-0"
                            style={{
                              background: `linear-gradient(90deg, ${theme.color} 0%, #2563EB 100%)`,
                            }}
                          />

                          {/* Header */}
                          <CardHeader className="p-2.5 sm:p-4 lg:p-5 space-y-2">
                            <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                              <div
                                className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                                style={{ backgroundColor: theme.bg, color: theme.color }}
                              >
                                <BookOpen className="size-4 sm:size-5 lg:size-6" />
                              </div>
                              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-end">
                                {enrollment.course_code && (
                                  <Badge
                                    variant="outline"
                                    className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold"
                                    style={{
                                      backgroundColor: theme.bg,
                                      color: theme.color,
                                      borderColor: theme.border,
                                    }}
                                  >
                                    {enrollment.course_code}
                                  </Badge>
                                )}
                                <Badge
                                  variant={isFullyPaid ? "success" : "default"}
                                  className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold"
                                >
                                  {status}
                                </Badge>
                              </div>
                            </div>

                            <div>
                              <CardTitle className="line-clamp-2 text-xs sm:text-sm lg:text-base font-bold text-[#111827] leading-tight sm:leading-snug">
                                {courseName}
                              </CardTitle>

                              <div className="flex items-center gap-1 text-[10px] sm:text-xs text-[#64748B] mt-1 min-w-0">
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
                          <CardContent className="p-2.5 pt-0 sm:p-4 sm:pt-0 lg:p-5 lg:pt-0 space-y-2">
                            <div className="p-2 sm:p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1 text-[10px] sm:text-xs">
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
                          <CardFooter className="p-2.5 pt-0 sm:p-4 sm:pt-0 lg:p-5 lg:pt-0 mt-auto">
                            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 w-full">
                              <Button
                                asChild
                                size="sm"
                                className="w-full text-[11px] sm:text-xs lg:text-sm px-1.5 sm:px-3 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white shadow-sm"
                              >
                                <Link href={syllabusUrl}>
                                  <span className="truncate">Syllabus</span>
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
                                      className="w-full text-[11px] sm:text-xs lg:text-sm px-1.5 sm:px-3 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900 shadow-sm"
                                    >
                                      <Link href={isExistingStudent ? "/student/fees" : "/user/dashboard"}>
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
                                  className="w-full text-[11px] sm:text-xs lg:text-sm px-1.5 sm:px-3 border-emerald-200 bg-emerald-50 text-emerald-700 opacity-90 cursor-not-allowed shadow-none"
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
                </div>
              )}
            </section>

            {/* ── Section Divider ── */}
            <div className="relative py-1 sm:py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E2E8F0]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#F8FAFC] px-3 sm:px-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                  Explore More Programs
                </span>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2 — ALL COURSES (Complete Catalog)                             */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <section className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
                <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg lg:text-xl font-black text-[#111827]">
                    All Courses
                  </h2>
                  <Badge variant="blue" className="text-[10px] sm:text-xs">
                    {allCourses.length} Available {allCourses.length === 1 ? "Program" : "Programs"}
                  </Badge>
                </div>
                <p className="text-[11px] sm:text-xs text-[#64748B]">
                  Complete curriculum catalog — explore modules, syllabus details, and new admissions
                </p>
              </div>
            </div>
          </div>

          {/* Catalog Error Notice */}
          {!isCatalogLoading && catalogError && (
            <Alert variant="destructive" className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <AlertDescription className="truncate">{catalogError}</AlertDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadCatalog}
                className="h-8 px-3 text-xs font-bold border-red-300 text-red-700 hover:bg-red-100 shrink-0"
              >
                Retry
              </Button>
            </Alert>
          )}

          {/* Catalog Skeletons (2 columns mobile, tablet & desktop; 3 columns XL) */}
          {isCatalogLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="p-3 sm:p-4 lg:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-xl sm:rounded-2xl" />
                    <Skeleton className="w-14 sm:w-16 h-5 rounded-full" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="w-4/5 h-4 rounded" />
                    <Skeleton className="w-full h-8 sm:h-10 rounded" />
                    <Skeleton className="w-2/3 h-3 rounded" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2 pt-1">
                    <Skeleton className="h-8 sm:h-9 rounded-lg" />
                    <Skeleton className="h-8 sm:h-9 rounded-lg" />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Catalog Course Cards (Strictly grid-cols-2 on mobile, tablet & desktop; 3 on xl) */}
          {!isCatalogLoading && !catalogError && filteredCatalog.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
              {filteredCatalog.map((course, i) => {
                const courseId = Number(course.course_id);
                const isEnrolled = enrolledCourseIdSet.has(courseId);
                const courseCode = course.course_code || "COURSE";
                const theme = getThemeForCode(courseCode);
                const feeNum = Number(course.course_fee || 0);
                const syllabusUrl = isExistingStudent
                  ? `/student/courses/${course.course_id}`
                  : `/user/courses/${course.course_id}`;

                return (
                  <motion.div
                    key={course.course_id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.05 + i * 0.03,
                      duration: 0.35,
                      ease: [0.4, 0, 0.2, 1] as const,
                    }}
                    className="flex"
                  >
                    <Card
                      className={`w-full flex flex-col justify-between overflow-hidden border transition-all md:hover:-translate-y-0.5 md:hover:shadow-md group relative ${
                        isEnrolled
                          ? "border-emerald-200 md:hover:border-emerald-400"
                          : "border-[#E2E8F0] md:hover:border-[#DDD6FE]"
                      }`}
                    >
                      <CardHeader className="p-2.5 sm:p-4 lg:p-5 space-y-2">
                        {/* Header icon + badges */}
                        <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                          <div
                            className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                            style={{ backgroundColor: theme.bg, color: theme.color }}
                          >
                            <BookOpen className="size-4 sm:size-5 lg:size-6" />
                          </div>

                          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-end">
                            {course.course_code && (
                              <Badge
                                variant="outline"
                                className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold"
                                style={{
                                  backgroundColor: theme.bg,
                                  color: theme.color,
                                  borderColor: theme.border,
                                }}
                              >
                                {course.course_code}
                              </Badge>
                            )}

                            {isEnrolled ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="success"
                                    className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold gap-1 cursor-help"
                                  >
                                    <CheckCircle2 className="size-2.5 sm:size-3 shrink-0 text-emerald-600" />
                                    <span className="truncate">Enrolled</span>
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  You are currently enrolled
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold"
                              >
                                Available
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <CardTitle className="line-clamp-2 text-xs sm:text-sm lg:text-base font-bold text-[#111827] leading-tight sm:leading-snug">
                            {course.course_name}
                          </CardTitle>

                          <CardDescription className="line-clamp-2 text-[11px] sm:text-xs text-[#64748B] mt-1 leading-relaxed">
                            {course.course_description || "Comprehensive curriculum and practical modules"}
                          </CardDescription>
                        </div>
                      </CardHeader>

                      <CardContent className="p-2.5 pt-0 sm:p-4 sm:pt-0 lg:p-5 lg:pt-0 space-y-2">
                        {/* Duration & Modules Meta */}
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-[#64748B] pt-2 border-t border-[#F1F5F9] min-w-0">
                          {course.course_duration && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex min-w-0 items-center gap-1 shrink-0 cursor-help">
                                  <Clock className="size-3 sm:size-3.5 text-[#94A3B8] shrink-0" />
                                  <span className="truncate max-w-[65px] sm:max-w-[85px]">
                                    {course.course_duration}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Duration: {course.course_duration}</TooltipContent>
                            </Tooltip>
                          )}

                          {course.course_duration && course.course_modules && (
                            <span className="text-[#CBD5E1] shrink-0">&bull;</span>
                          )}

                          {course.course_modules && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex min-w-0 items-center gap-1 cursor-help">
                                  <Layers className="size-3 sm:size-3.5 text-[#94A3B8] shrink-0" />
                                  <span className="truncate">{course.course_modules}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Modules: {course.course_modules}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>

                        {/* Fee Display */}
                        <div className="pt-2 border-t border-[#F8FAFC] flex items-center justify-between min-w-0 gap-1 text-[11px] sm:text-xs">
                          <span className="text-[#64748B] truncate text-[10px] sm:text-xs">
                            Tuition Fee:
                          </span>
                          <span className="font-extrabold text-xs sm:text-sm text-[#111827] whitespace-nowrap shrink-0">
                            ₹{feeNum.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </CardContent>

                      {/* Card Footer Actions */}
                      <CardFooter className="p-2.5 pt-0 sm:p-4 sm:pt-0 lg:p-5 lg:pt-0 mt-auto">
                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-[11px] sm:text-xs lg:text-sm px-1.5 sm:px-3 h-8 sm:h-9"
                            asChild
                          >
                            <Link href={syllabusUrl}>
                              <span className="truncate">View Details</span>
                            </Link>
                          </Button>

                          {isEnrolled ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              className="w-full text-[11px] sm:text-xs lg:text-sm px-1.5 sm:px-3 h-8 sm:h-9 bg-emerald-50 text-emerald-700 border-emerald-200 opacity-90 cursor-not-allowed shadow-none"
                            >
                              <CheckCircle2 className="size-3 sm:size-3.5 shrink-0 text-emerald-600" />
                              <span className="truncate">Enrolled</span>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="w-full text-[11px] sm:text-xs lg:text-sm px-1.5 sm:px-3 h-8 sm:h-9"
                              asChild
                            >
                              <Link href={getEnrollmentUrl(course.course_id)}>
                                <span className="truncate">Enroll Now</span>
                                <ArrowRight className="size-3 sm:size-3.5 shrink-0 hidden sm:inline" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Empty State for Catalog */}
          {!isCatalogLoading && !catalogError && filteredCatalog.length === 0 && (
            <Card className="text-center py-8 sm:py-10 px-4 sm:px-6 space-y-2 border-dashed border-[#E2E8F0]">
              <Compass className="size-8 sm:size-10 text-[#CBD5E1] mx-auto" />
              <h3 className="text-xs sm:text-sm font-bold text-[#111827]">
                {search
                  ? `No catalog courses match "${search}"`
                  : "No courses available right now."}
              </h3>
              <p className="text-[11px] sm:text-xs text-[#64748B] max-w-sm mx-auto">
                {search
                  ? "Try clearing the search filter to browse the full catalog."
                  : "Check back later for updated academic curriculum offerings."}
              </p>
            </Card>
          )}
        </section>
      </div>
    </TooltipProvider>
  );
}
