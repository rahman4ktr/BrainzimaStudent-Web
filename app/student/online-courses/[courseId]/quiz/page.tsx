"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  CheckCircle2,
  Eye,
  AlertCircle,
  Loader2,
  Award,
  RefreshCw,
  Trophy,
  RotateCcw,
  BookOpen,
  LayoutGrid,
  Info,
  Sparkles,
  ArrowLeft,
  Bookmark,
  Check,
  Lock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Star,
  Maximize2,
  Minimize2,
  GraduationCap,
  Lightbulb,
  ChevronUp,
  LogOut,
} from "lucide-react";
import CourseFeedbackModal from "@/components/feedback/CourseFeedbackModal";
import confetti from "canvas-confetti";
import {
  getOnlineQuizQuestions,
  submitOnlineQuizResult,
  getOnlineCourseById,
  getOnlineCourses,
  getOnlineResults,
  getCurrentStudent,
  getStudentOnlineCourses,
  checkOnlineCourseAccess,
  type QuizQuestion,
  type OnlineResultRecord,
  type OnlineCourse,
} from "@/lib/api";
import { useStudent } from "@/hooks/useStudent";
import { getSession } from "@/lib/session";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TOTAL_QUESTIONS_COUNT = 50;
const MARKS_PER_QUESTION = 2;
const TOTAL_MARKS = TOTAL_QUESTIONS_COUNT * MARKS_PER_QUESTION; // 100 Marks
const QUIZ_DURATION_SECONDS = 45 * 60; // 45 Minutes
const OPTION_LETTERS = ["A", "B", "C", "D"];

export default function CourseSpecificQuizPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const resolvedParams = use(params);
  const courseId = Number(resolvedParams.courseId);
  const router = useRouter();
  const { toast } = useToast();

  const {
    user_id,
    student_id,
    name: studentName,
    registration_number: studentRegNo,
    role,
  } = useStudent();

  const session = getSession();
  const effectiveUserId = user_id || (session?.user_id ? Number(session.user_id) : 1);
  const effectiveStudentId = student_id || (session?.student_id ? Number(session.student_id) : effectiveUserId);
  const effectiveRole = role || session?.role || "student";

  // Course Details & Verification State
  const [course, setCourse] = useState<OnlineCourse | null>(null);
  const [isEnrolled, setIsEnrolled] = useState<boolean>(true); // default true while checking
  const [isVerifyingEnrollment, setIsVerifyingEnrollment] = useState<boolean>(true);

  // Quiz State
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [secondsRemaining, setSecondsRemaining] = useState<number>(QUIZ_DURATION_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedResult, setSubmittedResult] = useState<OnlineResultRecord | null>(null);
  const [reviewMode, setReviewMode] = useState<boolean>(false);
  const [currentAttemptNumber, setCurrentAttemptNumber] = useState<number>(1);
  const [isAttemptsExhausted, setIsAttemptsExhausted] = useState<boolean>(false);
  const [existingCourseResult, setExistingCourseResult] = useState<OnlineResultRecord | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // ── 1. Verify Enrollment & Load Course Data ──
  const verifyEnrollmentAndLoadCourse = useCallback(async () => {
    if (!courseId || isNaN(courseId)) {
      setError("Invalid course ID.");
      setLoading(false);
      return;
    }

    setIsVerifyingEnrollment(true);

    try {
      // 1. Fetch course details
      let matchedCourse: OnlineCourse | null = null;
      try {
        const cRes = await getOnlineCourseById(courseId);
        if (cRes.success && cRes.data) {
          matchedCourse = cRes.data;
        }
      } catch {
        /* fallback to list */
      }

      if (!matchedCourse) {
        const listRes = await getOnlineCourses();
        if (listRes.success && Array.isArray(listRes.data)) {
          matchedCourse = listRes.data.find((c) => Number(c.course_id) === courseId) || null;
        }
      }

      setCourse(matchedCourse);

      // 2. Verify if user is enrolled in this course
      let hasAccess = false;
      if (effectiveUserId > 0) {
        // Check A: Profile online_courses
        try {
          const stRes = await getCurrentStudent(effectiveUserId);
          if (stRes.success && Array.isArray(stRes.data?.online_courses)) {
            hasAccess = stRes.data.online_courses.some(
              (c: any) => Number(c.course_id ?? c.stco_course_id) === courseId
            );
          }
        } catch {
          /* ignore */
        }

        // Check B: Enrolled courses endpoint
        if (!hasAccess) {
          try {
            const enrRes = await getStudentOnlineCourses(effectiveUserId, "student");
            if (enrRes.success && Array.isArray(enrRes.data)) {
              hasAccess = enrRes.data.some(
                (c: any) => Number(c.course_id ?? c.stco_course_id) === courseId
              );
            }
          } catch {
            /* ignore */
          }
        }

        // Check C: Course access endpoint
        if (!hasAccess) {
          try {
            const accRes = await checkOnlineCourseAccess(
              courseId,
              effectiveUserId,
              effectiveRole as any
            );
            if (accRes.success && accRes.data?.purchased) {
              hasAccess = true;
            }
          } catch {
            /* ignore */
          }
        }
      }

      setIsEnrolled(hasAccess);
    } catch (err: any) {
      console.error("[CourseQuiz] Verification error:", err);
    } finally {
      setIsVerifyingEnrollment(false);
    }
  }, [courseId, effectiveUserId, effectiveRole]);

  // ── 2. Load 50 Random Questions Specifically for this Course ──
  const fetchQuizQuestions = useCallback(async () => {
    if (!courseId) return;

    setLoading(true);
    setError(null);

    try {
      // Calls /api/online-quiz-questions/random/50?course_id={courseId}
      const qRes = await getOnlineQuizQuestions(TOTAL_QUESTIONS_COUNT, courseId);

      if (qRes.success && Array.isArray(qRes.data) && qRes.data.length > 0) {
        setQuestions(qRes.data.slice(0, TOTAL_QUESTIONS_COUNT));
      } else {
        throw new Error("Unable to fetch quiz questions for this course.");
      }

      // Check existing attempts for THIS specific course
      try {
        const rRes = await getOnlineResults(
          {
            std_id: effectiveStudentId,
            user_id: effectiveUserId,
            course_id: courseId,
          },
          effectiveUserId,
          (effectiveRole as any) || "student",
          effectiveStudentId
        );
        if (rRes.success && Array.isArray(rRes.data?.results)) {
          const match = rRes.data.results.find(
            (r: any) => Number(r.course_id) === courseId
          );
          if (match) {
            setExistingCourseResult(match);
            const prevAttempt = Number(match.extra?.attempt || 1);
            if (prevAttempt >= 3) {
              setIsAttemptsExhausted(true);
            } else {
              setCurrentAttemptNumber(prevAttempt + 1);
            }
          } else {
            setExistingCourseResult(null);
            setCurrentAttemptNumber(1);
          }
        }
      } catch {
        /* ignore */
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load quiz questions.");
    } finally {
      setLoading(false);
    }
  }, [courseId, effectiveStudentId]);

  useEffect(() => {
    verifyEnrollmentAndLoadCourse();
    fetchQuizQuestions();
  }, [verifyEnrollmentAndLoadCourse, fetchQuizQuestions]);

  // ── 3. Countdown Timer ──
  useEffect(() => {
    if (loading || submittedResult || !questions.length || !isEnrolled) return;

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, submittedResult, questions.length, isEnrolled]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleSelectOption = (optionIndex: number) => {
    if (submittedResult && !reviewMode) return;
    setAnswers((prev) => ({
      ...prev,
      [currentIndex]: optionIndex,
    }));
  };

  const handleToggleMarkForReview = () => {
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(currentIndex)) {
        next.delete(currentIndex);
      } else {
        next.add(currentIndex);
      }
      return next;
    });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // ── 4. Submit Assessment ──
  const handleSubmitQuiz = async () => {
    if (isSubmitting || submittedResult) return;
    setIsSubmitting(true);

    if (timerRef.current) clearInterval(timerRef.current);

    let correctCount = 0;
    const answerBreakdown: Record<number, { selected: number; correct: number; isCorrect: boolean }> = {};

    questions.forEach((q, idx) => {
      const selected = answers[idx] || 0;
      const isCorrect = selected === q.quiz_correct_answer;
      if (isCorrect) correctCount += 1;

      answerBreakdown[q.quiz_id] = {
        selected,
        correct: q.quiz_correct_answer || 0,
        isCorrect,
      };
    });

    const marksScored = correctCount * MARKS_PER_QUESTION;
    const percentage = Math.round((marksScored / TOTAL_MARKS) * 100);
    const passed = percentage >= 40;
    const timeSpent = QUIZ_DURATION_SECONDS - secondsRemaining;

    const payload = {
      std_id: effectiveStudentId,
      user_id: effectiveUserId,
      course_id: courseId,
      marks: marksScored,
      extra: {
        total_questions: questions.length,
        correct_count: correctCount,
        wrong_count: questions.length - correctCount,
        percentage,
        grade: percentage >= 80 ? "A+" : percentage >= 60 ? "A" : percentage >= 40 ? "B" : "F",
        status: passed ? "PASSED" : "FAILED",
        passed,
        attempt: currentAttemptNumber,
        time_spent_seconds: timeSpent,
        time_spent_formatted: `${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s`,
        submitted_at: new Date().toISOString(),
        course_name: course?.course_name || "Online Course",
        answer_breakdown: answerBreakdown,
      },
    };

    try {
      const res = await submitOnlineQuizResult(payload);
      if (res.success && res.data) {
        setSubmittedResult(res.data);
      } else {
        setSubmittedResult({
          result_id: Date.now(),
          std_id: effectiveStudentId,
          user_id: effectiveUserId,
          course_id: courseId,
          marks: marksScored,
          created_at: new Date().toISOString(),
          extra: payload.extra,
        } as any);
      }

      if (passed) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      }

      toast({
        variant: passed ? "success" : "warning",
        title: passed ? "🎉 Assessment Passed!" : "Assessment Completed",
        description: passed
          ? `Congratulations! You scored ${marksScored}/${TOTAL_MARKS} (${percentage}%). Your certificate is unlocked!`
          : `You scored ${marksScored}/${TOTAL_MARKS} (${percentage}%). Minimum 40% required to pass.`,
      });

      // Automatically invite enrolled student to provide feedback after 1.5 seconds
      setTimeout(() => {
        setIsFeedbackModalOpen(true);
      }, 1500);
    } catch (err: any) {
      console.error("[CourseQuiz] Submit error:", err);
      setSubmittedResult({
        result_id: Date.now(),
        std_id: effectiveStudentId,
        user_id: effectiveUserId,
        course_id: courseId,
        marks: marksScored,
        created_at: new Date().toISOString(),
        extra: payload.extra,
      } as any);
    } finally {
      setIsSubmitting(false);
    }
  };

  const answeredCount = Object.keys(answers).length;
  const currentQuestion = questions[currentIndex] || null;

  // ── Render Enrollment Check ──
  if (!isVerifyingEnrollment && !isEnrolled) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Link
          href={`/student/online-courses/${courseId}`}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 hover:text-[#0B3B82] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Course</span>
        </Link>

        <div className="p-8 sm:p-12 rounded-2xl bg-white border border-slate-200 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20 shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Course Enrollment Required
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              This online examination is exclusively available for students enrolled in{" "}
              <span className="font-bold text-slate-800">{course?.course_name || "this course"}</span>.
              Please enroll to take the quiz and earn your verified certificate.
            </p>
          </div>
          <div className="pt-2">
            <Link href={`/student/online-courses/${courseId}`}>
              <Button className="h-11 px-6 rounded-xl font-bold text-sm bg-[#0B3B82] hover:bg-[#072B60] text-white shadow-md">
                View Course &amp; Enroll
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Render Maximum Attempts Limit Reached (3 of 3 attempts completed) ──
  if (!loading && isAttemptsExhausted) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Link
          href={`/student/online-courses/${courseId}`}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 hover:text-[#0B3B82] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Course</span>
        </Link>

        <div className="p-8 sm:p-12 rounded-2xl bg-white border border-slate-200 shadow-xs text-center space-y-5">
          <div className="w-16 h-16 rounded-xl bg-purple-500/10 text-[#5B21F4] flex items-center justify-center mx-auto border border-purple-200 shadow-xs">
            <Trophy className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <Badge className="bg-purple-100 text-[#5B21F4] border-purple-200 text-xs font-bold uppercase mb-1">
              3 of 3 Attempts Completed
            </Badge>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Maximum Attempts Reached
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              You have completed all 3 permitted quiz examination attempts for{" "}
              <span className="font-bold text-slate-800">{course?.course_name || "this course"}</span>.
            </p>
            {existingCourseResult && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 inline-block">
                <span className="text-xs text-slate-500 font-medium">Recorded Score: </span>
                <span className="text-sm font-black text-slate-900">
                  {existingCourseResult.marks}/100 Marks (
                  {existingCourseResult.extra?.percentage || existingCourseResult.marks}%)
                </span>
                <span
                  className={`ml-2 text-xs font-bold ${
                    existingCourseResult.extra?.passed ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  • {existingCourseResult.extra?.passed ? "PASSED" : "COMPLETED"}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3 pt-3 flex-wrap">
            {existingCourseResult?.extra?.passed && (
              <Link href="/student/certificate">
                <Button className="h-11 px-5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  View Verified Certificate
                </Button>
              </Link>
            )}

            <Button
              onClick={() => setIsFeedbackModalOpen(true)}
              className="h-11 px-5 rounded-xl font-bold text-xs sm:text-sm border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 shadow-sm flex items-center gap-2"
            >
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              Give Course Review
            </Button>

            <Link href={`/student/online-courses/${courseId}`}>
              <Button variant="outline" className="h-11 px-5 rounded-xl font-bold text-xs sm:text-sm border-slate-200">
                Back to Course
              </Button>
            </Link>
          </div>
        </div>

        {/* Course Feedback Modal */}
        <CourseFeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          courseId={courseId}
          courseName={course?.course_name || "Online Course"}
          courseCode={course?.course_code}
          currentUserId={effectiveUserId}
          currentUserRole={(effectiveRole as any) || "student"}
          studentName={session?.name || studentName || "Student"}
          onFeedbackSubmitted={() => {
            toast({
              variant: "success",
              title: "Feedback Recorded",
              description: "Your course review and rating have been stored in the database.",
            });
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative overflow-x-hidden flex flex-col p-2 sm:p-3 md:p-4 space-y-2.5 sm:space-y-3"
      style={{
        background:
          "radial-gradient(circle at 10% 15%, rgba(233, 226, 255, 0.6) 0%, transparent 40%), radial-gradient(circle at 90% 85%, rgba(225, 215, 254, 0.5) 0%, transparent 45%), radial-gradient(circle at 85% 15%, rgba(215, 225, 255, 0.4) 0%, transparent 40%), #F8F6FD",
      }}
    >
      {/* ── Background Decorative Vector Waves & Dot Matrix Grids (Matches Design) ── */}
      <svg
        className="absolute -bottom-16 -left-16 w-[480px] h-[360px] text-[#EDE7FB] opacity-80 pointer-events-none -z-0"
        viewBox="0 0 500 400"
        fill="currentColor"
      >
        <path d="M0,150 C180,240 220,60 380,180 C440,230 480,260 500,400 L0,400 Z" />
      </svg>

      <svg
        className="absolute top-0 right-0 w-[440px] h-[380px] text-[#EFEAFB] opacity-70 pointer-events-none -z-0"
        viewBox="0 0 450 400"
        fill="currentColor"
      >
        <path d="M80,0 C160,140 300,90 350,220 C390,290 420,320 450,400 L450,0 Z" />
      </svg>

      <svg
        className="absolute -bottom-12 -right-12 w-[360px] h-[280px] text-[#EDE7FB] opacity-60 pointer-events-none -z-0"
        viewBox="0 0 400 300"
        fill="currentColor"
      >
        <path d="M80,300 C180,200 240,240 340,160 C380,120 400,100 400,300 Z" />
      </svg>

      {/* Dot matrix grids behind cards */}
      <div className="absolute top-20 left-4 sm:left-8 w-36 h-48 bg-[radial-gradient(#c4b5fd_1.5px,transparent_1.5px)] [background-size:14px_14px] opacity-40 pointer-events-none -z-0" />
      <div className="absolute top-36 right-4 sm:right-8 w-44 h-64 bg-[radial-gradient(#c4b5fd_1.5px,transparent_1.5px)] [background-size:14px_14px] opacity-40 pointer-events-none -z-0" />
      <div className="absolute bottom-24 left-1/3 w-32 h-32 bg-[radial-gradient(#c4b5fd_1.5px,transparent_1.5px)] [background-size:14px_14px] opacity-25 pointer-events-none -z-0" />

      {/* ── Top Examination Portal Navigation Card (Floating Rounded Card - Compact) ── */}
      <header className="relative z-10 max-w-screen-2xl mx-auto w-full bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2.5 sm:gap-4">
        {/* Left: Portal Brand & Course Info */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-[#5B21F4] flex items-center justify-center text-white shrink-0 shadow-xs">
            <GraduationCap className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[11px] sm:text-xs font-black tracking-wide text-slate-900 uppercase">
              Brainzima Examination
            </h1>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 truncate max-w-[130px] sm:max-w-xs md:max-w-sm">
              {course?.course_name || "Online Course Examination"}
            </p>
          </div>
        </div>

        {/* Center: Live Progress Bar & Marks (Desktop/Tablet) */}
        {!submittedResult && questions.length > 0 && (
          <div className="hidden lg:flex flex-col items-center gap-0.5 min-w-[200px] max-w-[260px] w-full">
            <div className="flex items-center justify-between w-full text-[10px] sm:text-[11px] font-bold text-slate-700">
              <span>Question {currentIndex + 1} of {questions.length}</span>
              <span className="text-[#5B21F4] font-black">
                {Math.round(((currentIndex + 1) / questions.length) * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#5B21F4] rounded-full transition-all duration-300"
                style={{ width: `${Math.round(((currentIndex + 1) / questions.length) * 100)}%` }}
              />
            </div>
            <span className="text-[9px] text-slate-400 font-medium">
              {TOTAL_QUESTIONS_COUNT} Qs • 45 Mins • {TOTAL_MARKS} Marks
            </span>
          </div>
        )}

        {/* Right: Timer, Fullscreen, and Exit Exam */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Live Countdown Timer */}
          {!submittedResult ? (
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl bg-[#F6F4FD] border border-purple-100 text-[#5B21F4]">
              <Clock className="w-3.5 h-3.5 text-[#5B21F4] shrink-0" />
              <div className="flex flex-col items-start leading-none">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider hidden sm:block">
                  Time Left
                </span>
                <span className="text-xs sm:text-sm font-black font-mono tracking-wide">
                  {formatTimer(secondsRemaining)}
                </span>
              </div>
            </div>
          ) : (
            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] sm:text-xs px-2 py-0.5 font-bold">
              ✓ Done
            </Badge>
          )}

          {/* Fullscreen Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 sm:h-8.5 px-2 sm:px-2.5 text-[11px] sm:text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg sm:rounded-xl cursor-pointer flex items-center gap-1"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Exit</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Fullscreen</span>
              </>
            )}
          </Button>

          {/* Exit Exam Button */}
          <Link href={`/student/online-courses/${courseId}`}>
            <Button
              variant="outline"
              size="sm"
              className="h-8 sm:h-8.5 px-2 sm:px-2.5 text-[11px] sm:text-xs font-bold border-rose-200 text-rose-600 bg-rose-50/50 hover:bg-rose-100/70 hover:border-rose-300 rounded-lg sm:rounded-xl cursor-pointer flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Examination Layout Body */}
      <main className="relative z-10 flex-1 max-w-screen-2xl mx-auto w-full space-y-3">
        {/* ── Loading Skeleton ── */}
        {loading && (
          <div className="space-y-3">
            <div className="p-4 rounded-xl sm:rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 space-y-2">
              <div className="h-5 w-1/3 bg-slate-200 rounded animate-pulse" />
              <div className="h-3.5 w-1/2 bg-slate-100 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-8 h-80 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-xl sm:rounded-2xl animate-pulse" />
              <div className="md:col-span-4 h-80 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-xl sm:rounded-2xl animate-pulse" />
            </div>
          </div>
        )}

        {/* ── Error Banner ── */}
        {!loading && error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <p className="text-xs sm:text-sm font-semibold">{error}</p>
            </div>
            <Button
              size="sm"
              onClick={fetchQuizQuestions}
              className="h-7.5 px-3 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          </div>
        )}

        {/* ── Active Quiz / Review Mode ── */}
        {!loading && !error && questions.length > 0 && (
          <div className="space-y-3">
            {/* ── Scorecard (Shown after submission) ── */}
            {submittedResult && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md ${
                        submittedResult.extra?.passed ? "bg-emerald-600" : "bg-rose-600"
                      }`}
                    >
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-black text-slate-900">
                          Assessment Completed!
                        </h2>
                        <Badge
                          className={`text-[10px] font-black uppercase px-2 py-0.5 ${
                            submittedResult.extra?.passed
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : "bg-rose-100 text-rose-800 border-rose-200"
                          }`}
                        >
                          {(submittedResult.extra as any)?.status || (submittedResult.extra?.passed ? "PASSED" : "FAILED")}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {submittedResult.extra?.passed
                          ? `You scored ${submittedResult.marks}/100 (${submittedResult.extra?.percentage}%). Your verified certificate is unlocked!`
                          : "You did not achieve the minimum 40% passing grade. You can review your answers or retake the test."}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:px-4">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Total Score
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-[#0B3B82]">
                      {submittedResult.marks}
                      <span className="text-xs text-slate-400 font-medium">/{TOTAL_MARKS}</span>
                    </span>
                    <span className="block text-[11px] font-bold text-emerald-600">
                      {submittedResult.extra?.percentage}% Score
                    </span>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-lg bg-purple-50/60 border border-purple-100 text-center">
                    <span className="text-[9px] font-bold uppercase text-purple-700 tracking-wider">
                      Total Questions
                    </span>
                    <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">{questions.length}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 text-center">
                    <span className="text-[9px] font-bold uppercase text-emerald-700 tracking-wider">
                      Correct Answers
                    </span>
                    <p className="text-base sm:text-lg font-black text-emerald-700 mt-0.5">
                      {(submittedResult.extra as any)?.correct_count ?? 0}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-50/60 border border-rose-100 text-center">
                    <span className="text-[9px] font-bold uppercase text-rose-700 tracking-wider">
                      Wrong Answers
                    </span>
                    <p className="text-base sm:text-lg font-black text-rose-700 mt-0.5">
                      {(submittedResult.extra as any)?.wrong_count ?? 0}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-100 text-center">
                    <span className="text-[9px] font-bold uppercase text-blue-700 tracking-wider">
                      Time Spent
                    </span>
                    <p className="text-base sm:text-lg font-black text-blue-700 mt-0.5">
                      {(submittedResult.extra as any)?.time_spent_formatted || "—"}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => setReviewMode(!reviewMode)}
                    className="h-8.5 rounded-lg text-xs font-bold gap-1.5 border-slate-200 text-slate-700"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>{reviewMode ? "Exit Answer Review" : "Review Answers"}</span>
                  </Button>

                  <div className="flex items-center gap-2 flex-wrap">
                    {submittedResult.extra?.passed ? (
                      <Link href="/student/certificate">
                        <Button className="h-8.5 rounded-lg text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs">
                          <Award className="w-3.5 h-3.5" />
                          <span>View Verified Certificate</span>
                        </Button>
                      </Link>
                    ) : currentAttemptNumber < 3 ? (
                      <Button
                        onClick={() => {
                          setSubmittedResult(null);
                          setAnswers({});
                          setMarkedForReview(new Set());
                          setCurrentIndex(0);
                          setSecondsRemaining(QUIZ_DURATION_SECONDS);
                          fetchQuizQuestions();
                        }}
                        className="h-8.5 rounded-lg text-xs font-bold gap-1.5 bg-[#0B3B82] hover:bg-[#072B60] text-white shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retake Quiz (Attempt {currentAttemptNumber + 1}/3)</span>
                      </Button>
                    ) : null}

                    {/* Course feedback button */}
                    <Button
                      onClick={() => setIsFeedbackModalOpen(true)}
                      className="h-8.5 rounded-lg text-xs font-bold gap-1.5 border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 shadow-xs cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>Rate Course</span>
                    </Button>

                    <Link href={`/student/online-courses/${courseId}`}>
                      <Button variant="outline" className="h-8.5 rounded-lg text-xs font-bold border-slate-200">
                        Back to Course
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Main Examination Layout (Side-by-Side: Left: Question Card, Right: Palette) ── */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 lg:gap-4 items-start">
              {/* ══════════════════════════════════════════════════════════════
                  LEFT COLUMN (8 cols lg / 7 cols md): Question Card & Options (Compact)
                  ══════════════════════════════════════════════════════════════ */}
              <div className="md:col-span-7 lg:col-span-8 space-y-3">
                <div className="p-3.5 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-xs space-y-3.5 sm:space-y-4">
                  {/* Question Header */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-lg bg-[#F4EEFF] text-[#5B21F4] border border-purple-100 text-[11px] sm:text-xs font-bold">
                      Question {currentIndex + 1} of {questions.length}
                    </span>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={handleToggleMarkForReview}
                        className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer"
                        title="Mark for Review"
                      >
                        <Bookmark
                          className={`w-3.5 h-3.5 ${
                            markedForReview.has(currentIndex)
                              ? "fill-[#5B21F4] text-[#5B21F4]"
                              : "text-slate-500"
                          }`}
                        />
                      </button>
                      <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 text-[11px] sm:text-xs font-bold">
                        {MARKS_PER_QUESTION} Marks
                      </span>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                      {currentQuestion?.quiz_questions}
                    </h2>
                  </div>

                  {/* 4 Options with [A], [B], [C], [D] Badges (Compact) */}
                  <div className="space-y-2 sm:space-y-2.5 pt-0.5">
                    {[1, 2, 3, 4].map((optNum) => {
                      const optKey = `quiz_option_${optNum}` as keyof QuizQuestion;
                      const optText = currentQuestion ? (currentQuestion[optKey] as string) : "";
                      if (!optText) return null;

                      const letter = OPTION_LETTERS[optNum - 1];
                      const isSelected = answers[currentIndex] === optNum;
                      const isCorrectAnswer = currentQuestion?.quiz_correct_answer === optNum;

                      let containerStyle =
                        "border-slate-200/90 bg-white hover:border-[#5B21F4]/40 hover:bg-slate-50/50 text-slate-800";
                      let letterBadgeStyle =
                        "bg-slate-100 text-slate-700 border border-slate-200/80";

                      if (reviewMode) {
                        if (isCorrectAnswer) {
                          containerStyle =
                            "border-emerald-500 bg-emerald-50/70 text-emerald-900 font-semibold ring-1 ring-emerald-500/20";
                          letterBadgeStyle = "bg-emerald-600 text-white border-emerald-600";
                        } else if (isSelected && !isCorrectAnswer) {
                          containerStyle =
                            "border-rose-400 bg-rose-50/70 text-rose-900 ring-1 ring-rose-400/20";
                          letterBadgeStyle = "bg-rose-600 text-white border-rose-600";
                        }
                      } else if (isSelected) {
                        containerStyle =
                          "border-[#5B21F4] bg-[#F7F4FE] text-slate-950 font-bold ring-1 ring-[#5B21F4]/30 shadow-xs";
                        letterBadgeStyle = "bg-[#5B21F4] text-white border-[#5B21F4] shadow-xs";
                      }

                      return (
                        <button
                          key={optNum}
                          type="button"
                          onClick={() => handleSelectOption(optNum)}
                          className={`w-full text-left p-2.5 sm:p-3 rounded-lg sm:rounded-xl border transition-all flex items-center justify-between gap-2.5 sm:gap-3 cursor-pointer ${containerStyle}`}
                        >
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                            <span
                              className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-md sm:rounded-lg text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${letterBadgeStyle}`}
                            >
                              {letter}
                            </span>
                            <span className="text-xs sm:text-sm font-semibold leading-relaxed flex-1">
                              {optText}
                            </span>
                          </div>

                          {/* Selected Indicator / Review Badges */}
                          {!reviewMode && isSelected && (
                            <div className="w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full bg-[#5B21F4] text-white flex items-center justify-center shrink-0 shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                          {reviewMode && isCorrectAnswer && (
                            <Badge className="bg-emerald-600 text-white text-[9px] sm:text-[10px] uppercase font-bold shrink-0">
                              ✓ Correct
                            </Badge>
                          )}
                          {reviewMode && isSelected && !isCorrectAnswer && (
                            <Badge className="bg-rose-600 text-white text-[9px] sm:text-[10px] uppercase font-bold shrink-0">
                              ✗ Your Answer
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Bottom Navigation Buttons */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      disabled={currentIndex === 0}
                      className="h-8.5 sm:h-9 px-3 sm:px-4 rounded-lg sm:rounded-xl text-xs font-bold border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                      <span>Previous</span>
                    </Button>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Button
                        variant="outline"
                        onClick={handleToggleMarkForReview}
                        className={`h-8.5 sm:h-9 px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl text-xs font-bold gap-1 border transition-all cursor-pointer ${
                          markedForReview.has(currentIndex)
                            ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                            : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <Bookmark className="w-3 h-3" />
                        <span>
                          {markedForReview.has(currentIndex) ? "Marked" : "Mark Review"}
                        </span>
                      </Button>

                      <Button
                        onClick={handleNext}
                        disabled={currentIndex === questions.length - 1}
                        className="h-8.5 sm:h-9 px-3.5 sm:px-4.5 rounded-lg sm:rounded-xl text-xs font-bold bg-[#5B21F4] hover:bg-[#4C1BD4] text-white shadow-xs cursor-pointer disabled:opacity-40 flex items-center gap-1"
                      >
                        <span>Save &amp; Next</span>
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════
                  RIGHT COLUMN (4 cols lg / 5 cols md): Question Palette & Submit Action
                  ══════════════════════════════════════════════════════════════ */}
              <div className="md:col-span-5 lg:col-span-4 space-y-3">
                {/* Question Palette Card (ALL 50 VISIBLE, ZERO SCROLLBAR - Compact) */}
                <div className="p-3 sm:p-3.5 md:p-4 rounded-xl sm:rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <LayoutGrid className="w-3.5 h-3.5 text-[#5B21F4]" />
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900">Question Palette</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] sm:text-[11px] font-bold text-slate-600">
                      {answeredCount}/{questions.length} Answered
                    </span>
                  </div>

                  {/* 50 Question Buttons Grid (5 columns x 10 rows) - NO SCROLLBAR, all 50 questions directly visible */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {questions.map((_, idx) => {
                      const isCurrent = idx === currentIndex;
                      const isAnswered = answers[idx] !== undefined;
                      const isMarked = markedForReview.has(idx);

                      let btnStyle =
                        "bg-[#F0F3F9] text-slate-700 border-slate-200/70 hover:bg-slate-200/60";

                      if (isCurrent) {
                        btnStyle =
                          "bg-[#5B21F4] text-white border-[#5B21F4] font-black shadow-xs ring-2 ring-[#5B21F4]/30 scale-[1.03]";
                      } else if (isMarked) {
                        btnStyle =
                          "bg-purple-100 text-[#5B21F4] border-purple-200 font-bold hover:bg-purple-200/70";
                      } else if (isAnswered) {
                        btnStyle =
                          "bg-emerald-500 text-white border-emerald-500 font-bold hover:bg-emerald-600";
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCurrentIndex(idx)}
                          className={`h-6.5 sm:h-7 md:h-7.5 rounded-md sm:rounded-lg border text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${btnStyle}`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>

                  {/* Palette Color Legend */}
                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-1.5 text-[9px] sm:text-[10px] text-slate-600 font-medium">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span>Answered ({answeredCount})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#5B21F4] shrink-0" />
                      <span>Current ({currentIndex + 1})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-100 border border-blue-300 shrink-0" />
                      <span>Marked ({markedForReview.size})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-200 border border-slate-300 shrink-0" />
                      <span>Unanswered ({questions.length - answeredCount})</span>
                    </div>
                  </div>
                </div>

                {/* Exam Guidelines Card */}
                <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-xs space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-[#5B21F4]" />
                      <span className="text-xs">Exam Guidelines</span>
                    </div>
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <ul className="space-y-1 text-[10px] sm:text-[11px] text-slate-500">
                    <li>• Choose one answer per question.</li>
                    <li>• You can review and change answers before submitting.</li>
                    <li>• Click on &quot;Save &amp; Next&quot; to proceed to the next question.</li>
                  </ul>
                </div>

                {/* Submit Final Examination Action Button */}
                {!submittedResult && (
                  <Button
                    onClick={handleSubmitQuiz}
                    disabled={isSubmitting}
                    className="w-full h-9.5 sm:h-10 rounded-xl text-xs sm:text-sm font-black bg-[#5B21F4] hover:bg-[#4C1BD4] text-white shadow-md cursor-pointer transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        <span>Evaluating Responses...</span>
                      </>
                    ) : (
                      <>
                        <Trophy className="w-3.5 h-3.5" />
                        <span>Submit Final Examination</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Course Feedback & Review Modal ── */}
      <CourseFeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        courseId={courseId}
        courseName={course?.course_name || "Online Course"}
        courseCode={course?.course_code}
        currentUserId={effectiveUserId}
        currentUserRole={(effectiveRole as any) || "student"}
        studentName={session?.name || studentName || "Student"}
        onFeedbackSubmitted={() => {
          toast({
            variant: "success",
            title: "Feedback Recorded",
            description: "Your course review and rating have been stored in the database.",
          });
        }}
      />
    </div>
  );
}
