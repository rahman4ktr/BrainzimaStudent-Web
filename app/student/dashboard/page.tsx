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
  Sparkles,
  PlayCircle,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";
import { useStudent } from "@/hooks/useStudent";
import { getInitials, getCourseImageUrl } from "@/lib/session";
import CourseThumbnail from "@/components/courses/CourseThumbnail";
import {
  getCurrentStudent,
  getStudentOnlineCourses,
  getStudentFees,
  getStudentNotes,
  getStudentAttendance,
  recordAttendanceIn,
  recordAttendanceOut,
  EnrollmentItem,
  OnlineEnrolledCourse,
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
    user_image,
    docs_st_image,
    dob,
    st_dob,
    isBirthday,
    isLoading: isStudentLoading,
    studentProfile,
  } = useStudent();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Birthday celebration test toggle & confetti state
  const [testBirthdayMode, setTestBirthdayMode] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("birthday") === "1" || sp.get("birthday") === "true") {
        setTestBirthdayMode(true);
      }
    }
  }, []);

  const showBirthdayCelebration = Boolean(isBirthday || testBirthdayMode);

  useEffect(() => {
    if (showBirthdayCelebration) {
      setConfettiActive(true);
      const timer = setTimeout(() => setConfettiActive(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showBirthdayCelebration]);

  const triggerConfetti = () => {
    setConfettiActive(true);
    setTimeout(() => setConfettiActive(false), 4500);
  };

  // Real API state
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [onlineCourses, setOnlineCourses] = useState<OnlineEnrolledCourse[]>([]);
  const [coursesTab, setCoursesTab] = useState<"enrolled" | "offline" | "online">("enrolled");
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
        Promise<any>,
        Promise<any>
      ] = [
          getCurrentStudent(user_id),
          getStudentFees(user_id),
          getStudentNotes(user_id),
          safeRegNo ? getStudentAttendance(user_id, safeRegNo) : Promise.resolve({ success: true, data: [] }),
          getStudentOnlineCourses(user_id, (role as any) || "student"),
        ];

      const [stMeRes, feeRes, notesRes, attRes, onlRes] = await Promise.allSettled(promises);

      // 1. Process Offline Enrollments STRICTLY from offline_courses
      // RULE: OFFLINE courses MUST come ONLY from offline_courses.
      // If offline_courses = [], DO NOT render any offline course card.
      // Do NOT use courses, enrolled_courses, or fallbacks to create offline courses.
      let offlineList: EnrollmentItem[] = [];
      if (stMeRes.status === "fulfilled" && stMeRes.value?.success && stMeRes.value?.data) {
        const pData = stMeRes.value.data;
        if (Array.isArray(pData.offline_courses)) {
          offlineList = pData.offline_courses.map((c: any) => ({
            ...c,
            course_format: "offline" as const,
          }));
        }
      } else if (studentProfile?.offline_courses && Array.isArray(studentProfile.offline_courses)) {
        offlineList = studentProfile.offline_courses.map((c: any) => ({
          ...c,
          course_format: "offline" as const,
        }));
      }
      setEnrollments(offlineList);

      // 2. Process Online Courses STRICTLY from online_courses
      // RULE: ONLINE courses MUST come ONLY from online_courses and their online enrollment fields.
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
      if (onlineMap.size === 0 && studentProfile?.online_courses && Array.isArray(studentProfile.online_courses)) {
        studentProfile.online_courses.forEach((c) => {
          onlineMap.set(`online:${c.course_id}`, {
            ...c,
            course_format: "online" as const,
          });
        });
      }
      setOnlineCourses(Array.from(onlineMap.values()));

      // 3. Process Fee Ledger
      if (feeRes.status === "fulfilled" && feeRes.value.success && feeRes.value.data) {
        const txList: FeeTransactionItem[] = Array.isArray(feeRes.value.data)
          ? feeRes.value.data
          : feeRes.value.data.transactions || [];
        setRecentTransactions(txList.slice(0, 5));
        if (feeRes.value.data.summary) {
          setFeeSummary(feeRes.value.data.summary);
        } else if (txList.length > 0 && txList[0].summary) {
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

      // 4. Process Study Notes
      if (notesRes.status === "fulfilled" && notesRes.value.success && notesRes.value.data) {
        let nList: StudyNoteItem[] = [];
        if (Array.isArray(notesRes.value.data)) {
          nList = notesRes.value.data;
        } else if ("notes" in notesRes.value.data && Array.isArray((notesRes.value.data as any).notes)) {
          nList = (notesRes.value.data as any).notes;
        }
        setNotes(nList);
      }

      // 5. Process Attendance
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
  }, [user_id, registration_number, studentProfile, role]);

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
  const totalCoursesCount =
    (Array.isArray(enrollments) ? enrollments.length : 0) +
    (Array.isArray(onlineCourses) ? onlineCourses.length : 0);

  const totalFeeAmount =
    feeSummary?.total_fee ??
    (Array.isArray(enrollments)
      ? enrollments.reduce((acc, e) => acc + Number((e as any).stc_total_fee ?? e.total_fee ?? 0), 0)
      : 0);

  const totalDiscountAmount =
    (feeSummary as any)?.discount ??
    (Array.isArray(enrollments)
      ? enrollments.reduce((acc, e) => acc + Number((e as any).stc_discount ?? e.discount ?? 0), 0)
      : 0);

  const totalPaidAmount =
    (feeSummary as any)?.total_successful_paid ??
    feeSummary?.total_paid ??
    (recentTransactions.length > 0
      ? recentTransactions.reduce((acc, t) => acc + (Number(t.amount ?? t.tr_amount ?? 0) || 0), 0)
      : Array.isArray(enrollments)
        ? enrollments.reduce((acc, e) => {
          const duesVal = Number((e as any).stc_dues ?? e.dues ?? 0);
          const feeVal = Number((e as any).stc_total_fee ?? e.total_fee ?? 0);
          const discVal = Number((e as any).stc_discount ?? e.discount ?? 0);
          const initVal = Number((e as any).stc_initial_payment ?? e.initial_payment ?? 0);
          return (
            acc +
            ((e as any).total_paid !== undefined
              ? Number((e as any).total_paid)
              : Math.max(initVal, feeVal - discVal - duesVal))
          );
        }, 0)
        : 0);

  const rawDuesAmount =
    (feeSummary as any)?.stc_dues ??
    feeSummary?.dues ??
    (Array.isArray(enrollments)
      ? enrollments.reduce((acc, e) => acc + Number((e as any).stc_dues ?? e.dues ?? 0), 0)
      : 0);

  const computedTotalDues = Math.max(0, (totalFeeAmount - totalDiscountAmount) - totalPaidAmount);
  const totalDuesAmount = Math.min(Number(rawDuesAmount) || computedTotalDues, computedTotalDues);

  const totalNotesCount = Array.isArray(notes) ? notes.length : 0;
  const attendanceRate =
    Array.isArray(attendanceRecords) && attendanceRecords.length > 0
      ? `${Math.round((attendanceRecords.filter((r) => r.status === 1).length / attendanceRecords.length) * 100)}%`
      : "100%";

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-screen-xl mx-auto">
      {/* ══════════════════════════════════════════════ */}
      {/* WELCOME BANNER / SPECIAL BIRTHDAY CELEBRATION  */}
      {/* ══════════════════════════════════════════════ */}
      <motion.div {...fadeUp(0)}>
        {showBirthdayCelebration ? (
          <div
            className="relative overflow-hidden rounded-2xl md:rounded-3xl p-5 sm:p-7 md:p-8 shadow-2xl border-2 border-amber-400/50 transition-all"
            style={{
              background:
                "linear-gradient(135deg, #1E1B4B 0%, #3B0764 25%, #581C87 50%, #701A75 75%, #831843 100%)",
            }}
          >
            {/* Ambient Festive Glowing Lights */}
            <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 right-10 -translate-y-1/2 w-64 h-64 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 left-1/3 w-48 h-48 rounded-full bg-purple-500/20 blur-2xl pointer-events-none" />

            {/* Floating Festive Icons */}
            <div className="absolute top-3 right-3 md:top-5 md:right-1/4 text-2xl md:text-3xl select-none animate-float-slow pointer-events-none opacity-80">
              🎈
            </div>
            <div className="absolute bottom-3 left-4 md:left-1/3 text-2xl md:text-3xl select-none animate-float-slow-rev pointer-events-none opacity-75">
              🎉
            </div>
            <div className="absolute top-8 left-2/3 text-xl md:text-2xl select-none animate-float-slow pointer-events-none opacity-70">
              ✨
            </div>
            <div className="absolute bottom-6 right-16 text-xl md:text-2xl select-none animate-float-slow-rev pointer-events-none opacity-60">
              🎁
            </div>

            {/* Confetti particles overlay */}
            {confettiActive && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                {Array.from({ length: 32 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute w-2 h-2 rounded-sm"
                    style={{
                      left: `${(i * 3.1) % 100}%`,
                      top: `-10px`,
                      backgroundColor: [
                        "#F59E0B",
                        "#EC4899",
                        "#8B5CF6",
                        "#10B981",
                        "#38BDF8",
                        "#F43F5E",
                        "#FBBF24",
                      ][i % 7],
                      animation: `confettiFall ${1.8 + (i % 5) * 0.4}s ease-in-out infinite`,
                      animationDelay: `${(i % 10) * 0.15}s`,
                      transform: `rotate(${i * 45}deg)`,
                    }}
                  />
                ))}
              </div>
            )}

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              {/* Left Content Area: Avatar + Birthday Greeting */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                {/* Student Avatar with Glowing Festive Ring & Crown */}
                <div className="relative flex-shrink-0 self-start sm:self-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-[3px] bg-gradient-to-tr from-amber-400 via-pink-400 to-indigo-300 shadow-xl ring-4 ring-amber-400/20">
                    <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 flex items-center justify-center">
                      {docs_st_image || user_image ? (
                        <img
                          src={docs_st_image || user_image || ""}
                          alt={name || "Student"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl sm:text-2xl font-black text-amber-300">
                          {getInitials(name)}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Floating Golden Crown */}
                  <span
                    className="absolute -top-3 -right-2 text-2xl sm:text-3xl select-none filter drop-shadow-md transform rotate-12 animate-pulse"
                    title="Birthday Star!"
                  >
                    👑
                  </span>
                </div>

                {/* Greeting Details */}
                <div>
                  {/* Top Badges Row */}
                  <div className="flex items-center flex-wrap gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-400 via-rose-300 to-amber-300 text-slate-950 font-black text-[11px] sm:text-xs uppercase tracking-wider shadow-md">
                      <span>🎂</span>
                      <span>Birthday Special</span>
                      <span>✨</span>
                    </span>

                    <span className="text-xs text-white/80 font-medium">
                      {new Date().toLocaleDateString("en-IN", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>

                    {registration_number ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/40 font-mono font-bold tracking-wide">
                        {registration_number}
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400/30 text-amber-100 font-medium tracking-wide border border-amber-300/40">
                        ID Pending (Pay at Centre)
                      </span>
                    )}
                  </div>

                  {/* Birthday Greeting Headline */}
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight flex items-center flex-wrap gap-2 drop-shadow-sm">
                    <span>Happy Birthday, {name || "Student"}!</span>
                    <span className="text-2xl sm:text-3xl">🎉</span>
                    <span className="text-2xl sm:text-3xl animate-bounce">🎂</span>
                  </h2>

                  {/* Warm Heartfelt Wish */}
                  <p className="text-xs sm:text-sm text-pink-100/90 font-medium max-w-2xl mt-1.5 leading-relaxed">
                    🌟 Wishing you a joyous, inspiring birthday filled with happiness, new knowledge, and grand success in every milestone at Brainzima!
                  </p>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center flex-wrap sm:flex-nowrap gap-3 self-start lg:self-center">
                {/* Celebrate Confetti Trigger */}
                <button
                  type="button"
                  onClick={triggerConfetti}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs bg-amber-400/25 hover:bg-amber-400/40 text-amber-100 border border-amber-300/40 transition-all shadow cursor-pointer active:scale-95"
                  title="Throw confetti celebration!"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Celebrate! 🎉</span>
                </button>

                {/* Daily Attendance Punch Action */}
                <button
                  type="button"
                  onClick={handleAttendancePunch}
                  disabled={punchLoading}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer ${
                    attendanceStatus === "in"
                      ? "bg-[#ECFDF5] text-[#08A66A] border border-[#A7F3D0] hover:bg-[#D1FAE5]"
                      : "bg-white text-[#701A75] hover:bg-white/95"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      attendanceStatus === "in" ? "bg-[#08A66A] animate-pulse" : "bg-[#EF4444]"
                    }`}
                  />
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
        ) : (
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
                  {registration_number ? (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-white font-mono font-bold tracking-wide">
                      {registration_number}
                    </span>
                  ) : (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400/30 text-amber-100 font-medium tracking-wide border border-amber-300/40">
                      ID Pending (Pay at Centre)
                    </span>
                  )}
                </div>
                <h2 className="text-xl md:text-2xl font-extrabold text-white leading-tight">
                  Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"},{" "}
                  {name || "Student"}! 👋
                </h2>
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
                  <span
                    className={`w-2 h-2 rounded-full ${
                      attendanceStatus === "in" ? "bg-[#08A66A] animate-pulse" : "bg-[#EF4444]"
                    }`}
                  />
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
        )}
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

        {/* Stat 2: Fee Paid */}
        <motion.div {...fadeUp(0.1)}>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] hover:border-[#DDD6FE] hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${totalDuesAmount > 0
                  ? "bg-[#FFFBEB] border-[#FEF3C7] text-[#F59E0B]"
                  : "bg-[#ECFDF5] border-[#D1FAE5] text-[#08A66A]"
                }`}>
                <CreditCard className="w-5 h-5" />
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${totalDuesAmount > 0
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
                ₹{totalPaidAmount.toLocaleString("en-IN")}
              </p>
            )}
            <p className="text-xs font-semibold text-[#111827] mt-1">Fee Status</p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              {totalDuesAmount > 0
                ? `Paid: ₹${totalPaidAmount.toLocaleString("en-IN")} · Due: ₹${totalDuesAmount.toLocaleString("en-IN")}`
                : `Paid: ₹${totalPaidAmount.toLocaleString("en-IN")} (Fully Cleared)`}
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
        {/* Left Column (2 Cols): Courses (Enrolled, Offline, Online) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[#111827] flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#5B21F4]" />
                Courses
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                All enrolled programs, offline batches, and online LMS courses
              </p>
            </div>
            <Link
              href="/student/courses"
              className="text-xs font-bold text-[#5B21F4] hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Three Courses Sections / Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] overflow-x-auto">
            <button
              type="button"
              onClick={() => setCoursesTab("enrolled")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                coursesTab === "enrolled"
                  ? "bg-white text-[#5B21F4] shadow-sm font-extrabold border border-[#E2E8F0]"
                  : "text-[#64748B] hover:text-[#111827]"
              }`}
            >
              <span>Enrolled Courses</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  coursesTab === "enrolled"
                    ? "bg-[#F1EEFF] text-[#5B21F4]"
                    : "bg-[#E2E8F0] text-[#64748B]"
                }`}
              >
                {enrollments.length + onlineCourses.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCoursesTab("offline")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                coursesTab === "offline"
                  ? "bg-white text-[#5B21F4] shadow-sm font-extrabold border border-[#E2E8F0]"
                  : "text-[#64748B] hover:text-[#111827]"
              }`}
            >
              <span>Offline Courses</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  coursesTab === "offline"
                    ? "bg-[#F1EEFF] text-[#5B21F4]"
                    : "bg-[#E2E8F0] text-[#64748B]"
                }`}
              >
                {enrollments.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCoursesTab("online")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                coursesTab === "online"
                  ? "bg-white text-[#5B21F4] shadow-sm font-extrabold border border-[#E2E8F0]"
                  : "text-[#64748B] hover:text-[#111827]"
              }`}
            >
              <span>Online Courses</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  coursesTab === "online"
                    ? "bg-[#F1EEFF] text-[#5B21F4]"
                    : "bg-[#E2E8F0] text-[#64748B]"
                }`}
              >
                {onlineCourses.length}
              </span>
            </button>
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
          ) : (
            <div className="space-y-3">
              {/* 1. SECTION: ENROLLED COURSES (COMBINED: OFFLINE + ONLINE) */}
              {coursesTab === "enrolled" && (
                <>
                  {enrollments.length === 0 && onlineCourses.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center space-y-3">
                      <BookOpen className="w-10 h-10 text-[#94A3B8] mx-auto" />
                      <p className="text-sm font-bold text-[#111827]">No courses enrolled yet.</p>
                      <p className="text-xs text-[#64748B]">
                        Explore our offline diplomas or online certifications to begin your journey.
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <Link
                          href="/student/offline-courses"
                          className="px-4 py-2 bg-[#5B21F4] text-white text-xs font-bold rounded-xl hover:bg-[#4C1BD4] transition-colors">

                          Offline Courses
                        </Link>
                        <Link
                          href="/student/online-courses"
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#111827] text-xs font-bold rounded-xl transition-colors">

                          Online Courses
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Offline Courses inside Enrolled View */}
                      {enrollments.map((course) => {
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
                            key={`enr_off_${course.stc_id}`}
                            className="bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#DDD6FE] hover:shadow-md transition-all p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                          {/* Thumbnail */}
                            <div className="w-full sm:w-28 sm:h-20 aspect-[16/9] sm:aspect-auto rounded-xl overflow-hidden shrink-0 bg-slate-900">
                              <CourseThumbnail
                                src={getCourseImageUrl((course as any).course_img_path || (course as any).img_path)}
                                alt={course.course_name || ""}
                                courseCode={course.course_code}
                                courseName={course.course_name || ""}
                                isOnline={false}
                              />
                            </div>

                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {course.course_code && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                    {course.course_code}
                                  </span>
                                )}
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                  Offline Course
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  Active
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-[#111827] truncate">
                                {course.course_name || `Course #${course.course_id}`}
                              </h4>
                              <p className="text-xs text-[#64748B]">
                                Batch: <span className="font-semibold text-[#111827]">{(course as any).batch_name || "General Batch"}</span> · Enrollment ID: #{course.stc_id}
                              </p>
                              <div className="flex items-center gap-3 text-xs pt-0.5 flex-wrap">
                                <span className="text-[#64748B]">Fee: ₹{feeVal.toLocaleString("en-IN")}</span>
                                <span>&bull;</span>
                                <span className="text-emerald-700 font-semibold">Paid: ₹{paidVal.toLocaleString("en-IN")}</span>
                                <span>&bull;</span>
                                <span className={duesVal > 0 ? "text-amber-700 font-bold" : "text-emerald-700 font-bold"}>
                                  {duesVal > 0 ? `Due: ₹${duesVal.toLocaleString("en-IN")}` : "Paid in Full"}
                                </span>
                              </div>
                            </div>
                            <Link
                              href="/student/courses"
                              className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-[#5B21F4] text-[#111827] hover:text-white text-xs font-bold transition-all text-center shrink-0 self-start sm:self-center">
  
                              View Course
                            </Link>
                          </div>
                        );
                      })}

                      {/* Online Courses inside Enrolled View */}
                      {onlineCourses.map((course) => (
                        <div
                          key={`enr_onl_${course.course_id}`}
                          className="bg-white rounded-2xl border border-[#DDD6FE] bg-gradient-to-r from-purple-50/20 via-white to-white hover:border-[#5B21F4] hover:shadow-md transition-all p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                          <div className="w-full sm:w-28 sm:h-20 aspect-[16/9] sm:aspect-auto rounded-xl overflow-hidden shrink-0 bg-slate-900">
                            <CourseThumbnail
                              src={getCourseImageUrl(course.course_img_path || (course as any).img_path)}
                              alt={course.course_name}
                              courseCode={course.course_code}
                              courseName={course.course_name}
                              isOnline={true}
                            />
                          </div>

                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {course.course_code && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F1EEFF] text-[#5B21F4] border border-[#DDD6FE]">
                                  {course.course_code}
                                </span>
                              )}
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F1EEFF] text-[#5B21F4] border border-[#DDD6FE]">
                                Online Course
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                Purchased
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-[#111827] truncate">
                              {course.course_name}
                            </h4>
                            <p className="text-xs text-[#64748B]">
                              Duration: <span className="font-semibold text-[#111827]">{course.course_duration || "Self-Paced"}</span> · Validity: <span className="font-semibold text-[#111827]">{course.course_validity || "Lifetime Access"}</span>
                            </p>
                            <div className="flex items-center gap-3 text-xs pt-0.5 flex-wrap">
                              <span className="text-emerald-700 font-semibold">
                                Paid: ₹{Number(course.amount_paid || course.course_fee || 0).toLocaleString("en-IN")}
                              </span>
                              <span>&bull;</span>
                              <span className="text-purple-700 font-semibold">All Lessons Unlocked</span>
                            </div>
                          </div>
                          <Link
                            href={`/student/online-courses/${course.course_id}`}
                            className="px-4 py-2 rounded-xl bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-sm shadow-[#5B21F4]/20 self-start sm:self-center">

                            <PlayCircle className="w-4 h-4" />
                            <span>Continue Learning</span>
                          </Link>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}

              {/* 2. SECTION: OFFLINE COURSES (ONLY OFFLINE) */}
              {coursesTab === "offline" && (
                <>
                  {enrollments.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center space-y-3">
                      <GraduationCap className="w-10 h-10 text-[#94A3B8] mx-auto" />
                      <p className="text-sm font-bold text-[#111827]">No offline courses enrolled.</p>
                      <p className="text-xs text-[#64748B]">
                        Courses assigned through offline classroom admissions will be displayed here.
                      </p>
                      <Link
                        href="/student/offline-courses"
                        className="inline-block px-4 py-2 bg-[#5B21F4] text-white text-xs font-bold rounded-xl hover:bg-[#4C1BD4] transition-colors">

                        Browse Offline Courses
                      </Link>
                    </div>
                  ) : (
                    enrollments.map((course) => {
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
                          key={`off_only_${course.stc_id}`}
                          className="bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#DDD6FE] hover:shadow-md transition-all p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                          <div className="w-full sm:w-28 sm:h-20 aspect-[16/9] sm:aspect-auto rounded-xl overflow-hidden shrink-0 bg-slate-900">
                            <CourseThumbnail
                              src={getCourseImageUrl((course as any).course_img_path || (course as any).img_path)}
                              alt={course.course_name || ""}
                              courseCode={course.course_code}
                              courseName={course.course_name || ""}
                              isOnline={false}
                            />
                          </div>

                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {course.course_code && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  {course.course_code}
                                </span>
                              )}
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                Offline Course
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                Active
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-[#111827] truncate">
                              {course.course_name || `Course #${course.course_id}`}
                            </h4>
                            <p className="text-xs text-[#64748B]">
                              Batch: <span className="font-semibold text-[#111827]">{(course as any).batch_name || "General Batch"}</span> · Enrollment ID: #{course.stc_id}
                            </p>
                            <div className="flex items-center gap-3 text-xs pt-0.5 flex-wrap">
                              <span className="text-[#64748B]">Fee: ₹{feeVal.toLocaleString("en-IN")}</span>
                              <span>&bull;</span>
                              <span className="text-emerald-700 font-semibold">Paid: ₹{paidVal.toLocaleString("en-IN")}</span>
                              <span>&bull;</span>
                              <span className={duesVal > 0 ? "text-amber-700 font-bold" : "text-emerald-700 font-bold"}>
                                {duesVal > 0 ? `Due: ₹${duesVal.toLocaleString("en-IN")}` : "Paid in Full"}
                              </span>
                            </div>
                          </div>
                          <Link
                            href="/student/courses"
                            className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-[#5B21F4] text-[#111827] hover:text-white text-xs font-bold transition-all text-center shrink-0 self-start sm:self-center">

                            View Course
                          </Link>
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {/* 3. SECTION: ONLINE COURSES (ONLY ONLINE) */}
              {coursesTab === "online" && (
                <>
                  {onlineCourses.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center space-y-3">
                      <PlayCircle className="w-10 h-10 text-[#94A3B8] mx-auto" />
                      <p className="text-sm font-bold text-[#111827]">No online courses purchased yet.</p>
                      <p className="text-xs text-[#64748B]">
                        Unlock anytime-access digital courses with high-definition video lessons and certificates.
                      </p>
                      <Link
                        href="/student/online-courses"
                        className="inline-block px-4 py-2 bg-[#5B21F4] text-white text-xs font-bold rounded-xl hover:bg-[#4C1BD4] transition-colors">

                        Explore Online Courses
                      </Link>
                    </div>
                  ) : (
                    onlineCourses.map((course) => (
                      <div
                        key={`onl_only_${course.course_id}`}
                        className="bg-white rounded-2xl border border-[#DDD6FE] bg-gradient-to-r from-purple-50/20 via-white to-white hover:border-[#5B21F4] hover:shadow-md transition-all p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                        <div className="w-full sm:w-28 sm:h-20 aspect-[16/9] sm:aspect-auto rounded-xl overflow-hidden shrink-0 bg-slate-900">
                          <CourseThumbnail
                            src={getCourseImageUrl(course.course_img_path || (course as any).img_path)}
                            alt={course.course_name}
                            courseCode={course.course_code}
                            courseName={course.course_name}
                            isOnline={true}
                          />
                        </div>

                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {course.course_code && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F1EEFF] text-[#5B21F4] border border-[#DDD6FE]">
                                {course.course_code}
                              </span>
                            )}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F1EEFF] text-[#5B21F4] border border-[#DDD6FE]">
                              Online Course
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                              Purchased
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-[#111827] truncate">
                            {course.course_name}
                          </h4>
                          <p className="text-xs text-[#64748B]">
                            Duration: <span className="font-semibold text-[#111827]">{course.course_duration || "Self-Paced"}</span> · Validity: <span className="font-semibold text-[#111827]">{course.course_validity || "Lifetime Access"}</span>
                          </p>
                          <div className="flex items-center gap-3 text-xs pt-0.5 flex-wrap">
                            <span className="text-emerald-700 font-semibold">
                              Paid: ₹{Number(course.amount_paid || course.course_fee || 0).toLocaleString("en-IN")}
                            </span>
                            <span>&bull;</span>
                            <span className="text-purple-700 font-semibold">All Lessons Unlocked</span>
                          </div>
                        </div>
                        <Link
                          href={`/student/online-courses/${course.course_id}`}
                          className="px-4 py-2 rounded-xl bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-sm shadow-[#5B21F4]/20 self-start sm:self-center">

                          <PlayCircle className="w-4 h-4" />
                          <span>Continue Learning</span>
                        </Link>
                      </div>
                    ))
                  )}
                </>
              )}
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
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rec.status === 1 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
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

      <style>{`
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(4deg); }
        }
        @keyframes floatSlowReverse {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-7px) rotate(-4deg); }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(260px) rotate(720deg); opacity: 0; }
        }
        .animate-float-slow {
          animation: floatSlow 3.6s ease-in-out infinite;
        }
        .animate-float-slow-rev {
          animation: floatSlowReverse 4.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
