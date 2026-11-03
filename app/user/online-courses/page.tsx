"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Search,
  Clock,
  Calendar,
  Layers,
  ArrowRight,
  AlertCircle,
  GraduationCap,
  Play,
  PlayCircle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import Link from "next/link";
import {
  getOnlineCourses,
  type OnlineCourse,
} from "@/lib/api";
import { getSession } from "@/lib/session";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import CourseCard from "@/components/courses/CourseCard";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] as const },
});

const COURSE_COLOR_PALETTES = [
  {
    color: "#5B21F4",
    bg: "#F1EEFF",
    border: "#DDD6FE",
    tagColor: "#5B21F4",
    tagBg: "#F1EEFF",
  },
  {
    color: "#2563EB",
    bg: "#EFF6FF",
    border: "#DBEAFE",
    tagColor: "#2563EB",
    tagBg: "#EFF6FF",
  },
  {
    color: "#08A66A",
    bg: "#ECFDF5",
    border: "#D1FAE5",
    tagColor: "#08A66A",
    tagBg: "#ECFDF5",
  },
  {
    color: "#EA580C",
    bg: "#FFF7ED",
    border: "#FED7AA",
    tagColor: "#EA580C",
    tagBg: "#FFF7ED",
  },
];

function getPaletteForIndex(index: number) {
  return COURSE_COLOR_PALETTES[index % COURSE_COLOR_PALETTES.length];
}

export default function OnlineCoursesPage() {
  const [courses, setCourses] = useState<OnlineCourse[]>([]);
  const [purchasedCourseIds, setPurchasedCourseIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const session = getSession();
  const currentUserId = session?.user_id ? Number(session.user_id) : 0;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch active online courses from /api/onlinecoures
      const res = await getOnlineCourses({ status: "active" });

      if (!res.success || !res.data) {
        throw new Error(res.message || "Unable to load online courses.");
      }

      setCourses(res.data);

      // 2. Fetch purchase access state for each course if logged in
      if (currentUserId > 0) {
        try {
          const checkPromises = res.data.map(async (c) => {
            try {
              const accessRes = await fetch(`/api/onlinecoures/${c.course_id}/access`, {
                headers: {
                  "X-User-Id": String(currentUserId),
                  "X-User-Role": session?.role || "user",
                },
                cache: "no-store",
              });
              const json = await accessRes.json().catch(() => null);
              if (json?.data?.purchased) {
                return c.course_id;
              }
            } catch {
              /* ignore individual access check errors */
            }
            return null;
          });

          const results = await Promise.all(checkPromises);
          const validPurchased = results.filter((id): id is number => id !== null);
          setPurchasedCourseIds(validPurchased);
        } catch (accessErr) {
          console.warn("[OnlineCoursesPage] Access verification check notice:", accessErr);
        }
      }
    } catch (err: any) {
      console.error("[OnlineCoursesPage] Failed to fetch online courses:", err);
      setError(err?.message || "Failed to load online courses. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, session?.role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredCourses = courses.filter((c) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const name = (c.course_name || "").toLowerCase();
    const code = (c.course_code || "").toLowerCase();
    const desc = (c.course_description || "").toLowerCase();
    const duration = (c.course_duration || "").toLowerCase();
    const type = (c.course_type || "").toLowerCase();
    return (
      name.includes(term) ||
      code.includes(term) ||
      desc.includes(term) ||
      duration.includes(term) ||
      type.includes(term)
    );
  });

  return (
    <div className="p-3 sm:p-5 md:p-6 lg:p-8 space-y-5 sm:space-y-7 lg:space-y-8 max-w-screen-2xl mx-auto">
      {/* ── Page Header & Search ── */}
      <motion.div
        {...fadeUp(0)}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4"
      >
        <div>
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#5B21F4] animate-pulse" />
            <span className="text-[10px] sm:text-xs font-bold text-[#5B21F4] uppercase tracking-wider">
              Self-Paced Learning
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#111827] tracking-tight">
            Online Courses
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            Watch video lessons at your own pace. Introduction lesson is completely free!
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
            <input
              type="text"
              placeholder="Search online courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 sm:h-10 pl-9 pr-4 rounded-xl bg-white border border-[#E2E8F0] text-xs sm:text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#5B21F4] focus:ring-2 focus:ring-[#5B21F4]/10 transition-all shadow-sm"
              aria-label="Search online courses"
            />
          </div>
        </div>
      </motion.div>

      {/* ── Banner: Free Introduction Feature ── */}
      <motion.div {...fadeUp(0.05)}>
        <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-[#F1EEFF] via-[#EFF6FF] to-white border border-[#DDD6FE]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shadow-sm">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#5B21F4] to-[#7C3AED] text-white flex items-center justify-center shrink-0 shadow-sm">
              <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-[#111827]">
                  Free Demo Lessons
                </span>
                <Badge variant="outline" className="text-[9px] sm:text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 font-bold px-1.5 sm:px-2 py-0.5">
                  Free Access
                </Badge>
              </div>
              <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5 hidden sm:block">
                Every online course includes a free introductory video lesson. Watch module 1 before purchasing!
              </p>
              <p className="text-[10px] text-[#64748B] mt-0.5 sm:hidden">
                Watch free module 1 preview before purchasing.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Error Alert ── */}
      {!isLoading && error && (
        <Alert variant="destructive" className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <AlertDescription className="truncate">{error}</AlertDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="h-8 px-3 text-xs font-bold border-red-300 text-red-700 hover:bg-red-100 shrink-0"
          >
            Retry
          </Button>
        </Alert>
      )}

      {/* ── Loading Skeletons ── */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-2.5 sm:p-5 space-y-2.5 sm:space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl" />
                <Skeleton className="w-12 sm:w-16 h-4 sm:h-5 rounded-full" />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Skeleton className="w-3/4 h-3.5 sm:h-5 rounded" />
                <Skeleton className="w-full h-6 sm:h-12 rounded" />
              </div>
              <Skeleton className="h-7 sm:h-10 rounded-lg sm:rounded-xl w-full" />
            </Card>
          ))}
        </div>
      )}

      {/* ── Course Grid ── */}
      {!isLoading && !error && filteredCourses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
          {filteredCourses.map((course, index) => {
            const isPurchased = purchasedCourseIds.includes(course.course_id);

            return (
              <motion.div
                key={course.course_id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.04 + index * 0.04,
                  duration: 0.35,
                  ease: [0.4, 0, 0.2, 1] as const,
                }}
                className="flex"
              >
                <CourseCard
                  courseId={course.course_id}
                  courseCode={course.course_code}
                  courseName={course.course_name}
                  courseImgPath={course.course_img_path}
                  courseDuration={course.course_duration}
                  courseValidity={course.course_validity}
                  courseFee={course.course_fee}
                  courseType={course.course_type}
                  isEnrolled={isPurchased}
                  href={`/user/online-courses/${course.course_id}`}
                  isOnline={true}
                />
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && !error && filteredCourses.length === 0 && (
        <div className="p-8 sm:p-12 text-center rounded-2xl bg-white border border-[#E2E8F0] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F1EEFF] text-[#5B21F4] mx-auto flex items-center justify-center">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#111827]">No online courses found</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto">
            {search
              ? `No course matches "${search}". Try searching by course name or code like ADCA or DCA.`
              : "No active online courses are currently available."}
          </p>
          {search && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearch("")}
              className="mt-2 text-xs font-semibold"
            >
              Clear Search
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
