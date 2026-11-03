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
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import {
  getOnlineCourses,
  getCurrentStudent,
  getStudentOnlineCourses,
  checkOnlineCourseAccess,
  type OnlineCourse,
  type OnlineEnrolledCourse,
} from "@/lib/api";
import { getSession } from "@/lib/session";
import { useStudent } from "@/hooks/useStudent";
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

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function StudentOnlineCoursesPage() {
  const [courses, setCourses] = useState<OnlineCourse[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "enrolled" | "available">("all");

  const { user_id: hookUserId, student_id: hookStudentId, role: hookRole } = useStudent();
  const session = getSession();
  const effectiveUserId = hookUserId || (session?.user_id ? Number(session.user_id) : 0);
  const effectiveStudentId = hookStudentId || (session?.student_id ? Number(session.student_id) : 0);
  const effectiveRole = (hookRole || session?.role || "student") as "student" | "user";

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch active online courses catalog
      const res = await getOnlineCourses({ status: "active" });
      if (!res.success || !res.data) {
        throw new Error(res.message || "Unable to load online courses.");
      }
      setCourses(res.data);

      // 2. Fetch student profile and enrolled online courses
      const enrolledSet = new Set<number>();

      // Check A: getStudentOnlineCourses via effectiveUserId (/api/onlinecoures/enrolled)
      if (effectiveUserId > 0) {
        try {
          const enrolledRes = await getStudentOnlineCourses(effectiveUserId, effectiveRole);
          if (enrolledRes.success && Array.isArray(enrolledRes.data)) {
            enrolledRes.data.forEach((c: any) => {
              const cId = Number(c.course_id ?? c.stco_course_id);
              if (cId) enrolledSet.add(cId);
            });
          }
        } catch (enrErr) {
          console.warn("[StudentOnlineCourses] getStudentOnlineCourses notice:", enrErr);
        }
      }

      // Check B: getStudentOnlineCourses via effectiveStudentId if different
      if (effectiveStudentId > 0 && effectiveStudentId !== effectiveUserId) {
        try {
          const enrolledResAlt = await getStudentOnlineCourses(effectiveStudentId, effectiveRole);
          if (enrolledResAlt.success && Array.isArray(enrolledResAlt.data)) {
            enrolledResAlt.data.forEach((c: any) => {
              const cId = Number(c.course_id ?? c.stco_course_id);
              if (cId) enrolledSet.add(cId);
            });
          }
        } catch (enrErrAlt) {
          console.warn("[StudentOnlineCourses] getStudentOnlineCourses studentId notice:", enrErrAlt);
        }
      }

      // Check C: Student profile via getCurrentStudent
      const profileId = effectiveStudentId || effectiveUserId;
      if (profileId > 0) {
        try {
          const studentRes = await getCurrentStudent(profileId);
          if (studentRes.success && Array.isArray(studentRes.data?.online_courses)) {
            studentRes.data.online_courses.forEach((c: any) => {
              const cId = Number(c.course_id ?? c.stco_course_id);
              if (cId) enrolledSet.add(cId);
            });
          }
        } catch (stErr) {
          console.warn("[StudentOnlineCourses] Profile fetch notice:", stErr);
        }
      }

      // Check D: Direct access verification via checkOnlineCourseAccess for any remaining courses
      const uIdToCheck = effectiveUserId || effectiveStudentId;
      if (uIdToCheck > 0 && Array.isArray(res.data)) {
        const unchecked = res.data.filter((c) => !enrolledSet.has(c.course_id));
        if (unchecked.length > 0) {
          await Promise.allSettled(
            unchecked.map(async (c) => {
              try {
                const accRes = await checkOnlineCourseAccess(c.course_id, uIdToCheck, effectiveRole);
                if (accRes.success && accRes.data?.purchased) {
                  enrolledSet.add(c.course_id);
                }
              } catch {
                /* ignore */
              }
            })
          );
        }
      }

      setEnrolledCourseIds(enrolledSet);
    } catch (err: any) {
      console.error("[StudentOnlineCourses] Load error:", err);
      setError(err?.message || "Failed to load online courses.");
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId, effectiveStudentId, effectiveRole]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredCourses = courses.filter((course) => {
    const isEnrolled = enrolledCourseIds.has(course.course_id);
    if (activeTab === "enrolled" && !isEnrolled) return false;
    if (activeTab === "available" && isEnrolled) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      course.course_name.toLowerCase().includes(q) ||
      (course.course_code && course.course_code.toLowerCase().includes(q)) ||
      (course.course_description && course.course_description.toLowerCase().includes(q))
    );
  });

  const enrolledCount = courses.filter((c) => enrolledCourseIds.has(c.course_id)).length;
  const availableCount = courses.length - enrolledCount;

  return (
    <div className="p-3 sm:p-5 md:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-screen-2xl mx-auto">
      {/* ── Page Header ── */}
      <motion.div
        {...fadeUp(0)}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#5B21F4] animate-pulse" />
            <span className="text-[10px] sm:text-xs font-bold text-[#5B21F4] uppercase tracking-wider">
              E-Learning Academy
            </span>
          </div>
          <h1 className="text-lg sm:text-2xl lg:text-3xl font-black text-[#111827] tracking-tight">
            Online Courses &amp; Certifications
          </h1>
          <p className="text-[11px] sm:text-sm text-[#64748B] mt-0.5">
            Learn at your own pace with digital video lectures, comprehensive syllabus, and certified diplomas.
          </p>
        </div>

        {/* Global Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
          <input
            type="text"
            placeholder="Search online courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 sm:h-10 pl-9 pr-4 rounded-xl bg-white border border-[#E2E8F0] text-xs sm:text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#5B21F4] focus:ring-2 focus:ring-[#5B21F4]/10 transition-all shadow-sm"
          />
        </div>
      </motion.div>

      {/* ── Radix Tabs Filter ── */}
      <motion.div {...fadeUp(0.04)} className="flex items-center justify-between flex-wrap gap-2">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-auto">
          <TabsList className="h-9 sm:h-10 p-1 w-full sm:w-auto grid grid-cols-3 sm:flex">
            <TabsTrigger value="all" className="text-[11px] sm:text-xs py-1 px-2.5 sm:px-3.5 gap-1.5">
              <span>All Courses</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-200 text-slate-700">
                {courses.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="enrolled" className="text-[11px] sm:text-xs py-1 px-2.5 sm:px-3.5 gap-1.5">
              <span>Enrolled</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                {enrolledCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="available" className="text-[11px] sm:text-xs py-1 px-2.5 sm:px-3.5 gap-1.5">
              <span>Available</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-100 text-purple-800">
                {availableCount}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </motion.div>

      {/* ── Error Banner ── */}
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

      {/* ── Loading Skeletons (Strictly 2 Columns on Mobile) ── */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-2.5 sm:p-5 space-y-2.5 sm:space-y-4 rounded-xl sm:rounded-2xl border border-[#E2E8F0]">
              <div className="flex items-center justify-between">
                <Skeleton className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-2xl" />
                <Skeleton className="w-12 sm:w-16 h-4 sm:h-5 rounded-full" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="w-3/4 h-3.5 sm:h-5 rounded" />
                <Skeleton className="w-full h-7 sm:h-12 rounded" />
              </div>
              <div className="pt-1">
                <Skeleton className="w-full h-6 sm:h-9 rounded-lg sm:rounded-xl" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && !error && filteredCourses.length === 0 && (
        <Card className="text-center py-10 px-4 space-y-3 border-dashed border-[#E2E8F0] rounded-2xl bg-white">
          <PlayCircle className="w-10 h-10 sm:w-12 sm:h-12 text-[#CBD5E1] mx-auto" />
          <h3 className="text-sm sm:text-base font-bold text-[#111827]">
            {search
              ? `No courses match "${search}"`
              : activeTab === "enrolled"
              ? "You have not enrolled in any online courses yet"
              : "No courses found"}
          </h3>
          <p className="text-[11px] sm:text-xs text-[#64748B] max-w-sm mx-auto">
            {search
              ? "Try adjusting your search terms or explore all available programs."
              : "Browse the catalog to find interactive video courses to boost your skills."}
          </p>
          {activeTab === "enrolled" && (
            <div className="pt-2">
              <Button
                onClick={() => setActiveTab("all")}
                size="sm"
                className="bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold rounded-xl"
              >
                Browse All Online Courses
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* ── Course Cards Grid (Matching User Screenshot Layout) ── */}
      {!isLoading && !error && filteredCourses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
          {filteredCourses.map((course, idx) => {
            const isEnrolled = enrolledCourseIds.has(course.course_id);

            return (
              <motion.div key={course.course_id} {...fadeUp(idx * 0.03)} className="flex">
                <CourseCard
                  courseId={course.course_id}
                  courseCode={course.course_code}
                  courseName={course.course_name}
                  courseImgPath={course.course_img_path}
                  courseDuration={course.course_duration}
                  courseValidity={course.course_validity}
                  courseFee={course.course_fee}
                  courseType={course.course_type}
                  isEnrolled={isEnrolled}
                  href={`/student/online-courses/${course.course_id}`}
                  isOnline={true}
                />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
