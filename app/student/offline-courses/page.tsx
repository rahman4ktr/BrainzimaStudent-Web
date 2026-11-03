"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Search,
  Clock,
  Layers,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  Award,
  Sparkles,
  Info,
} from "lucide-react";
import Link from "next/link";
import {
  getCourses,
  getCurrentStudent,
  type Course,
  type EnrollmentItem,
} from "@/lib/api";
import { useEnrollmentRoute } from "@/hooks/useEnrollmentRoute";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  DCA: {
    color: "#0284C7",
    bg: "#F0F9FF",
    border: "#BAE6FD",
    tag: "Certificate",
    tagColor: "#0284C7",
    tagBg: "#F0F9FF",
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
  DEFAULT: {
    color: "#4F46E5",
    bg: "#EEF2FF",
    border: "#C7D2FE",
    tag: "Program",
    tagColor: "#4F46E5",
    tagBg: "#EEF2FF",
  },
};

function getTheme(code?: string) {
  if (!code) return COURSE_THEMES.DEFAULT;
  const upper = code.toUpperCase();
  for (const [key, theme] of Object.entries(COURSE_THEMES)) {
    if (upper.includes(key)) return theme;
  }
  return COURSE_THEMES.DEFAULT;
}

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function StudentOfflineCoursesPage() {
  const { getEnrollmentUrl } = useEnrollmentRoute();
  const { user_id } = useStudent();

  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "enrolled" | "available">("all");
  const [selectedCourseForDetails, setSelectedCourseForDetails] = useState<Course | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch all offline courses from /api/course
      const res = await getCourses();
      if (!res.success || !res.data) {
        throw new Error(res.message || "Failed to load offline courses.");
      }

      let list: Course[] = [];
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if ("courses" in res.data && Array.isArray((res.data as any).courses)) {
        list = (res.data as any).courses;
      }
      setCourses(list);

      // 2. Fetch student's profile to identify enrolled offline courses
      const enrolledSet = new Set<number>();
      if (user_id) {
        try {
          const studentRes = await getCurrentStudent(user_id);
          if (studentRes.success && studentRes.data) {
            const off = studentRes.data.offline_courses;
            if (Array.isArray(off)) {
              off.forEach((c: any) => {
                const cId = Number(c.stc_course_id ?? c.course_id);
                if (cId) enrolledSet.add(cId);
              });
            }
          }
        } catch (stErr) {
          console.warn("[StudentOfflineCourses] Profile enrollment check warning:", stErr);
        }
      }
      setEnrolledCourseIds(enrolledSet);
    } catch (err: any) {
      console.error("[StudentOfflineCourses] Load error:", err);
      setError(err?.message || "Failed to load offline courses.");
    } finally {
      setIsLoading(false);
    }
  }, [user_id]);

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
      (course.course_description && course.course_description.toLowerCase().includes(q)) ||
      (course.course_duration && course.course_duration.toLowerCase().includes(q))
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
            <span className="w-2 h-2 rounded-full bg-[#08A66A] animate-pulse" />
            <span className="text-[10px] sm:text-xs font-bold text-[#08A66A] uppercase tracking-wider">
              Classroom &amp; Campus Curriculum
            </span>
          </div>
          <h1 className="text-lg sm:text-2xl lg:text-3xl font-black text-[#111827] tracking-tight">
            Offline Courses &amp; Diplomas
          </h1>
          <p className="text-[11px] sm:text-sm text-[#64748B] mt-0.5">
            Classroom courses with practical labs, expert instructor guidance, and recognized diplomas.
          </p>
        </div>

        {/* Global Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
          <input
            type="text"
            placeholder="Search offline diplomas..."
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
              <span>All Diplomas</span>
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

      {/* ── Loading Skeletons (Strictly 2 columns on mobile) ── */}
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
          <GraduationCap className="w-10 h-10 sm:w-12 sm:h-12 text-[#CBD5E1] mx-auto" />
          <h3 className="text-sm sm:text-base font-bold text-[#111827]">
            {search
              ? `No offline courses match "${search}"`
              : activeTab === "enrolled"
              ? "You have not enrolled in any offline courses yet"
              : "No offline courses available"}
          </h3>
          <p className="text-[11px] sm:text-xs text-[#64748B] max-w-sm mx-auto">
            {search
              ? "Try adjusting your search terms or view all classroom diploma programs."
              : "Explore our academic offerings and talk to your study centre for admission."}
          </p>
          {activeTab === "enrolled" && (
            <div className="pt-2">
              <Button
                onClick={() => setActiveTab("all")}
                size="sm"
                className="bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold rounded-xl"
              >
                Browse All Offline Courses
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* ── Courses Grid ── */}
      {!isLoading && !error && filteredCourses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
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
                  courseValidity={course.course_duration ? `${course.course_duration} Program` : "Regular Program"}
                  courseFee={course.course_fee}
                  courseType="Classroom"
                  isEnrolled={isEnrolled}
                  isOnline={false}
                  href={`/student/courses/${course.course_id}`}
                />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
