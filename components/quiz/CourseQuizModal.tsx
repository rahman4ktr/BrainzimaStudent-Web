"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code,
  Clock,
  ListOrdered,
  Star,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  CheckCircle2,
  Eye,
  Send,
  X,
  AlertCircle,
  Loader2,
  Award,
  RefreshCw,
  Trophy,
  Check,
  RotateCcw,
  Lock,
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  getOnlineQuizQuestions,
  submitOnlineQuizResult,
  type QuizQuestion,
  type OnlineResultRecord,
} from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CourseQuizModalProps {
  isOpen: boolean;
  inline?: boolean;
  onClose: () => void;
  courseId: number;
  courseName: string;
  courseCode?: string;
  currentUserId?: number;
  currentStudentId?: number;
  currentUserRole?: "user" | "student" | "admin";
  studentName?: string;
  registrationNumber?: string;
  existingResult?: OnlineResultRecord | null;
  isPurchased?: boolean;
  onBuyCourse?: () => void;
  onQuizCompleted?: (result: OnlineResultRecord) => void;
  onNavigateToCertificate?: () => void;
}

const TOTAL_QUESTIONS_COUNT = 50;
const MARKS_PER_QUESTION = 2;
const TOTAL_MARKS = TOTAL_QUESTIONS_COUNT * MARKS_PER_QUESTION; // 100 Marks
const QUIZ_DURATION_SECONDS = 45 * 60; // 45 Minutes

export default function CourseQuizModal({
  isOpen,
  inline = false,
  onClose,
  courseId,
  courseName,
  courseCode,
  currentUserId,
  currentStudentId,
  currentUserRole = "student",
  studentName = "Student",
  registrationNumber,
  existingResult,
  isPurchased = true,
  onBuyCourse,
  onQuizCompleted,
  onNavigateToCertificate,
}: CourseQuizModalProps) {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent background scrolling ONLY when in floating modal mode
  useEffect(() => {
    if (!inline && isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, inline]);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [reviewMarked, setReviewMarked] = useState<Record<number, boolean>>({});

  const [secondsRemaining, setSecondsRemaining] = useState<number>(QUIZ_DURATION_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState<boolean>(false);

  // Result state after submission
  const [submittedResult, setSubmittedResult] = useState<OnlineResultRecord | null>(null);
  const [showResultsScreen, setShowResultsScreen] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Determine current attempt
  const currentAttemptNumber = useMemo(() => {
    if (existingResult?.extra?.attempt) {
      return existingResult.extra.attempt;
    }
    return 1;
  }, [existingResult]);

  // Load questions on open
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedAnswers({});
    setReviewMarked({});
    setCurrentIndex(0);
    setSecondsRemaining(QUIZ_DURATION_SECONDS);
    setShowResultsScreen(false);
    setSubmittedResult(null);

    try {
      const res = await getOnlineQuizQuestions(TOTAL_QUESTIONS_COUNT, courseId);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setQuestions(res.data);
      } else {
        throw new Error(res.message || "Failed to load quiz questions.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load quiz questions from server.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (isOpen) {
      fetchQuestions();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, fetchQuestions]);

  // Countdown timer logic
  useEffect(() => {
    if (!isOpen || loading || showResultsScreen || isSubmitting) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleFinalSubmit(true); // Auto-submit when time expires
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, loading, showResultsScreen, isSubmitting]);

  // Format time MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const currentQ = questions[currentIndex];

  // Palette status calculator
  const getQuestionStatus = (idx: number) => {
    if (idx === currentIndex) return "current";
    if (reviewMarked[idx]) return "review";
    if (selectedAnswers[idx] !== undefined) return "answered";
    return "unanswered";
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const reviewCount = Object.values(reviewMarked).filter(Boolean).length;
  const unansweredCount = questions.length - answeredCount;

  // Toggle option selection
  const handleSelectOption = (optNum: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: optNum,
    }));
  };

  // Toggle review mark
  const toggleReview = () => {
    setReviewMarked((prev) => ({
      ...prev,
      [currentIndex]: !prev[currentIndex],
    }));
  };

  // Navigation handlers
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Submit Logic
  const handleFinalSubmit = async (isTimeUp: boolean = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setShowConfirmSubmit(false);

    let correctCount = 0;
    questions.forEach((q, idx) => {
      const userChoice = selectedAnswers[idx];
      if (userChoice !== undefined && q.quiz_correct_answer !== undefined) {
        if (Number(userChoice) === Number(q.quiz_correct_answer)) {
          correctCount++;
        }
      } else if (userChoice !== undefined && !q.quiz_correct_answer) {
        // Fallback for simulated questions without correct answer explicitly provided
        correctCount++;
      }
    });

    const marksScored = correctCount * MARKS_PER_QUESTION;
    const percentage = Math.round((marksScored / TOTAL_MARKS) * 100);
    const passed = percentage >= 40;

    const payload = {
      std_id: currentStudentId || currentUserId || 1,
      user_id: currentUserId,
      course_id: courseId,
      marks: marksScored,
      extra: {
        total_questions: questions.length,
        correct: correctCount,
        wrong: questions.length - correctCount,
        unanswered: unansweredCount,
        marks_per_question: MARKS_PER_QUESTION,
        total_marks: TOTAL_MARKS,
        percentage,
        passed,
        duration_minutes: Math.ceil((QUIZ_DURATION_SECONDS - secondsRemaining) / 60),
        time_spent_seconds: QUIZ_DURATION_SECONDS - secondsRemaining,
        completed_at: new Date().toISOString(),
      },
      st_name: studentName,
      st_regno: registrationNumber || (currentUserId ? `BISR${String(currentUserId).padStart(4, "0")}` : undefined),
      course_name: courseName,
      course_code: courseCode,
    };

    try {
      const res = await submitOnlineQuizResult(
        payload,
        currentUserId,
        currentUserRole,
        currentStudentId
      );

      if (res.success && res.data) {
        setSubmittedResult(res.data);
        setShowResultsScreen(true);
        if (onQuizCompleted) {
          onQuizCompleted(res.data);
        }

        // Trigger celebratory confetti if passed
        if (passed) {
          try {
            confetti({
              particleCount: 120,
              spread: 80,
              origin: { y: 0.6 },
              colors: ["#5B21F4", "#7C3AED", "#10B981", "#F59E0B"],
            });
          } catch {
            /* ignore confetti error */
          }
        }

        toast({
          variant: "success",
          title: passed ? "Quiz Passed!" : "Quiz Completed",
          description: isTimeUp
            ? "Time was up! Your answers were automatically submitted."
            : `You scored ${marksScored}/${TOTAL_MARKS} marks (${percentage}%).`,
        });
      } else {
        throw new Error(res.message || "Failed to record quiz results.");
      }
    } catch (submitErr: any) {
      toast({
        variant: "error",
        title: "Submission Error",
        description: submitErr?.message || "Could not save your quiz. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  if (isPurchased === false) {
    const unpurchasedCard = (
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-6 text-center space-y-4 mx-auto my-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            Course Enrollment Required
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            The final examination quiz and accredited certificate are only available to enrolled students of <strong>{courseName}</strong>. Please purchase or unlock this course to take the test.
          </p>
        </div>
        <div className="flex gap-2.5 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Close
          </Button>
          {onBuyCourse && (
            <Button
              onClick={() => {
                onClose();
                onBuyCourse();
              }}
              className="flex-1 rounded-xl text-xs font-bold bg-[#5B21F4] hover:bg-[#4C1BD4] text-white shadow-md shadow-[#5B21F4]/20"
            >
              Unlock Course
            </Button>
          )}
        </div>
      </div>
    );

    if (inline) {
      return unpurchasedCard;
    }

    return createPortal(
      <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
        {unpurchasedCard}
      </div>,
      document.body
    );
  }

  const innerQuizCard = (
    <div className={`relative w-full ${inline ? "shadow-sm" : "max-w-6xl shadow-2xl max-h-[94vh]"} bg-[#F8FAFC] rounded-3xl border border-slate-200/80 flex flex-col overflow-hidden`}>
      {/* ── TOP HEADER (Pixel-perfect to user design) ── */}
        <div className="bg-white px-4 sm:px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left: Code Icon + Quiz Title + Subtitle */}
            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-[#5B21F4]/15"
                style={{
                  background:
                    "linear-gradient(135deg, #F1EEFF 0%, #EDE9FE 100%)",
                  color: "#5B21F4",
                }}
              >
                <Code className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    {courseName} Quiz
                  </h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-[#5B21F4] border border-purple-200">
                    Attempt {submittedResult?.extra?.attempt || currentAttemptNumber} of 3
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Test your knowledge and track your progress
                </p>
              </div>
            </div>

            {/* Right: Time Left Badge & Close Button */}
            <div className="flex items-center justify-between md:justify-end gap-3">
              <div
                className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl border transition-colors ${
                  secondsRemaining < 300
                    ? "bg-rose-50 border-rose-200 text-rose-600 animate-pulse"
                    : "bg-[#F1EEFF] border-[#DDD6FE] text-[#5B21F4]"
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-white/80 flex items-center justify-center shadow-xs">
                  <Clock className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="text-left">
                  <span className="text-[9px] font-bold uppercase tracking-wider block opacity-75">
                    Time left
                  </span>
                  <span className="text-base sm:text-lg font-black tracking-tight font-mono">
                    {formatTime(secondsRemaining)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (answeredCount > 0 && !showResultsScreen) {
                      if (confirm("Are you sure you want to exit the quiz? Unsubmitted answers will be lost.")) {
                        onClose();
                      }
                    } else {
                      onClose();
                    }
                  }}
                  className="rounded-xl text-xs font-bold gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-100 h-9 px-3 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back to Lectures</span>
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    if (answeredCount > 0 && !showResultsScreen) {
                      if (confirm("Are you sure you want to exit the quiz? Unsubmitted answers will be lost.")) {
                        onClose();
                      }
                    } else {
                      onClose();
                    }
                  }}
                  className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                  title="Exit Quiz"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Subheader: Stat Pills & Live Question Progress Bar */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Stat Pills */}
            <div className="flex items-center gap-4 sm:gap-6 text-xs text-slate-600 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-purple-50 text-[#5B21F4] flex items-center justify-center">
                  <ListOrdered className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-black text-slate-900 block leading-none">
                    {questions.length || TOTAL_QUESTIONS_COUNT}
                  </span>
                  <span className="text-[10px] text-slate-400">Questions</span>
                </div>
              </div>

              <div className="h-6 w-px bg-slate-200 hidden sm:block" />

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-purple-50 text-[#5B21F4] flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-black text-slate-900 block leading-none">
                    45 Minutes
                  </span>
                  <span className="text-[10px] text-slate-400">Time Duration</span>
                </div>
              </div>

              <div className="h-6 w-px bg-slate-200 hidden sm:block" />

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Star className="w-3.5 h-3.5 fill-amber-500" />
                </div>
                <div>
                  <span className="font-black text-slate-900 block leading-none">
                    {TOTAL_MARKS} Marks
                  </span>
                  <span className="text-[10px] text-slate-400">Total Marks (2/Q)</span>
                </div>
              </div>
            </div>

            {/* Question Progress Indicator */}
            <div className="flex items-center gap-3 w-full sm:w-64">
              <span className="text-xs font-bold text-slate-700 shrink-0">
                Question {questions.length > 0 ? currentIndex + 1 : 1} of {questions.length || TOTAL_QUESTIONS_COUNT}
              </span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-[#5B21F4] rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      questions.length > 0
                        ? Math.round(((currentIndex + 1) / questions.length) * 100)
                        : 5
                    }%`,
                  }}
                />
              </div>
              <span className="text-[11px] font-bold text-[#5B21F4] shrink-0 font-mono">
                {questions.length > 0
                  ? Math.round(((currentIndex + 1) / questions.length) * 100)
                  : 5}
                %
              </span>
            </div>
          </div>
        </div>

        {/* ── BODY AREA ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* ── Loading Screen ── */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-[#F1EEFF] text-[#5B21F4] flex items-center justify-center shadow-lg animate-pulse">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">
                  Preparing Your Final Quiz Assessment...
                </h3>
                <p className="text-xs text-slate-500">
                  Fetching 50 questions from Brainzima examination repository.
                </p>
              </div>
            </div>
          )}

          {/* ── Error Screen ── */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-base font-black text-slate-900">
                  Failed to Load Quiz Questions
                </h3>
                <p className="text-xs text-slate-500">{error}</p>
              </div>
              <Button
                onClick={fetchQuestions}
                className="h-9 px-4 rounded-xl font-bold text-xs bg-[#5B21F4] hover:bg-[#4C1BD4] text-white"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Retry Quiz
              </Button>
            </div>
          )}

          {/* ── RESULTS SCREEN (After Submission) ── */}
          {!loading && showResultsScreen && submittedResult && (
            <div className="py-6 max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Score Showcase Banner */}
              <div
                className={`p-6 sm:p-8 rounded-3xl text-center space-y-4 border shadow-xl relative overflow-hidden ${
                  submittedResult.extra?.passed
                    ? "bg-gradient-to-br from-emerald-500/10 via-purple-500/10 to-indigo-500/10 border-emerald-200"
                    : "bg-gradient-to-br from-amber-500/10 via-slate-500/10 to-rose-500/10 border-amber-200"
                }`}
              >
                <div
                  className={`w-18 h-18 mx-auto rounded-3xl flex items-center justify-center shadow-lg ${
                    submittedResult.extra?.passed
                      ? "bg-emerald-600 text-white shadow-emerald-500/25"
                      : "bg-amber-600 text-white shadow-amber-500/25"
                  }`}
                >
                  {submittedResult.extra?.passed ? (
                    <Trophy className="w-9 h-9" />
                  ) : (
                    <Award className="w-9 h-9" />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Badge
                    variant="outline"
                    className={`font-black text-xs px-3 py-1 uppercase tracking-wider ${
                      submittedResult.extra?.passed
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-amber-100 text-amber-800 border-amber-300"
                    }`}
                  >
                    {submittedResult.extra?.passed ? "Passed • Examination Cleared" : "Needs Improvement"}
                  </Badge>

                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {submittedResult.marks} / {TOTAL_MARKS} Marks
                  </h2>

                  <p className="text-sm font-semibold text-slate-600">
                    Percentage: {submittedResult.extra?.percentage}% • Grade:{" "}
                    {submittedResult.extra?.percentage && submittedResult.extra.percentage >= 85
                      ? "A+ (Distinction)"
                      : submittedResult.extra?.percentage && submittedResult.extra.percentage >= 70
                      ? "A (First Class)"
                      : submittedResult.extra?.percentage && submittedResult.extra.percentage >= 55
                      ? "B (Second Class)"
                      : submittedResult.extra?.percentage && submittedResult.extra.percentage >= 40
                      ? "C (Pass)"
                      : "F (Failed)"}
                  </p>
                </div>

                {/* Attempt Notice */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs">
                  <span>Attempt {submittedResult.extra?.attempt} of 3 Recorded</span>
                  {submittedResult.extra?.attempt && submittedResult.extra.attempt < 3 && (
                    <span className="text-[#5B21F4]">
                      ({3 - submittedResult.extra.attempt} chance(s) remaining)
                    </span>
                  )}
                </div>

                {/* Score breakdown metrics */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200/80 max-w-md mx-auto text-center">
                  <div className="p-2.5 rounded-2xl bg-white/80 border border-emerald-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Correct</span>
                    <span className="text-lg font-black text-emerald-600">
                      {submittedResult.extra?.correct}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white/80 border border-rose-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Incorrect</span>
                    <span className="text-lg font-black text-rose-600">
                      {submittedResult.extra?.wrong}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white/80 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Accuracy</span>
                    <span className="text-lg font-black text-[#5B21F4]">
                      {submittedResult.extra?.percentage}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {submittedResult.extra?.passed && (
                  <Button
                    onClick={() => {
                      onClose();
                      if (onNavigateToCertificate) {
                        onNavigateToCertificate();
                      }
                    }}
                    className="w-full sm:w-auto h-11 px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-[#5B21F4] to-[#7C3AED] hover:from-[#4C1BD4] hover:to-[#6D28D9] text-white shadow-lg shadow-[#5B21F4]/25"
                  >
                    <Award className="w-4 h-4 mr-2" />
                    View &amp; Download Certificate
                  </Button>
                )}

                {submittedResult.extra?.attempt && submittedResult.extra.attempt < 3 && (
                  <Button
                    variant="outline"
                    onClick={fetchQuestions}
                    className="w-full sm:w-auto h-11 px-6 rounded-2xl font-bold text-sm border-purple-200 text-[#5B21F4] hover:bg-purple-50"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retake Quiz (Attempt {submittedResult.extra.attempt + 1} of 3)
                  </Button>
                )}

                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="w-full sm:w-auto h-11 px-6 rounded-2xl font-bold text-sm text-slate-600 hover:bg-slate-100"
                >
                  Back to Course
                </Button>
              </div>
            </div>
          )}

          {/* ── MAIN QUIZ WORKSPACE (Question on Left, Palette & Guidelines on Right) ── */}
          {!loading && !error && !showResultsScreen && currentQ && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
              {/* ── LEFT COLUMN: Current Question & Options (8 cols) ── */}
              <div className="lg:col-span-8 space-y-4">
                <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-sm space-y-6">
                  {/* Question Header Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#F1EEFF] text-[#5B21F4] border-[#DDD6FE]"
                    >
                      Question {currentIndex + 1} of {questions.length}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="px-3 py-1 rounded-full text-xs font-extrabold bg-purple-50 text-[#5B21F4] border-purple-200"
                    >
                      {MARKS_PER_QUESTION} Marks
                    </Badge>
                  </div>

                  {/* Question Text */}
                  <div className="space-y-2">
                    <h2 className="text-base sm:text-lg md:text-xl font-bold text-slate-900 leading-relaxed">
                      {currentQ.quiz_questions}
                    </h2>
                  </div>

                  {/* Options List */}
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((optNum) => {
                      const optKey = `quiz_option_${optNum}` as keyof QuizQuestion;
                      const optText = currentQ[optKey] as string;
                      if (!optText) return null;

                      const isSelected = selectedAnswers[currentIndex] === optNum;

                      return (
                        <button
                          key={optNum}
                          type="button"
                          onClick={() => handleSelectOption(optNum)}
                          className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-3.5 cursor-pointer text-sm font-medium ${
                            isSelected
                              ? "bg-[#F1EEFF] border-[#5B21F4] text-[#5B21F4] shadow-sm shadow-[#5B21F4]/10"
                              : "bg-white hover:bg-slate-50/80 border-slate-200 text-slate-800"
                          }`}
                        >
                          {/* Radio Circle Indicator */}
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? "border-[#5B21F4] bg-[#5B21F4]"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )}
                          </div>

                          <span className="flex-1 leading-snug">{optText}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Question Bottom Action Bar */}
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    {/* Previous Button */}
                    <Button
                      variant="outline"
                      onClick={handlePrev}
                      disabled={currentIndex === 0}
                      className="h-10 px-4 rounded-xl font-bold text-xs border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>

                    <div className="flex items-center gap-2">
                      {/* Mark for Review Button */}
                      <Button
                        variant="outline"
                        onClick={toggleReview}
                        className={`h-10 px-4 rounded-xl font-bold text-xs transition-colors ${
                          reviewMarked[currentIndex]
                            ? "bg-blue-50 border-blue-300 text-blue-600 hover:bg-blue-100"
                            : "border-purple-200 text-[#5B21F4] hover:bg-purple-50"
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5 mr-1.5" />
                        {reviewMarked[currentIndex] ? "Marked for Review" : "Mark for Review"}
                      </Button>

                      {/* Save & Next OR Submit on Last Question */}
                      {currentIndex === questions.length - 1 ? (
                        <Button
                          onClick={() => setShowConfirmSubmit(true)}
                          disabled={isSubmitting}
                          className="h-10 px-5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          <span>Submit Quiz</span>
                        </Button>
                      ) : (
                        <Button
                          onClick={handleNext}
                          className="h-10 px-5 rounded-xl font-bold text-xs bg-[#5B21F4] hover:bg-[#4C1BD4] text-white shadow-md shadow-[#5B21F4]/20 cursor-pointer"
                        >
                          <span>Save &amp; Next</span>
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── RIGHT COLUMN: Question Palette & Guidelines (4 cols) ── */}
              <div className="lg:col-span-4 space-y-4">
                {/* Palette Card */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                    <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                      <div className="bg-[#5B21F4] rounded-xs" />
                      <div className="bg-[#5B21F4] rounded-xs" />
                      <div className="bg-[#5B21F4] rounded-xs" />
                      <div className="bg-[#5B21F4] rounded-xs" />
                    </div>
                    <span>Question Palette</span>
                  </div>

                  {/* 50 Questions Number Grid */}
                  <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2 max-h-[260px] overflow-y-auto pr-1">
                    {questions.map((_, idx) => {
                      const status = getQuestionStatus(idx);

                      let bgClass = "bg-slate-100 text-slate-700 hover:bg-slate-200";
                      if (status === "current") {
                        bgClass = "bg-[#5B21F4] text-white ring-2 ring-[#5B21F4]/30 shadow-sm";
                      } else if (status === "answered") {
                        bgClass = "bg-emerald-500 text-white";
                      } else if (status === "review") {
                        bgClass = "bg-blue-500 text-white";
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCurrentIndex(idx)}
                          className={`h-9 rounded-xl font-bold text-xs transition-all flex items-center justify-center cursor-pointer ${bgClass}`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>

                  {/* Palette Status Legend */}
                  <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>Answered ({answeredCount})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#5B21F4] shrink-0" />
                      <span>Current</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                      <span>Marked ({reviewCount})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-200 shrink-0" />
                      <span>Unanswered ({unansweredCount})</span>
                    </div>
                  </div>
                </div>

                {/* Guidelines Card */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                    <Award className="w-4 h-4 text-[#5B21F4]" />
                    <span>Quiz Guidelines</span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-600">
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Choose one answer per question.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span>You can review questions before submitting.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                      <span>Timer ends automatically when time is up.</span>
                    </li>
                  </ul>
                </div>

                {/* Submit Quiz CTA Button */}
                <Button
                  onClick={() => setShowConfirmSubmit(true)}
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-2xl font-bold text-sm bg-gradient-to-r from-[#5B21F4] to-[#7C3AED] hover:from-[#4C1BD4] hover:to-[#6D28D9] text-white shadow-lg shadow-[#5B21F4]/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Examination...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Quiz</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── CONFIRMATION MODAL ── */}
        <AnimatePresence>
          {showConfirmSubmit && (
            <div className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-[#5B21F4] flex items-center justify-center shrink-0">
                    <Send className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Submit Your Quiz?
                    </h3>
                    <p className="text-xs text-slate-500">
                      Attempt {submittedResult?.extra?.attempt || currentAttemptNumber} of 3
                    </p>
                  </div>
                </div>

                {/* Breakdown Summary */}
                <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Questions:</span>
                    <span className="font-bold text-slate-900">{questions.length}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Answered:</span>
                    <span className="font-black">{answeredCount}</span>
                  </div>
                  <div className="flex justify-between text-blue-700">
                    <span>Marked for Review:</span>
                    <span className="font-black">{reviewCount}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Unanswered:</span>
                    <span className="font-bold">{unansweredCount}</span>
                  </div>
                </div>

                {unansweredCount > 0 && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 leading-relaxed">
                    You still have <strong>{unansweredCount} unanswered questions</strong>. Once submitted, your score will be computed.
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => setShowConfirmSubmit(false)}
                    className="h-10 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Continue Quiz
                  </Button>
                  <Button
                    onClick={() => handleFinalSubmit(false)}
                    disabled={isSubmitting}
                    className="h-10 px-5 rounded-xl text-xs font-bold bg-[#5B21F4] hover:bg-[#4C1BD4] text-white shadow-md shadow-[#5B21F4]/20"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      "Yes, Submit Now"
                    )}
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
  );

  if (inline) {
    return innerQuizCard;
  }

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      {innerQuizCard}
    </div>
  );

  return createPortal(modalContent, document.body);
}
