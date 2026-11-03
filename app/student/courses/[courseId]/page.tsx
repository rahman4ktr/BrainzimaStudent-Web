"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Layers,
  ChevronRight,
  CheckCircle2,
  FileText,
  AlertCircle,
  Loader2,
  Award,
  Sparkles,
  CreditCard,
  GraduationCap,
  ShieldCheck,
  Languages,
  Building2,
  ArrowRight,
} from "lucide-react";
import { getCourseById, getCurrentStudent, getStudentEnrollments, type Course, type EnrollmentItem } from "@/lib/api";
import { getCourseImageUrl, getSession } from "@/lib/session";
import { useStudent } from "@/hooks/useStudent";
import { useEnrollmentRoute } from "@/hooks/useEnrollmentRoute";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] as const },
});

export default function StudentCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.courseId;
  const { getEnrollmentUrl } = useEnrollmentRoute();
  const { user_id, student_id } = useStudent();

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [matchingEnrollment, setMatchingEnrollment] = useState<EnrollmentItem | null>(null);

  useEffect(() => {
    let active = true;
    async function loadCourse() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getCourseById(courseId);
        if (active) {
          if (res.success && res.data) {
            setCourse(res.data);
          } else {
            setError(res.message || "Course details not found.");
          }
        }
      } catch {
        if (active) setError("Failed to fetch course details from server.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadCourse();
    return () => {
      active = false;
    };
  }, [courseId]);

  // Check if current authenticated student is enrolled in this offline course
  useEffect(() => {
    let active = true;

    async function checkEnrollment() {
      const session = getSession();
      const currentUserId = user_id || (session?.user_id ? Number(session.user_id) : 0);
      const currentStudentId = student_id || (session?.student_id ? Number(session.student_id) : 0);

      if (!currentUserId && !currentStudentId) {
        if (active) setIsEnrolled(false);
        return;
      }

      try {
        const [meRes, enrRes] = await Promise.allSettled([
          currentUserId ? getCurrentStudent(currentUserId) : Promise.resolve(null),
          currentUserId ? getStudentEnrollments(currentUserId, currentStudentId, "student") : Promise.resolve(null),
        ]);

        const allCandidates: any[] = [];

        if (meRes.status === "fulfilled" && meRes.value?.success && meRes.value?.data) {
          const d = meRes.value.data;
          if (Array.isArray(d.offline_courses)) allCandidates.push(...d.offline_courses);
          if (Array.isArray(d.courses)) allCandidates.push(...d.courses);
          if (Array.isArray(d.enrolled_courses)) allCandidates.push(...d.enrolled_courses);
        }

        if (enrRes.status === "fulfilled" && enrRes.value?.success && enrRes.value?.data) {
          const d = enrRes.value.data;
          const list = Array.isArray(d) ? d : (d as any).enrollments || [];
          if (Array.isArray(list)) allCandidates.push(...list);
        }

        const match = allCandidates.find(
          (e: any) =>
            Number(e.course_id ?? e.stc_course_id) === Number(courseId) ||
            (course?.course_code &&
              String(e.course_code || "").trim().toLowerCase() === String(course.course_code).trim().toLowerCase())
        );

        if (active) {
          if (match) {
            setIsEnrolled(true);
            setMatchingEnrollment(match);
          } else {
            setIsEnrolled(false);
            setMatchingEnrollment(null);
          }
        }
      } catch (err) {
        console.warn("[StudentCourseDetail] Enrollment check notice:", err);
      }
    }

    checkEnrollment();
    return () => {
      active = false;
    };
  }, [courseId, user_id, student_id, course?.course_code]);

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-8 h-8 text-[#0B3B82] animate-spin mb-3" />
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
        <p className="text-sm text-[#64748B]">{error || "Could not retrieve course record."}</p>
        <Link
          href="/student/courses"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B3B82] text-white text-xs font-bold hover:bg-[#072B60] transition-colors"
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

  const feeNum = Number(course.course_fee || 0);
  const originalFee = feeNum > 0 ? Math.round((feeNum * 1.35) / 100) * 100 : 0;
  const discountPercent = originalFee > 0 ? Math.round(((originalFee - feeNum) / originalFee) * 100) : 0;
  const resolvedImageUrl = getCourseImageUrl(course.course_img_path);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-screen-2xl mx-auto">
      {/* ── Breadcrumb Navigation ── */}
      <motion.div {...fadeUp(0)} className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-[#64748B]">
          <Link
            href="/student/offline-courses"
            className="inline-flex items-center gap-1.5 font-bold text-[#0B3B82] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Offline Courses</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1]" />
          <span className="text-[#111827] font-semibold truncate max-w-[200px] sm:max-w-none">
            {course.course_name}
          </span>
        </div>

        {/* Enrollment Status Badge */}
        {isEnrolled && (
          <Badge
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700 text-xs py-1 px-3 gap-1.5 shadow-xs text-white font-bold"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Enrolled &amp; Active</span>
          </Badge>
        )}
      </motion.div>

      {/* Main Top Header: "Description" */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
          Description
        </h1>
      </div>

      {/* ── Main 2-Column Grid (Khan Global Studies UX) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Description + Syllabus Modules */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. Description Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-2xs space-y-5">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                {course.course_name} – Build Strong Basics &amp; Hands-on Mastery
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-2.5">
                {course.course_description ||
                  `The ${course.course_name} is specially designed for students seeking in-depth practical training and recognized diploma certification. This course focuses on building a strong foundation using modern labs and industry standards.`}
              </p>
            </div>

            <div className="pt-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 underline underline-offset-4 decoration-slate-300">
                About the Course :
              </h3>
              <div className="mt-2.5 space-y-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                <p>
                  Brainzima Institute brings you an intensive classroom curriculum to help you achieve practical proficiency in {course.course_name}.
                </p>
                <p>
                  Classes are conducted by experienced faculty with interactive lab sessions, continuous practical assessments, and personalized mentor guidance.
                </p>
              </div>
            </div>

            <div className="pt-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 underline underline-offset-4 decoration-slate-300">
                Key Features :
              </h3>
              <ul className="mt-3 space-y-2.5 text-xs sm:text-sm text-slate-600">
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                  <span>Interactive classroom lectures with dedicated computer lab practicals.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                  <span>Real-world project assignments and mock evaluation tests.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                  <span>Structured curriculum with comprehensive printed &amp; digital study materials.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                  <span>Regular doubt sessions and one-on-one lab guidance by expert faculty.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                  <span>Recognized academic diploma / certificate with QR verification upon completion.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 2. Syllabus Modules */}
          {modules.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#0B3B82]" />
                  <h3 className="text-base font-black text-slate-900">
                    Syllabus Modules ({modules.length} Core Topics)
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {modules.map((mod, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-start gap-3"
                  >
                    <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-xs text-[#0B3B82] shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900">{mod}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Practical lab &amp; theory</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Learning Resources Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/student/materials"
              className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all flex items-center justify-between shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0B3B82] flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Study Materials</h4>
                  <p className="text-[11px] text-slate-500">Curated reference slides</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              href="/student/fees"
              className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all flex items-center justify-between shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Fee Ledger</h4>
                  <p className="text-[11px] text-slate-500">Track installments &amp; receipts</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>
        </div>

        {/* Right Column (4 cols): Sticky Khan Global Studies Card */}
        <div className="lg:col-span-4 sticky top-6 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs group">
            {/* Banner Image */}
            <div className="relative aspect-[16/9] w-full bg-slate-950 overflow-hidden shrink-0">
              {resolvedImageUrl && !imageError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolvedImageUrl}
                  alt={course.course_name}
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div
                  className="w-full h-full flex flex-col items-center justify-center p-4 text-white text-center relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, #1E1B4B 0%, #1E3A8A 100%)",
                  }}
                >
                  <GraduationCap className="w-10 h-10 text-white mb-1" />
                  <span className="text-[10px] font-mono text-blue-200 uppercase tracking-wider">
                    {course.course_code || "DIPLOMA"}
                  </span>
                  <p className="text-xs font-black text-white line-clamp-1 max-w-[85%] mt-0.5">
                    {course.course_name}
                  </p>
                </div>
              )}

              {/* Classroom Badge */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-600/95 backdrop-blur-sm text-white font-extrabold text-[10px] sm:text-[11px] shadow-sm tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>Classroom</span>
              </div>

              {/* Enrolled Badge if already enrolled */}
              {isEnrolled && (
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600/95 backdrop-blur-sm text-white font-extrabold text-[10px] shadow-sm">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Enrolled</span>
                </div>
              )}
            </div>

            {/* Card Body */}
            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug line-clamp-2">
                  {course.course_name}
                </h3>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  REGISTRATION FEE
                </span>
                <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-black text-[#0B3B82]">
                    ₹{feeNum.toLocaleString("en-IN")}/-
                  </span>
                  {originalFee > feeNum && (
                    <span className="text-sm text-slate-400 line-through">
                      ₹{originalFee.toLocaleString("en-IN")}/-
                    </span>
                  )}
                  {discountPercent > 0 && (
                    <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      SAVE {discountPercent}%
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2.5 text-xs text-slate-700">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Validity - {course.course_duration || "12 Months"}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Type - Classroom &amp; Computer Labs</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Duration - {course.course_duration || "Regular Batch"}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Languages className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Language - English &amp; Hindi</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Award className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Certificate - Verified Academic Diploma</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                {isEnrolled ? (
                  <div className="w-full h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold text-sm flex items-center justify-center gap-2 shadow-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Enrolled &amp; Active</span>
                  </div>
                ) : (
                  <Link href={getEnrollmentUrl(course.course_id)} className="block w-full">
                    <Button className="w-full h-11 rounded-xl text-sm font-black bg-[#0B3B82] hover:bg-[#072B60] text-white shadow-md cursor-pointer flex items-center justify-center gap-2">
                      <span>Enroll Now</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                )}

                <Link href="/student/fees" className="block w-full">
                  <Button
                    variant="outline"
                    className="w-full h-9 rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    View Fee Ledger
                  </Button>
                </Link>

                <Link href="/student/materials" className="block w-full">
                  <Button
                    variant="outline"
                    className="w-full h-9 rounded-xl text-xs font-bold border-[#DDD6FE] text-[#5B21F4] bg-[#F1EEFF] hover:bg-[#E9E4FF] cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Access Study Materials</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
