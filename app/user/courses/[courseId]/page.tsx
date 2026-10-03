"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Award,
  CheckCircle2,
  Users,
  Calendar,
  Sparkles,
  Layers,
  ChevronRight,
  ShieldCheck,
  Download,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { getCourseById, type Course } from "@/lib/api";
import { useEnrollmentRoute } from "@/hooks/useEnrollmentRoute";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] as const },
});

export default function UserCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { getEnrollmentUrl } = useEnrollmentRoute();
  const resolvedParams = use(params);
  const courseId = resolvedParams.courseId;

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchCourse() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getCourseById(courseId);
        if (active) {
          if (res.success && res.data) {
            setCourse(res.data);
          } else {
            setError(res.message || "Course not found");
          }
        }
      } catch {
        if (active) setError("Failed to load course details.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    fetchCourse();
    return () => {
      active = false;
    };
  }, [courseId]);

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-8 h-8 text-[#5B21F4] animate-spin mb-3" />
        <p className="text-sm font-semibold text-[#64748B]">Loading course details...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="p-6 max-w-screen-md mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[#111827]">Course Not Found</h2>
        <p className="text-sm text-[#64748B]">{error || "The requested course could not be retrieved."}</p>
        <Link
          href="/user/courses"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5B21F4] text-white text-xs font-bold hover:bg-[#4C1BD4] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Courses
        </Link>
      </div>
    );
  }

  const modules = course.course_modules
    ? course.course_modules
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean)
    : [];

  const feeFormatted = `₹${Number(course.course_fee).toLocaleString("en-IN")}`;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-screen-xl mx-auto">
      {/* ── Breadcrumb & Navigation ── */}
      <motion.div {...fadeUp(0)} className="flex items-center gap-2 text-xs text-[#64748B]">
        <Link
          href="/user/courses"
          className="inline-flex items-center gap-1.5 font-semibold text-[#5B21F4] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Courses
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1]" />
        <span className="text-[#111827] font-bold truncate max-w-[200px] sm:max-w-none">
          {course.course_name}
        </span>
      </motion.div>

      {/* ── Hero Banner ── */}
      <motion.div
        {...fadeUp(0.05)}
        className="rounded-3xl p-6 sm:p-8 relative overflow-hidden text-white"
        style={{
          background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)",
        }}
      >
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#5B21F4] text-white shadow-sm">
              {course.course_code}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              {course.course_status === "active" ? "Active Enrollment" : course.course_status}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
            {course.course_name}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            {course.course_description ||
              "Master in-demand skills through comprehensive syllabus, practical coding assignments, and real-world project portfolios."}
          </p>

          {/* Quick specs */}
          <div className="pt-2 flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-slate-200">
            <div className="flex items-center gap-2 bg-white/10 px-3.5 py-1.5 rounded-xl backdrop-blur-sm">
              <Clock className="w-4 h-4 text-amber-300" />
              <span>Duration: {course.course_duration}</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-3.5 py-1.5 rounded-xl backdrop-blur-sm">
              <Layers className="w-4 h-4 text-cyan-300" />
              <span>{modules.length} Core Modules</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-3.5 py-1.5 rounded-xl backdrop-blur-sm">
              <Award className="w-4 h-4 text-emerald-300" />
              <span>Government Recognized Certificate</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Curriculum & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Curriculum breakdown */}
          <motion.div
            {...fadeUp(0.1)}
            className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#111827]">Curriculum &amp; Modules</h2>
                <p className="text-xs text-[#64748B]">Complete module breakdown for {course.course_code}</p>
              </div>
              <span className="text-xs font-bold text-[#5B21F4] bg-[#F1EEFF] px-2.5 py-1 rounded-lg">
                {modules.length} Topics
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {modules.map((mod, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white hover:border-[#5B21F4]/40 hover:shadow-sm transition-all group flex items-start gap-3"
                >
                  <div className="w-7 h-7 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center font-bold text-xs text-[#5B21F4] shrink-0 group-hover:bg-[#5B21F4] group-hover:text-white transition-colors">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#111827]">{mod}</h3>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      Theory concepts, hands-on lab sessions, and graded assessments
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Program Highlights */}
          <motion.div
            {...fadeUp(0.15)}
            className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-4"
          >
            <h2 className="text-lg font-bold text-[#111827]">What You Will Gain</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                "100% Practical & Industry-Oriented Training",
                "Dedicated Doubt Resolution & Mentor Support",
                "Capstone Project for Portfolio Building",
                "Official Certificate with QR Verification",
                "Access to Online Study Materials & Notes",
                "Mock Interviews & Career Guidance Sessions",
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs text-[#334155] font-medium">
                  <CheckCircle2 className="w-4 h-4 text-[#08A66A] shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right Column: Pricing & Enrollment Action */}
        <div className="space-y-6">
          <motion.div
            {...fadeUp(0.1)}
            className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm space-y-5 sticky top-6"
          >
            <div>
              <p className="text-xs uppercase font-bold tracking-wider text-[#94A3B8]">Total Fee</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold text-[#111827]">{feeFormatted}</span>
                <span className="text-xs text-[#64748B]">All inclusive</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
              <div className="flex justify-between text-[#64748B]">
                <span>Course Duration:</span>
                <span className="font-bold text-[#111827]">{course.course_duration}</span>
              </div>
              <div className="flex justify-between text-[#64748B]">
                <span>Status:</span>
                <span className="font-bold text-emerald-600 capitalize">{course.course_status}</span>
              </div>
              <div className="flex justify-between text-[#64748B]">
                <span>Batch Mode:</span>
                <span className="font-bold text-[#111827]">Offline / Classroom &amp; Lab</span>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <Link
                href={getEnrollmentUrl(course.course_id)}
                className="w-full py-3 rounded-xl text-white font-bold text-sm shadow-md shadow-[#5B21F4]/20 hover:shadow-lg hover:shadow-[#5B21F4]/30 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 text-center"
                style={{
                  background: "linear-gradient(135deg, #5B21F4 0%, #2563EB 100%)",
                }}
              >
                <Sparkles className="w-4 h-4" />
                <span>Enroll Now • Apply for Admission</span>
              </Link>

              <Link
                href="/user/courses"
                className="w-full py-2.5 rounded-xl border border-[#E2E8F0] hover:border-[#5B21F4] text-[#475569] hover:text-[#5B21F4] text-xs font-bold transition-all text-center block"
              >
                Back to Courses
              </Link>
            </div>

            <div className="pt-2 text-[11px] text-[#94A3B8] text-center leading-relaxed">
              Instant registration confirmation provided. Flexible installment payment options available at centre.
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
