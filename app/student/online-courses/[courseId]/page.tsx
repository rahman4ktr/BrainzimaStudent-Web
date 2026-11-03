"use client";

import React, { useState, useEffect, useCallback, useMemo, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Calendar,
  Lock,
  Play,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  CreditCard,
  Loader2,
  GraduationCap,
  Mail,
  X,
  Trophy,
  Award,
  Menu,
  ChevronDown,
  Search,
  Star,
  ShieldCheck,
  Radio,
  Languages,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getOnlineCourseById,
  getOnlineCourses,
  getOnlineCourseSyllabus,
  checkOnlineCourseAccess,
  createOnlineCourseOrder,
  verifyOnlineCoursePurchase,
  getCurrentStudent,
  getStudentOnlineCourses,
  getOnlineResults,
  type OnlineCourse,
  type OnlineSyllabusItem,
  type CouponValidationData,
  type OnlineResultRecord,
} from "@/lib/api";
import CourseFeedbackModal from "@/components/feedback/CourseFeedbackModal";
import { CouponOfferCards } from "@/components/CouponOfferCards";
import {
  getCourseProgress,
  updateLessonWatchTime,
  markLessonCompleted,
  checkLessonLockStatus,
  type CourseProgressState,
} from "@/lib/courseProgress";
import { useStudent } from "@/hooks/useStudent";
import { getYouTubeEmbedUrl } from "@/lib/youtube";
import LmsVideoPlayer from "@/components/player/LmsVideoPlayer";
import { getSession, updateSession, getCourseImageUrl } from "@/lib/session";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function StudentOnlineCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const resolvedParams = use(params);
  const courseId = Number(resolvedParams.courseId);
  const router = useRouter();
  const { toast } = useToast();

  const [course, setCourse] = useState<OnlineCourse | null>(null);
  const [syllabus, setSyllabus] = useState<OnlineSyllabusItem[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [isPurchased, setIsPurchased] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCheckingAccess, setIsCheckingAccess] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState<{
    registration_number: string;
    email_recipient?: string;
    amount_paid: number;
    course_name: string;
    total_fee?: number;
    coupon_code?: string;
    discount?: number;
  } | null>(null);

  // ── Online Course Coupon State ──
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationData | null>(null);

  // ── Existing Quiz Result for Course ──
  const [quizResult, setQuizResult] = useState<OnlineResultRecord | null>(null);

  // ── Course Feedback & Evaluation State ──
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState<boolean>(false);

  // ── Mobile Course Syllabus Menu State ──
  const [isSyllabusMenuOpen, setIsSyllabusMenuOpen] = useState<boolean>(false);
  const [syllabusSearch, setSyllabusSearch] = useState<string>("");

  const filteredSyllabus = useMemo(() => {
    if (!syllabusSearch.trim()) return syllabus;
    const q = syllabusSearch.toLowerCase();
    return syllabus.filter(
      (item) =>
        item.syllabus_title.toLowerCase().includes(q) ||
        (item.syllabus_topic && item.syllabus_topic.toLowerCase().includes(q))
    );
  }, [syllabus, syllabusSearch]);

  // Reset coupon if user switches course
  useEffect(() => {
    setAppliedCoupon(null);
  }, [courseId]);

  const { user_id: hookUserId, role: hookRole, name: studentName, registration_number: studentRegNo } = useStudent();
  const session = getSession();
  const currentUserId = hookUserId || (session?.user_id ? Number(session.user_id) : 0);
  const currentUserRole = hookRole || session?.role || "student";
  const studentAcademicId = session?.student_id ? Number(session.student_id) : 0;

  // Derived pricing breakdown matching Khan Global Studies UX
  const feeNum = Number(course?.course_fee || 0);
  const originalFee = feeNum > 0 ? Math.round((feeNum * 1.4) / 100) * 100 : 0;
  const couponDiscount = appliedCoupon ? Number(appliedCoupon.discount_amount || 0) : 0;
  const netPayable = Math.max(0, feeNum - couponDiscount);
  const discountPercent = originalFee > 0 ? Math.round(((originalFee - netPayable) / originalFee) * 100) : 0;

  const resolvedImageUrl = getCourseImageUrl(course?.course_img_path);

  // ── Fetch Existing Quiz Result for Course ──
  const loadQuizResult = useCallback(async () => {
    if (!courseId) return;
    try {
      const res = await getOnlineResults(
        {
          course_id: courseId,
          user_id: currentUserId,
          std_id: studentAcademicId,
        },
        currentUserId,
        (currentUserRole as "student" | "user" | "admin") || "student",
        studentAcademicId
      );
      if (res.success && res.data && Array.isArray(res.data.results)) {
        const courseMatch = res.data.results.find(
          (r: any) => Number(r.course_id) === courseId
        );
        setQuizResult(courseMatch || null);
      } else {
        setQuizResult(null);
      }
    } catch {
      setQuizResult(null);
    }
  }, [courseId, currentUserId, studentAcademicId, currentUserRole]);

  // ── Load Course, Syllabus & Access State ──
  const loadCourseData = useCallback(async () => {
    if (!courseId || isNaN(courseId)) {
      setError("Invalid course identifier.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch online course details with resilient fallback
      let courseData: OnlineCourse | null = null;
      try {
        const courseRes = await getOnlineCourseById(courseId);
        if (courseRes.success && courseRes.data) {
          courseData = courseRes.data;
        }
      } catch {
        /* ignore and try list fallback */
      }

      if (!courseData) {
        const listRes = await getOnlineCourses();
        if (listRes.success && Array.isArray(listRes.data)) {
          courseData =
            listRes.data.find((c) => Number(c.course_id) === courseId) || null;
        }
      }

      if (!courseData) {
        throw new Error("Online course not found.");
      }
      setCourse(courseData);

      // 2. Fetch syllabus items
      let lessons: OnlineSyllabusItem[] = [];
      if (
        courseData.syllabus &&
        Array.isArray(courseData.syllabus) &&
        courseData.syllabus.length > 0
      ) {
        lessons = courseData.syllabus;
      } else {
        try {
          const sylRes = await getOnlineCourseSyllabus(courseId);
          if (sylRes.success && Array.isArray(sylRes.data)) {
            lessons = sylRes.data;
          }
        } catch {
          /* ignore syllabus error */
        }
      }

      // Sort syllabus lessons strictly by topic_order ASC
      lessons.sort((a, b) => Number(a.topic_order) - Number(b.topic_order));
      setSyllabus(lessons);

      if (lessons.length > 0) {
        setSelectedLessonId(lessons[0].syllabus_id);
      }

      // 3. Verify student's purchase / enrollment access
      setIsCheckingAccess(true);
      let userHasAccess = false;

      // Check via profile
      if (currentUserId > 0) {
        try {
          const studentRes = await getCurrentStudent(currentUserId);
          if (studentRes.success && studentRes.data?.online_courses) {
            const matchingCourse = studentRes.data.online_courses.some(
              (c: any) => Number(c.course_id ?? c.stco_course_id) === courseId
            );
            if (matchingCourse) {
              userHasAccess = true;
            }
          }
        } catch (stErr) {
          console.warn("[StudentOnlineLMS] Profile enrollment check warning:", stErr);
        }
      }

      // Check via enrolled endpoint
      if (!userHasAccess && currentUserId > 0) {
        try {
          const enrolledRes = await getStudentOnlineCourses(currentUserId, "student");
          if (enrolledRes.success && Array.isArray(enrolledRes.data)) {
            const matchingCourse = enrolledRes.data.some(
              (c: any) => Number(c.course_id ?? c.stco_course_id) === courseId
            );
            if (matchingCourse) {
              userHasAccess = true;
            }
          }
        } catch (enrErr) {
          console.warn("[StudentOnlineLMS] Enrolled list check notice:", enrErr);
        }
      }

      // Check via access endpoint
      if (!userHasAccess && currentUserId > 0) {
        try {
          const accessRes = await checkOnlineCourseAccess(
            courseId,
            currentUserId,
            currentUserRole as any
          );
          if (accessRes.success && accessRes.data?.purchased) {
            userHasAccess = true;
          }
        } catch (accessErr) {
          console.warn("[StudentOnlineLMS] Access check notice:", accessErr);
        }
      }

      setIsPurchased(userHasAccess);
      setIsCheckingAccess(false);
    } catch (err: any) {
      console.error("[StudentOnlineLMS] Load error:", err);
      setError(err?.message || "Failed to load course details.");
    } finally {
      setIsLoading(false);
    }
  }, [courseId, currentUserId, currentUserRole]);

  useEffect(() => {
    loadCourseData();
    loadQuizResult();
  }, [loadCourseData, loadQuizResult]);

  // ── Course Progress Engine ──
  const [courseProgress, setCourseProgress] = useState<CourseProgressState>(() =>
    getCourseProgress(courseId, syllabus.length, currentUserId)
  );

  useEffect(() => {
    if (courseId && syllabus.length > 0) {
      setCourseProgress(getCourseProgress(courseId, syllabus.length, currentUserId));
    }
  }, [courseId, syllabus.length, currentUserId]);

  const currentLesson =
    syllabus.find((s) => s.syllabus_id === selectedLessonId) || syllabus[0] || null;
  const currentLessonIndex = currentLesson
    ? syllabus.findIndex((s) => s.syllabus_id === currentLesson.syllabus_id)
    : -1;

  const isCurrentLessonFree = currentLesson
    ? Number(currentLesson.topic_order) === 1
    : false;
  const currentLockStatus = currentLesson
    ? checkLessonLockStatus(currentLesson.syllabus_id, syllabus, courseProgress, isPurchased)
    : { isUnlocked: true, isCompleted: false };
  const isCurrentLessonUnlocked = currentLockStatus.isUnlocked;

  const currentLessonProgressRecord = currentLesson
    ? courseProgress.lessonProgress[currentLesson.syllabus_id]
    : undefined;
  const currentLessonProgressPercent = currentLessonProgressRecord?.percent || 0;

  // Auto-watch timer: while student is actively on this unlocked lesson, progress accumulates towards 80%
  useEffect(() => {
    if (!isCurrentLessonUnlocked || !currentLesson) return;

    const syllabusId = currentLesson.syllabus_id;
    const interval = setInterval(() => {
      setCourseProgress((prev) => {
        const existing = prev.lessonProgress[syllabusId];
        if (existing?.isCompleted) return prev;

        const newWatched = (existing?.watchedSeconds || 0) + 4;
        const duration = 180;
        const { progress, newlyCompleted } = updateLessonWatchTime(
          courseId,
          syllabusId,
          newWatched,
          duration,
          syllabus.length,
          currentUserId
        );

        if (newlyCompleted) {
          toast({
            variant: "success",
            title: "🎉 Lecture Completed!",
            description: "You have watched at least 80% of this lecture. The next lecture is now unlocked!",
          });
        }
        return progress;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [isCurrentLessonUnlocked, currentLesson?.syllabus_id, courseId, syllabus.length, currentUserId, toast]);

  const handleManualMarkComplete = () => {
    if (!currentLesson) return;
    const updated = markLessonCompleted(
      courseId,
      currentLesson.syllabus_id,
      syllabus.length,
      currentUserId
    );
    setCourseProgress(updated);
    toast({
      variant: "success",
      title: "🎉 Lecture Completed!",
      description: "Marked as completed (100%). Next lecture has been unlocked!",
    });
  };

  const prevLesson =
    currentLessonIndex > 0 ? syllabus[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex >= 0 && currentLessonIndex < syllabus.length - 1
      ? syllabus[currentLessonIndex + 1]
      : null;
  const nextLockStatus = nextLesson
    ? checkLessonLockStatus(nextLesson.syllabus_id, syllabus, courseProgress, isPurchased)
    : { isUnlocked: false, isCompleted: false, lockReason: undefined };
  const isNextUnlocked = nextLockStatus.isUnlocked;

  const handleSelectLesson = (lessonItem: OnlineSyllabusItem) => {
    const lock = checkLessonLockStatus(lessonItem.syllabus_id, syllabus, courseProgress, isPurchased);
    if (!lock.isUnlocked) {
      toast({
        variant: "warning",
        title: "Lecture Locked 🔒",
        description: lock.lockReason || "Watch at least 80% of previous lecture to unlock.",
      });
      return;
    }
    setSelectedLessonId(lessonItem.syllabus_id);
    setIsSyllabusMenuOpen(false);
  };

  // ── Razorpay Payment & Purchase Verification ──
  const handleBuyCourse = async () => {
    if (!currentUserId) {
      toast({
        variant: "error",
        title: "Authentication Required",
        description: "Please login to your account to purchase this course.",
      });
      router.push("/");
      return;
    }

    if (!course) return;

    const courseFeeNum = Number(course.course_fee) || 0;
    if (courseFeeNum <= 0) {
      toast({
        variant: "error",
        title: "Invalid Course Fee",
        description: "Course fee must be greater than zero.",
      });
      return;
    }

    const discountAmount = appliedCoupon ? Number(appliedCoupon.discount_amount) || 0 : 0;
    const finalAmount = Math.max(0, courseFeeNum - discountAmount);

    setIsProcessingPayment(true);

    try {
      const isScriptReady = await loadRazorpayScript();
      if (!isScriptReady) {
        throw new Error(
          "Could not initialize Razorpay SDK. Please check your internet connection."
        );
      }

      const orderRes = await createOnlineCourseOrder(
        currentUserId,
        courseId,
        finalAmount,
        discountAmount
      );
      if (!orderRes.success || !orderRes.data) {
        throw new Error(
          orderRes.message || "Failed to create payment gateway order."
        );
      }

      const orderData = orderRes.data;

      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Brainzima Online Academy",
        description: `Enrollment: ${course.course_name}${
          appliedCoupon ? ` (Coupon: ${appliedCoupon.coupon_code})` : ""
        }`,
        image: "https://student.brainzima.com/public/uploads/logo/brainzima-logo.png",
        order_id: orderData.order_id,
        prefill: {
          name: session?.name || "",
          email: session?.email || "",
          contact: session?.mobile || "",
        },
        theme: {
          color: "#0B3B82",
        },
        modal: {
          ondismiss: () => {
            setIsProcessingPayment(false);
          },
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          await finalizePurchaseOnBackend(response);
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        setIsProcessingPayment(false);
        const failMsg =
          resp.error?.description ||
          resp.error?.reason ||
          "Payment was not completed.";
        toast({
          variant: "error",
          title: "Payment Cancelled or Failed",
          description: failMsg,
        });
      });

      rzp.open();
    } catch (err: any) {
      console.error("[StudentOnlineLMS] Payment Initiate Error:", err);
      setIsProcessingPayment(false);
      toast({
        variant: "error",
        title: "Payment Error",
        description: err?.message || "Failed to launch payment checkout.",
      });
    }
  };

  const finalizePurchaseOnBackend = async (rzpResponse: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => {
    setIsProcessingPayment(true);

    try {
      const discountAmount = appliedCoupon ? Number(appliedCoupon.discount_amount) || 0 : 0;
      const courseFeeNum = Number(course?.course_fee) || 0;

      const verifyRes = await verifyOnlineCoursePurchase(
        courseId,
        currentUserId,
        {
          razorpay_payment_id: rzpResponse.razorpay_payment_id,
          razorpay_order_id: rzpResponse.razorpay_order_id,
          razorpay_signature: rzpResponse.razorpay_signature,
          user_email: session?.email || undefined,
          user_name: session?.name || undefined,
          coupon_code: appliedCoupon?.coupon_code || undefined,
          discount: discountAmount,
          discount_amount: discountAmount,
          course_fee: courseFeeNum,
        },
        "student"
      );

      if (!verifyRes.success || !verifyRes.data?.purchased) {
        throw new Error(
          verifyRes.message || "Payment verification failed on server."
        );
      }

      setIsPurchased(true);

      const returnedStudentId = verifyRes.data.student_id
        ? Number(verifyRes.data.student_id)
        : session?.student_id;
      const returnedRegNo =
        verifyRes.data.registration_number ||
        (returnedStudentId
          ? `BISR${String(returnedStudentId).padStart(4, "0")}`
          : null);

      updateSession({
        role: "student",
        is_student: true,
        student_id: returnedStudentId ?? null,
        registration_number: returnedRegNo ?? null,
      });

      const actualPaid = verifyRes.data?.amount_paid !== undefined
        ? Number(verifyRes.data.amount_paid)
        : Math.max(0, courseFeeNum - discountAmount);

      setEnrollmentSuccess({
        registration_number: returnedRegNo || session?.registration_number || "Active",
        email_recipient: verifyRes.data?.email_recipient || session?.email,
        amount_paid: actualPaid,
        course_name: course?.course_name || "Online Course",
        total_fee: courseFeeNum,
        coupon_code: appliedCoupon?.coupon_code || verifyRes.data?.coupon_code || undefined,
        discount: discountAmount || verifyRes.data?.discount || 0,
      });

      toast({
        variant: "success",
        title: "🎉 Course Enrolled Successfully!",
        description: "All lessons in this course are now fully unlocked.",
      });
    } catch (err: any) {
      console.error("[StudentOnlineLMS] Backend verification error:", err);
      toast({
        variant: "error",
        title: "Verification Error",
        description:
          err?.message || "Could not confirm purchase. Please contact support.",
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const embedUrl = currentLesson
    ? getYouTubeEmbedUrl(
      currentLesson.syllabus_topic_url,
      currentLesson.syllabus_topic
    )
    : "";

  return (
    <div className="p-3 sm:p-5 md:p-6 lg:p-8 pb-28 lg:pb-12 space-y-6 max-w-screen-2xl mx-auto">
      {/* ── Breadcrumb Bar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/student/online-courses"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#64748B] hover:text-[#0B3B82] transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to Online Courses</span>
          </Link>
          <span className="text-[#CBD5E1]">/</span>
          <span className="text-xs sm:text-sm font-semibold text-[#111827] truncate max-w-[180px] sm:max-w-xs md:max-w-md">
            {course ? course.course_name : "Course Details"}
          </span>
        </div>

        {/* Enrollment Status Badge */}
        {!isLoading && course && (
          <div>
            {isPurchased ? (
              <Badge
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700 text-xs py-1 px-3 gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Enrolled &amp; Unlocked</span>
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-xs py-1 px-3 border-emerald-300 text-emerald-700 bg-emerald-50 font-semibold"
              >
                <span>Free Preview Available</span>
              </Badge>
            )}
          </div>
        )}
      </div>

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
            onClick={loadCourseData}
            className="h-8 px-3 text-xs font-bold border-red-300 text-red-700 hover:bg-red-100 shrink-0"
          >
            Retry
          </Button>
        </Alert>
      )}

      {/* ── Loading Skeleton ── */}
      {isLoading && (
        <div className="space-y-6">
          <Skeleton className="h-9 w-44 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 space-y-6">
              <Skeleton className="h-80 w-full rounded-2xl" />
              <Skeleton className="aspect-video w-full rounded-2xl" />
            </div>
            <div className="lg:col-span-4 space-y-4">
              <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content: Khan Global Studies UX (Exact 2-Column Design) ── */}
      {!isLoading && course && (
        <div className="space-y-4 sm:space-y-6">
          {/* Main Top Header: "Description" matching reference image (Only shown when not enrolled) */}
          {!isPurchased && (
            <div className="flex items-center justify-between">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                Description
              </h1>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ══════════════════════════════════════════════════════════════
                MAIN COLUMN (8 cols if not enrolled, full 12 cols if enrolled): LMS Player + Curriculum + Quiz
                ══════════════════════════════════════════════════════════════ */}
            <div className={`${isPurchased ? "lg:col-span-12 max-w-5xl mx-auto w-full" : "lg:col-span-8"} space-y-6`}>
              {/* ── 1. Course Description Card (Only shown if NOT enrolled) ── */}
              {!isPurchased && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-2xs space-y-5">
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                      {course.course_name} – Build Strong Basics for Practical Excellence
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-2.5">
                      {course.course_description ||
                        `The ${course.course_name} is specially designed for learners and professionals seeking complete conceptual clarity and hands-on expertise. This course focuses on building a strong conceptual foundation using practical curriculum and industry standards, which are considered the backbone of modern learning.`}
                    </p>
                  </div>

                  <div className="pt-1">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 underline underline-offset-4 decoration-slate-300">
                      About the Course :
                    </h3>
                    <div className="mt-2.5 space-y-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                      <p>
                        Brainzima brings you a comprehensive and highly affordable foundation course to help you master the fundamentals of {course.course_name}.
                      </p>
                      <p>
                        Classes will be conducted live online with structured recorded lectures in English &amp; Hindi medium, covering all essential subjects in a structured manner. The course emphasizes conceptual clarity, real-world application, and consistent practice.
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
                        <span>300+ Live Interactive Classes and Recorded Lectures on the Brainzima Student Portal.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                        <span>Previous Year Questions (PYQs) &amp; assignment discussions integrated with each module.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                        <span>Comprehensive syllabus coverage with downloadable study notes and curated reference resources.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                        <span>Chapter-wise practice tests and full-length online mock examination to assess your preparation.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                        <span>Dedicated mentor doubt resolution and academic support throughout your enrollment.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                        <span>Official verified course completion certificate with authentic QR verification.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* ── 2. LMS Video Player Area (Interactive Learning) ── */}
              <div id="course-player" className="space-y-4 scroll-mt-20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#0B3B82]" />
                    <h3 className="text-base font-black text-slate-900 tracking-tight">
                      Course Lectures &amp; Curriculum ({syllabus.length} Lessons)
                    </h3>
                  </div>

                  {/* Mobile Syllabus Menu Trigger */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSyllabusMenuOpen(true)}
                    className="lg:hidden h-8 px-2.5 text-xs font-bold text-[#0B3B82] border-slate-200 rounded-xl"
                  >
                    <Menu className="w-3.5 h-3.5 mr-1" />
                    <span>Lessons ({currentLesson?.topic_order || 1}/{syllabus.length})</span>
                  </Button>
                </div>

                <Card className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  {/* Player Container */}
                  <div className="relative min-h-[320px] sm:aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                    {isCurrentLessonUnlocked ? (
                      <LmsVideoPlayer
                        url={currentLesson?.syllabus_topic_url}
                        fallbackContext={currentLesson?.syllabus_topic}
                        title={currentLesson?.syllabus_title}
                        onProgress={(watchedSec) => {
                          if (currentLesson && currentUserId) {
                            updateLessonWatchTime(
                              courseId,
                              currentLesson.syllabus_id,
                              watchedSec,
                              syllabus.length,
                              currentUserId
                            );
                          }
                        }}
                      />
                    ) : (
                      /* Locked screen */
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-5 sm:p-6 text-white space-y-3.5 sm:space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 backdrop-blur-md flex items-center justify-center text-amber-400 border border-amber-500/30 shadow-xl">
                          <Lock className="w-7 h-7" />
                        </div>

                        <div className="space-y-1.5 max-w-md">
                          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 font-extrabold text-[10px] uppercase tracking-wider">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>{!isPurchased ? "Enrollment Required" : "Sequential Progress Locked"}</span>
                          </span>
                          <h2 className="text-base sm:text-lg font-black text-white">
                            {!isPurchased
                              ? "Enroll in Full Course to Watch This Lesson"
                              : "Watch 80% of Previous Lecture to Unlock"}
                          </h2>
                          <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                            {!isPurchased
                              ? `Unlock all ${syllabus.length} video lessons, complete syllabus materials, and verified certification.`
                              : (currentLockStatus.lockReason || "To maintain academic rigor, each lecture unlocks once you complete at least 80% of the preceding lecture.")}
                          </p>
                        </div>

                        {!isPurchased ? (
                          <Button
                            onClick={handleBuyCourse}
                            disabled={isProcessingPayment}
                            className="h-9 px-5 rounded-xl font-bold text-xs bg-[#0B3B82] hover:bg-[#072B60] text-white shadow-md cursor-pointer"
                          >
                            {isProcessingPayment ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                <span>Opening Checkout...</span>
                              </>
                            ) : (
                              <span>Buy Now for ₹{netPayable.toLocaleString("en-IN")}</span>
                            )}
                          </Button>
                        ) : (
                          prevLesson && (
                            <Button
                              type="button"
                              onClick={() => setSelectedLessonId(prevLesson.syllabus_id)}
                              className="h-9 px-4 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                              <span>Go to Lesson #{prevLesson.topic_order || 1}</span>
                            </Button>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {/* 80% Watch Progress Bar */}
                  {isCurrentLessonUnlocked && (
                    <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-[#0B3B82] flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Lecture Progress:
                        </span>
                        <div className="w-28 sm:w-44 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              currentLessonProgressPercent >= 80
                                ? "bg-emerald-500"
                                : "bg-[#0B3B82]"
                            }`}
                            style={{ width: `${currentLessonProgressPercent}%` }}
                          />
                        </div>
                        <span className="font-extrabold text-[#111827] font-mono">
                          {currentLessonProgressPercent}%
                        </span>
                      </div>

                      {currentLessonProgressPercent >= 80 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          80%+ Completed (Next Unlocked)
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-amber-700 text-[11px] font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Watch 80% to unlock next
                          </span>
                          <button
                            type="button"
                            onClick={handleManualMarkComplete}
                            className="px-2.5 py-0.5 rounded-lg bg-[#0B3B82] hover:bg-[#072B60] text-white text-[11px] font-bold transition-all shadow-2xs cursor-pointer"
                          >
                            Mark Completed
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lesson Controls */}
                  <CardContent className="p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          {currentLockStatus.isCompleted ? (
                            <Badge variant="default" className="bg-emerald-600 text-[10px]">
                              Completed
                            </Badge>
                          ) : isCurrentLessonFree ? (
                            <Badge variant="default" className="bg-emerald-600 text-[10px]">
                              Free Demo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-slate-600">
                              Lesson
                            </Badge>
                          )}
                          <span className="text-xs font-semibold text-slate-500">
                            Lesson #{currentLesson?.topic_order || 1} of {syllabus.length}
                          </span>
                        </div>

                        <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                          {currentLesson?.syllabus_title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!prevLesson}
                          onClick={() => prevLesson && setSelectedLessonId(prevLesson.syllabus_id)}
                          className="h-8.5 px-3 text-xs font-semibold rounded-xl"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                          <span>Previous</span>
                        </Button>

                        {nextLesson ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!isNextUnlocked}
                            onClick={() => {
                              if (!isNextUnlocked) {
                                toast({
                                  variant: "warning",
                                  title: "Lecture Locked 🔒",
                                  description: nextLockStatus.lockReason || "Watch at least 80% of current lesson to unlock next lecture.",
                                });
                                return;
                              }
                              setSelectedLessonId(nextLesson.syllabus_id);
                            }}
                            className={`h-8.5 px-3 text-xs font-semibold rounded-xl ${
                              !isNextUnlocked ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                          >
                            <span>Next</span>
                            {!isNextUnlocked ? <Lock className="w-3 h-3 ml-1 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 ml-1" />}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setIsFeedbackModalOpen(true)}
                            className="h-8.5 px-3 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl"
                          >
                            <Star className="w-3 h-3 mr-1 fill-white" />
                            <span>Course Feedback</span>
                          </Button>
                        )}
                      </div>
                    </div>

                    {currentLesson?.syllabus_topic && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2.5 text-xs">
                        <BookOpen className="w-4 h-4 text-[#0B3B82] shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                            Topic Covered:
                          </span>
                          <p className="text-xs font-semibold text-slate-900 mt-0.5">
                            {currentLesson.syllabus_topic}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Desktop Syllabus Grid */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#0B3B82]" />
                      <h4 className="text-sm font-bold text-slate-900">Curriculum Lessons</h4>
                    </div>
                    <span className="text-xs font-bold text-slate-500">
                      {courseProgress.completedCount} / {syllabus.length} Completed
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {syllabus.map((lesson) => {
                      const isSelected = lesson.syllabus_id === selectedLessonId;
                      const isFree = Number(lesson.topic_order) === 1;
                      const lock = checkLessonLockStatus(lesson.syllabus_id, syllabus, courseProgress, isPurchased);
                      const isAccessible = lock.isUnlocked;
                      const isCompleted = lock.isCompleted;

                      return (
                        <button
                          key={lesson.syllabus_id}
                          type="button"
                          onClick={() => handleSelectLesson(lesson)}
                          className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 border cursor-pointer ${
                            isSelected
                              ? "bg-blue-50/70 border-blue-200 text-[#0B3B82] shadow-2xs"
                              : "bg-white hover:bg-slate-50 border-slate-100 text-slate-800"
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isCompleted ? (
                              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              </div>
                            ) : isAccessible ? (
                              <div className="w-6 h-6 rounded-lg bg-blue-100 text-[#0B3B82] flex items-center justify-center font-bold text-[10px]">
                                <Play className="w-3 h-3 fill-[#0B3B82]" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-[10px]">
                                <Lock className="w-3 h-3" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold truncate">
                                {lesson.topic_order}. {lesson.syllabus_title}
                              </span>
                              {isCompleted ? (
                                <Badge className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0 uppercase font-black shrink-0">
                                  ✓ Done
                                </Badge>
                              ) : isFree ? (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                                  Free
                                </span>
                              ) : !isAccessible ? (
                                <Lock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              ) : null}
                            </div>
                            {lesson.syllabus_topic && (
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {lesson.syllabus_topic}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── 3. Final Quiz Test & Certification Banner (LOCKED IF NOT PURCHASED, 3 ATTEMPTS PER COURSE) ── */}
              {!isPurchased ? (
                <div className="p-5 sm:p-6 rounded-2xl bg-amber-50/70 border border-amber-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                      <Lock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-black text-slate-900 tracking-tight">
                          Final Course Examination &amp; Certification
                        </h3>
                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-black uppercase flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Locked
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 max-w-xl">
                        Enroll in this online course to unlock the 50-question final examination and earn your verified certificate. 3 quiz attempts are included per course upon enrollment.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <Button
                      onClick={() => {
                        const buyCard = document.getElementById("course-registration-card");
                        if (buyCard) {
                          buyCard.scrollIntoView({ behavior: "smooth" });
                        } else {
                          handleBuyCourse();
                        }
                      }}
                      className="h-9 px-4.5 rounded-xl text-xs font-black bg-[#0B3B82] hover:bg-[#072B60] text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Enroll to Unlock Quiz</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-blue-50/80 via-white to-purple-50/80 border border-blue-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#0B3B82] text-white flex items-center justify-center shrink-0 shadow-md">
                      <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-black text-slate-900 tracking-tight">
                          Final Course Examination &amp; Certification
                        </h3>
                        {quizResult && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-black uppercase">
                            Score: {quizResult.marks}/100 Marks (Attempt {quizResult.extra?.attempt || 1}/3)
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 max-w-xl">
                        Pass the final quiz with minimum 40% marks to unlock your official verified certificate.
                        50 Questions • 45 Mins • 3 Attempts Allowed.
                        {quizResult?.extra?.attempt
                          ? ` (${Math.max(0, 3 - Number(quizResult.extra.attempt))} attempts remaining)`
                          : " (3 attempts available)"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    {quizResult && Number(quizResult.marks || 0) >= 40 && (
                      <Link href="/student/certificate">
                        <Button
                          variant="outline"
                          className="h-9 px-4 rounded-xl text-xs font-bold border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
                        >
                          <Award className="w-3.5 h-3.5 mr-1.5" />
                          View Certificate
                        </Button>
                      </Link>
                    )}

                    {/* Course feedback button for enrolled student */}
                    <Button
                      variant="outline"
                      onClick={() => setIsFeedbackModalOpen(true)}
                      className="h-9 px-3.5 rounded-xl text-xs font-bold border-purple-200 text-[#5B21F4] bg-purple-50/60 hover:bg-purple-100 cursor-pointer flex items-center gap-1.5"
                    >
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>Rate Course</span>
                    </Button>

                    {/* Quiz Button with 3 attempt logic */}
                    {Number(quizResult?.extra?.attempt || 0) >= 3 ? (
                      <Button
                        disabled
                        className="h-9 px-4.5 rounded-xl text-xs font-black bg-slate-200 text-slate-500 shadow-none cursor-not-allowed flex items-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Attempts Limit Reached (3/3)</span>
                      </Button>
                    ) : (
                      <Link href={`/student/online-courses/${courseId}/quiz`}>
                        <Button className="h-9 px-4.5 rounded-xl text-xs font-black bg-[#5B21F4] hover:bg-[#4C1BD4] text-white shadow-xs cursor-pointer flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5" />
                          <span>
                            {quizResult
                              ? `Retake Quiz Test (${Math.max(0, 3 - Number(quizResult.extra?.attempt || 1))} Left)`
                              : "Take Quiz Test (3 Attempts)"}
                          </span>
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════════
                RIGHT COLUMN (4 cols): Sticky Checkout & Registration Card (Only shown if NOT enrolled)
                ══════════════════════════════════════════════════════════════ */}
            {!isPurchased && (
              <div id="course-registration-card" className="lg:col-span-4 sticky top-6 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs group">
                  {/* ── Banner Image Container with 🔴 Online Badge ── */}
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
                          background: "linear-gradient(135deg, #1E1B4B 0%, #311042 55%, #0B3B82 100%)",
                        }}
                      >
                        <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-1">
                          <Play className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-[10px] font-mono text-purple-200 uppercase tracking-wider">
                          {course.course_code || "BRAINZIMA"}
                        </span>
                        <p className="text-xs font-black text-white line-clamp-1 max-w-[85%] mt-0.5">
                          {course.course_name}
                        </p>
                      </div>
                    )}

                    {/* Top-Left "🔴 Online" Badge (Pixel-perfect match to user reference image) */}
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-600/95 backdrop-blur-sm text-white font-extrabold text-[10px] sm:text-[11px] shadow-sm tracking-wide">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span>Online</span>
                    </div>
                  </div>

                  {/* ── Card Body (Exact Khan Global Studies UX) ── */}
                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Course Title */}
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug line-clamp-2">
                        {course.course_name}
                      </h3>
                    </div>

                    {/* Pricing Block */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        REGISTRATION FEE
                      </span>
                      <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                        <span className="text-2xl sm:text-3xl font-black text-[#0B3B82]">
                          ₹{netPayable.toLocaleString("en-IN")}/-
                        </span>
                        {originalFee > netPayable && (
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

                    {/* Feature Highlights with icons matching reference image */}
                    <div className="pt-2 border-t border-slate-100 space-y-2.5 text-xs text-slate-700">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Validity - {course.course_validity || course.course_duration || "12 Months"}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Radio className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Type - Live + Recorded</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Duration - {course.course_duration || "6 Months"}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Languages className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Language - English &amp; Hindi</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Award className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Certificate - Verified Brainzima Certificate</span>
                      </div>
                    </div>

                    {/* Coupon section if not purchased */}
                    <div className="pt-2 border-t border-slate-100">
                      <CouponOfferCards
                        courseType="online"
                        courseId={courseId}
                        courseFee={feeNum}
                        currentUser={
                          session
                            ? {
                                user_id: currentUserId,
                                email: session.email,
                                mobile: session.mobile,
                                role: currentUserRole,
                              }
                            : null
                        }
                        appliedCoupon={appliedCoupon}
                        onApplySuccess={(verified) => {
                          setAppliedCoupon(verified);
                          toast({
                            variant: "success",
                            title: "Online Coupon Applied",
                            description: `Coupon "${verified.coupon_code}" applied successfully!`,
                          });
                        }}
                        onRemoveCoupon={() => {
                          setAppliedCoupon(null);
                        }}
                      />
                    </div>

                    {/* Action Button: Buy Now */}
                    <div className="pt-1">
                      <Button
                        onClick={handleBuyCourse}
                        disabled={isProcessingPayment}
                        className="w-full h-11 rounded-xl text-sm font-black bg-[#0B3B82] hover:bg-[#072B60] text-white shadow-md cursor-pointer transition-all active:scale-[0.99]"
                      >
                        {isProcessingPayment ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            <span>Processing Order...</span>
                          </>
                        ) : (
                          <span>Buy Now</span>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile Syllabus Drawer (Bottom Sheet) ── */}
      <AnimatePresence>
        {isSyllabusMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-[100] flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSyllabusMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="relative z-10 bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl border-t border-slate-200 overflow-hidden"
            >
              <div className="pt-3 pb-1 flex justify-center shrink-0">
                <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
              </div>

              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#0B3B82] text-white flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Course Syllabus</h3>
                    <p className="text-[11px] text-slate-500">{syllabus.length} Lessons Available</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSyllabusMenuOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {syllabus.map((lesson) => {
                  const isSelected = lesson.syllabus_id === selectedLessonId;
                  const isFree = Number(lesson.topic_order) === 1;
                  const lock = checkLessonLockStatus(lesson.syllabus_id, syllabus, courseProgress, isPurchased);
                  const isAccessible = lock.isUnlocked;
                  const isCompleted = lock.isCompleted;

                  return (
                    <button
                      key={lesson.syllabus_id}
                      type="button"
                      onClick={() => {
                        handleSelectLesson(lesson);
                        document.getElementById("course-player")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl transition-all flex items-start gap-3 border cursor-pointer ${
                        isSelected
                          ? "bg-blue-50/70 border-blue-200 text-[#0B3B82]"
                          : "bg-white hover:bg-slate-50 border-slate-100 text-slate-800"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : isAccessible ? (
                          <Play className="w-4 h-4 fill-[#0B3B82] text-[#0B3B82]" />
                        ) : (
                          <Lock className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold truncate">
                            {lesson.topic_order}. {lesson.syllabus_title}
                          </span>
                          {isCompleted ? (
                            <Badge className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0 uppercase">
                              Done
                            </Badge>
                          ) : isFree ? (
                            <Badge className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0 uppercase">
                              Free
                            </Badge>
                          ) : null}
                        </div>
                        {lesson.syllabus_topic && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {lesson.syllabus_topic}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Admission & Enrollment Confirmed Modal ── */}
      <AnimatePresence>
        {enrollmentSuccess && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden relative"
            >
              <button
                onClick={() => setEnrollmentSuccess(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors z-10"
              >
                <X className="w-4 h-4" />
              </button>

              <div
                className="p-6 sm:p-8 text-center text-white relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #0B3B82 0%, #1E1B4B 100%)",
                }}
              >
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center mx-auto mb-2.5 shadow-lg">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <Badge className="bg-emerald-400/20 text-emerald-200 border-emerald-300/30 text-xs font-bold uppercase tracking-wider mb-1.5">
                  ✓ Enrollment Confirmed
                </Badge>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                  Welcome to the Course!
                </h3>
                <p className="text-xs text-blue-100 mt-1">
                  You now have complete lifetime access to all lessons and materials.
                </p>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Official Student Registration ID
                  </p>
                  <div className="mt-1.5 inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-[#0B3B82] font-mono font-black text-lg">
                    <span>{enrollmentSuccess.registration_number}</span>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-slate-500 text-[11px]">Enrolled Course</p>
                      <p className="font-bold text-slate-800 truncate mt-0.5 max-w-[200px]">
                        {enrollmentSuccess.course_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-[11px]">Amount Paid</p>
                      <p className="font-black text-emerald-700 text-sm mt-0.5">
                        ₹{enrollmentSuccess.amount_paid.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                  <Button
                    onClick={() => {
                      setEnrollmentSuccess(null);
                      document.getElementById("course-player")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="flex-1 font-bold text-xs bg-[#0B3B82] hover:bg-[#072B60] text-white py-5 rounded-xl"
                  >
                    <PlayCircle className="w-4 h-4 mr-1.5" />
                    <span>Watch Lessons Now</span>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Course Feedback Modal ── */}
      {course && (
        <CourseFeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          courseId={courseId}
          courseName={course.course_name}
          courseCode={course.course_code}
          currentUserId={currentUserId}
          currentUserRole="student"
          studentName={studentName || session?.name || "Student"}
        />
      )}
    </div>
  );
}
