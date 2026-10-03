"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  CreditCard,
  FileText,
  Activity,
  AlertCircle,
  ArrowRight,
  Download,
  Calendar,
  Award,
  ChevronRight,
  Play,
  BadgeCheck,
  CheckCircle2,
  Clock,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";
import { useStudent } from "@/hooks/useStudent";
import {
  getStudentEnrollments,
  getStudentFees,
  getStudentNotes,
  getStudentAttendance,
  recordAttendanceIn,
  recordAttendanceOut,
  EnrollmentItem,
  FeeTransactionItem,
  StudyNoteItem,
  AttendanceRecord,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] as const },
});

export default function StudentDashboardPage() {
  const { toast } = useToast();
  const {
    user_id,
    registration_number,
    name,
    role,
    isLoading: isStudentLoading,
    studentProfile,
  } = useStudent();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real API state
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [feeSummary, setFeeSummary] = useState<{
    total_fee: number;
    discount: number;
    total_paid: number;
    dues: number;
  } | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<FeeTransactionItem[]>([]);
  const [notes, setNotes] = useState<StudyNoteItem[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Attendance Punch State
  const [attendanceStatus, setAttendanceStatus] = useState<"in" | "out">("out");
  const [punchTime, setPunchTime] = useState<string | null>(null);
  const [punchLoading, setPunchLoading] = useState(false);

  const loadDashboardData = useCallback(async () => {
    if (!user_id) return;
    setLoading(true);
    setError(null);

    const safeRegNo = registration_number || (studentProfile?.st_regno);

    try {
      const promises: [
        Promise<any>,
        Promise<any>,
        Promise<any>,
        Promise<any>
      ] = [
        getStudentEnrollments(user_id),
        getStudentFees(user_id),
        getStudentNotes(user_id),
        safeRegNo ? getStudentAttendance(user_id, safeRegNo) : Promise.resolve({ success: true, data: [] }),
      ];

      const [enrRes, feeRes, notesRes, attRes] = await Promise.allSettled(promises);

      // 1. Process Enrollments
      if (enrRes.status === "fulfilled" && enrRes.value.success && enrRes.value.data) {
        let list: EnrollmentItem[] = [];
        if (Array.isArray(enrRes.value.data)) {
          list = enrRes.value.data;
        } else if ("enrollments" in enrRes.value.data && Array.isArray((enrRes.value.data as any).enrollments)) {
          list = (enrRes.value.data as any).enrollments;
        }
        setEnrollments(list);
      }
      // 2. Process Fee Ledger
      if (feeRes.status === "fulfilled" && feeRes.value.success && feeRes.value.data) {
        const txList: FeeTransactionItem[] = Array.isArray(feeRes.value.data)
          ? feeRes.value.data
          : feeRes.value.data.transactions || [];
        setRecentTransactions(txList.slice(0, 5));
        if (txList.length > 0 && txList[0].summary) {
          setFeeSummary(txList[0].summary);
        } else if (txList.length > 0) {
          // Calculate summary if not explicitly returned in root
          const totalPaid = txList.reduce((acc, t) => acc + Number(t.amount || 0), 0);
          setFeeSummary({
            total_fee: totalPaid,
            discount: 0,
            total_paid: totalPaid,
            dues: 0,
          });
        }
      }

      // 3. Process Study Notes
      if (notesRes.status === "fulfilled" && notesRes.value.success && notesRes.value.data) {
        let nList: StudyNoteItem[] = [];
        if (Array.isArray(notesRes.value.data)) {
          nList = notesRes.value.data;
        } else if ("notes" in notesRes.value.data && Array.isArray((notesRes.value.data as any).notes)) {
          nList = (notesRes.value.data as any).notes;
        }
        setNotes(nList);
      }

      // 4. Process Attendance
      if (attRes.status === "fulfilled" && attRes.value.success && attRes.value.data) {
        let aList: AttendanceRecord[] = [];
        if (Array.isArray(attRes.value.data)) {
          aList = attRes.value.data;
        } else if ("records" in attRes.value.data && Array.isArray((attRes.value.data as any).records)) {
          aList = (attRes.value.data as any).records;
        }
        setAttendanceRecords(aList);

        // Check today's punch status
        const todayStr = new Date().toISOString().split("T")[0];
        const todayRecord = aList.find((r) => r.date?.startsWith(todayStr));
        if (todayRecord) {
          if (todayRecord.timein && !todayRecord.timeout) {
            setAttendanceStatus("in");
            setPunchTime(todayRecord.timein);
          } else if (todayRecord.timeout) {
            setAttendanceStatus("out");
            setPunchTime(todayRecord.timeout);
          }
        }
      }
    } catch {
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user_id, registration_number, studentProfile]);

  useEffect(() => {
    if (!isStudentLoading && user_id) {
      loadDashboardData();
    } else if (!isStudentLoading && !user_id) {
      setLoading(false);
    }
  }, [user_id, isStudentLoading, loadDashboardData]);

  // Attendance Punch Action
  const handleAttendancePunch = async () => {
    if (!user_id) return;
    const safeRegNo = registration_number || studentProfile?.st_regno;
    if (!safeRegNo) {
      toast({
        variant: "error",
        title: "Registration Required",
        description: "Student registration number not found.",
      });
      return;
    }

    setPunchLoading(true);
    try {
      if (attendanceStatus === "out") {
        const res = await recordAttendanceIn(user_id, safeRegNo);
        if (res.success) {
          setAttendanceStatus("in");
          const timeStr = res.data?.timein || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          setPunchTime(timeStr);
          toast({
            variant: "success",
            title: "Checked In Successfully",
            description: `Biometric attendance recorded at ${timeStr}. Status: Active`,
          });
          loadDashboardData();
        } else {
          toast({
            variant: "error",
            title: "Check-in Error",
            description: res.message || "Could not record biometric check-in.",
          });
        }
      } else {
        const res = await recordAttendanceOut(user_id, safeRegNo);
        if (res.success) {
          setAttendanceStatus("out");
          const timeStr = res.data?.timeout || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          setPunchTime(timeStr);
          toast({
            variant: "info",
            title: "Checked Out Successfully",
            description: `Check-out recorded at ${timeStr}. Have a great evening!`,
          });
          loadDashboardData();
        } else {
          toast({
            variant: "error",
            title: "Check-out Error",
            description: res.message || "Could not record biometric check-out.",
          });
        }
      }
    } catch {
      toast({
        variant: "error",
        title: "Attendance Error",
        description: "Network error connecting to biometric attendance server.",
      });
    } finally {
      setPunchLoading(false);
    }
  };

  // Compute calculated metrics
  const totalCoursesCount = Array.isArray(enrollments) ? enrollments.length : 0;
  const totalDuesAmount =
    (feeSummary as any)?.stc_dues ??
    feeSummary?.dues ??
    (Array.isArray(enrollments)
      ? enrollments.reduce((acc, e) => acc + Number((e as any).stc_dues ?? e.dues ?? 0), 0)
      : 0);
  const totalNotesCount = Array.isArray(notes) ? notes.length : 0;
  const attendanceRate =
    Array.isArray(attendanceRecords) && attendanceRecords.length > 0
      ? `${Math.round((attendanceRecords.filter((r) => r.status === 1).length / attendanceRecords.length) * 100)}%`
      : "100%";

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-screen-xl mx-auto">
      {/* ══════════════════════════════════════════════ */}
      {/* WELCOME BANNER                                 */}
      {/* ══════════════════════════════════════════════ */}
      <motion.div {...fadeUp(0)}>
        <div
          className="relative overflow-hidden rounded-2xl p-5 md:p-7 shadow-lg"
          style={{ background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)" }}
        >
          {/* Decorative shapes */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute top-5 right-20 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-8 left-1/3 w-32 h-32 rounded-full bg-black/10 pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-white/70">
                  {new Date().toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                {registration_number && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-white font-mono font-bold tracking-wide">
                    {registration_number}
                  </span>
                )}
              </div>
              <h2 className="text-xl md:text-2xl font-extrabold text-white leading-tight">
                Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"},{" "}
                {name || "Student"}! 👋
              </h2>
              <p className="mt-1 text-sm text-white/75">
                Role: <span className="font-bold text-white capitalize">{role || "Student"}</span>
                {studentProfile?.centre_name && ` · Centre: ${studentProfile.centre_name}`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Daily Attendance Punch Action */}
              <button
                type="button"
                onClick={handleAttendancePunch}
                disabled={punchLoading}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer ${
                  attendanceStatus === "in"
                    ? "bg-[#ECFDF5] text-[#08A66A] border border-[#A7F3D0] hover:bg-[#D1FAE5]"
                    : "bg-white text-[#5B21F4] hover:bg-white/95"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${attendanceStatus === "in" ? "bg-[#08A66A] animate-pulse" : "bg-[#EF4444]"}`} />
                <span>
                  {punchLoading
                    ? "Processing..."
                    : attendanceStatus === "in"
                    ? `Checked In (${punchTime || "Active"})`
                    : "Check-in (Punch In)"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Error Banner ── */}
      {!loading && error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3 text-red-700 text-xs font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadDashboardData}
            className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* REAL STATS GRID                                */}
      {/* ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Stat 1: Active Courses */}
        <motion.div {...fadeUp(0.05)}>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] hover:border-[#DDD6FE] hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-[#F1EEFF] border-[#DDD6FE] text-[#5B21F4]">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F1EEFF] text-[#5B21F4]">
                Enrolled
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-2" />
            ) : (
              <p className="text-2xl font-extrabold text-[#111827] leading-none">
                {totalCoursesCount}
              </p>
            )}
            <p className="text-xs font-semibold text-[#111827] mt-1">Active Courses</p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              {totalCoursesCount === 1 ? "1 Program" : `${totalCoursesCount} Programs enrolled`}
            </p>
          </div>
        </motion.div>

        {/* Stat 2: Fee Balance / Dues */}
        <motion.div {...fadeUp(0.1)}>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] hover:border-[#DDD6FE] hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                totalDuesAmount > 0
                  ? "bg-[#FFFBEB] border-[#FEF3C7] text-[#F59E0B]"
                  : "bg-[#ECFDF5] border-[#D1FAE5] text-[#08A66A]"
              }`}>
                <CreditCard className="w-5 h-5" />
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                totalDuesAmount > 0
                  ? "bg-[#FFFBEB] text-[#F59E0B]"
                  : "bg-[#ECFDF5] text-[#08A66A]"
              }`}>
                {totalDuesAmount > 0 ? "Dues Pending" : "Clear"}
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24 mb-2" />
            ) : (
              <p className="text-2xl font-extrabold text-[#111827] leading-none">
                ₹{totalDuesAmount.toLocaleString("en-IN")}
              </p>
            )}
            <p className="text-xs font-semibold text-[#111827] mt-1">Fee Status</p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              {feeSummary ? `Paid: ₹${feeSummary.total_paid.toLocaleString("en-IN")}` : "Direct from fee ledger"}
            </p>
          </div>
        </motion.div>

        {/* Stat 3: Study Notes */}
        <motion.div {...fadeUp(0.15)}>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] hover:border-[#DDD6FE] hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-[#EFF6FF] border-[#DBEAFE] text-[#2563EB]">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB]">
                Repository
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-2" />
            ) : (
              <p className="text-2xl font-extrabold text-[#111827] leading-none">
                {totalNotesCount}
              </p>
            )}
            <p className="text-xs font-semibold text-[#111827] mt-1">Study Notes</p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              {totalNotesCount === 1 ? "1 Note document" : `${totalNotesCount} Available notes`}
            </p>
          </div>
        </motion.div>

        {/* Stat 4: Attendance Log */}
        <motion.div {...fadeUp(0.2)}>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] hover:border-[#DDD6FE] hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-[#ECFDF5] border-[#D1FAE5] text-[#08A66A]">
                <Activity className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#08A66A]">
                {attendanceStatus === "in" ? "Present" : "Checked Out"}
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-2" />
            ) : (
              <p className="text-2xl font-extrabold text-[#111827] leading-none">
                {attendanceRate}
              </p>
            )}
            <p className="text-xs font-semibold text-[#111827] mt-1">Attendance</p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              {attendanceRecords.length} Session records
            </p>
          </div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* MAIN TWO-COLUMN CONTENT                        */}
      {/* ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Enrolled Courses */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-[#111827] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#5B21F4]" />
              My Enrolled Courses
            </h3>
            <Link
              href="/student/courses"
              className="text-xs font-bold text-[#5B21F4] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ))}
            </div>
          ) : enrollments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-[#94A3B8] mx-auto" />
              <p className="text-sm font-bold text-[#111827]">No courses enrolled yet.</p>
              <p className="text-xs text-[#64748B]">Enroll in a course from our catalog to get started.</p>
              <Link
                href="/user/courses"
                className="inline-block px-4 py-2 bg-[#5B21F4] text-white text-xs font-bold rounded-xl hover:bg-[#4C1BD4] transition-colors"
              >
                Browse Courses
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {enrollments.slice(0, 3).map((course) => {
                const duesVal = Number((course as any).stc_dues ?? course.dues ?? 0);
                const feeVal = Number((course as any).stc_total_fee ?? course.total_fee ?? 0);
                const discVal = Number((course as any).stc_discount ?? course.discount ?? 0);
                const initVal = Number((course as any).stc_initial_payment ?? course.initial_payment ?? 0);
                const paidVal =
                  (course as any).total_paid !== undefined
                    ? Number((course as any).total_paid)
                    : Math.max(initVal, feeVal - discVal - duesVal);

                return (
                  <div
                    key={course.stc_id}
                    className="bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#DDD6FE] hover:shadow-md transition-all p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {course.course_code && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F1EEFF] text-[#5B21F4]">
                            {course.course_code}
                          </span>
                        )}
                        <h4 className="text-sm font-bold text-[#111827]">
                          {course.course_name || `Course #${course.course_id}`}
                        </h4>
                      </div>
                      <p className="text-xs text-[#64748B]">
                        Batch: <span className="font-semibold text-[#111827]">{(course as any).batch_name || "General Batch"}</span> · Enrollment ID: #{course.stc_id}
                      </p>
                      <div className="flex items-center gap-3 text-xs pt-1">
                        <span className="text-[#64748B]">Fee: ₹{feeVal.toLocaleString("en-IN")}</span>
                        <span>&bull;</span>
                        <span className="text-emerald-700 font-semibold">Paid: ₹{paidVal.toLocaleString("en-IN")}</span>
                        <span>&bull;</span>
                        <span className={duesVal > 0 ? "text-amber-700 font-bold" : "text-emerald-700 font-bold"}>
                          {duesVal > 0 ? `Due: ₹${duesVal.toLocaleString("en-IN")}` : "Paid in Full"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/student/courses/${course.course_id}`}
                        className="px-3.5 py-2 rounded-xl bg-[#5B21F4] text-white text-xs font-bold hover:bg-[#4C1BD4] transition-all flex items-center gap-1.5"
                      >
                        <span>Syllabus</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Action Navigation Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            {[
              { label: "My Notes", icon: FileText, href: "/student/notes", color: "#5B21F4", bg: "#F1EEFF" },
              { label: "Fee Details", icon: CreditCard, href: "/student/fees", color: "#08A66A", bg: "#ECFDF5" },
              { label: "Receipts", icon: Download, href: "/student/payments", color: "#2563EB", bg: "#EFF6FF" },
              { label: "Documents", icon: FolderOpen, href: "/student/documents", color: "#EA580C", bg: "#FFF7ED" },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="p-3 bg-white rounded-xl border border-[#E2E8F0] hover:border-[#DDD6FE] hover:shadow-sm transition-all flex flex-col items-center text-center gap-2 group"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{ backgroundColor: action.bg, color: action.color }}
                >
                  <action.icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-[#111827]">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Right Column (1 Col): Recent Payments & Attendance Feed */}
        <div className="space-y-6">
          {/* Recent Payments Card */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#08A66A]" />
                Recent Fee Payments
              </h3>
              <Link
                href="/student/payments"
                className="text-[11px] font-bold text-[#5B21F4] hover:underline"
              >
                Ledger &rarr;
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="py-6 text-center text-[#64748B] text-xs">
                No payment transactions recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-[#F1F5F9] space-y-2">
                {recentTransactions.map((tx) => (
                  <div key={tx.transaction_id} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-[#111827]">₹{Number(tx.amount || 0).toLocaleString("en-IN")}</p>
                      <p className="text-[10px] text-[#64748B] uppercase">{tx.mode} · {tx.date?.split(" ")[0]}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Verified
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Biometric Attendance Log Card */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#5B21F4]" />
                Attendance Logs
              </h3>
              <span className="text-[10px] font-bold text-[#08A66A] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                Active System
              </span>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-xl" />
                ))}
              </div>
            ) : attendanceRecords.length === 0 ? (
              <div className="py-4 text-center text-[#64748B] text-xs">
                No attendance logs found for {registration_number || "student"}.
              </div>
            ) : (
              <div className="space-y-2">
                {attendanceRecords.slice(0, 4).map((rec) => (
                  <div
                    key={rec.attendance_id}
                    className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                      <div>
                        <p className="font-bold text-[#111827]">{rec.date}</p>
                        <p className="text-[10px] text-[#64748B]">
                          In: {rec.timein} {rec.timeout ? `· Out: ${rec.timeout}` : "· In Session"}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      rec.status === 1 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {rec.status === 1 ? "Present" : "Logged"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
