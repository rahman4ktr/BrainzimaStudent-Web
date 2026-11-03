"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  MessageSquare,
  Sparkles,
  Send,
  X,
  Loader2,
  CheckCircle2,
  Trash2,
  Edit3,
  ThumbsUp,
  User,
  Calendar,
  AlertCircle,
} from "lucide-react";
import {
  getOnlineCourseFeedback,
  submitOnlineCourseFeedback,
  updateOnlineCourseFeedback,
  deleteOnlineCourseFeedback,
  type CourseFeedbackRecord,
} from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CourseFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: number;
  courseName: string;
  courseCode?: string;
  currentUserId?: number;
  currentUserRole?: "user" | "student" | "admin";
  studentName?: string;
  onFeedbackSubmitted?: () => void;
}

const RATING_LABELS: Record<number, { label: string; desc: string; emoji: string }> = {
  1: { label: "Poor", desc: "Needs significant improvement", emoji: "😞" },
  2: { label: "Fair", desc: "Average experience", emoji: "😐" },
  3: { label: "Good", desc: "Helpful and clear", emoji: "🙂" },
  4: { label: "Very Good", desc: "Highly informative & well paced", emoji: "😊" },
  5: { label: "Excellent", desc: "Outstanding course & exceptional content", emoji: "🌟" },
};

const SUGGESTED_TAGS = [
  "Clear Explanations",
  "Practical Exercises",
  "Well Structured",
  "Great Quality",
  "Beginner Friendly",
  "Helpful Instructor",
  "Good Pacing",
  "Industry Relevant",
];

export default function CourseFeedbackModal({
  isOpen,
  onClose,
  courseId,
  courseName,
  courseCode,
  currentUserId,
  currentUserRole = "student",
  studentName = "Student",
  onFeedbackSubmitted,
}: CourseFeedbackModalProps) {
  const { toast } = useToast();
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Body overflow locking
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Feedbacks state
  const [feedbacks, setFeedbacks] = useState<CourseFeedbackRecord[]>([]);
  const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState<boolean>(true);

  // Form input states
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>(["Clear Explanations", "Well Structured"]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"write" | "reviews">("write");

  // Editing existing feedback
  const [editingFeedbackId, setEditingFeedbackId] = useState<number | null>(null);

  // Fetch reviews for this course
  const loadFeedbacks = useCallback(async () => {
    if (!courseId) return;
    setIsLoadingFeedbacks(true);
    try {
      const res = await getOnlineCourseFeedback(courseId);
      if (res.success && Array.isArray(res.data)) {
        setFeedbacks(res.data);

        // Check if user already submitted feedback
        if (currentUserId) {
          const userExisting = res.data.find(
            (f) => Number(f.user_id) === Number(currentUserId)
          );
          if (userExisting) {
            setEditingFeedbackId(userExisting.feedback_id);
            setComment(userExisting.comment || "");
            if (userExisting.extra?.rating) {
              setRating(Number(userExisting.extra.rating));
            }
            if (Array.isArray(userExisting.extra?.tags)) {
              setSelectedTags(userExisting.extra.tags);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Could not load feedback:", err);
    } finally {
      setIsLoadingFeedbacks(false);
    }
  }, [courseId, currentUserId]);

  useEffect(() => {
    if (isOpen) {
      loadFeedbacks();
    }
  }, [isOpen, loadFeedbacks]);

  // User's own existing review
  const myExistingFeedback = useMemo(() => {
    if (!currentUserId) return null;
    return feedbacks.find((f) => Number(f.user_id) === Number(currentUserId)) || null;
  }, [feedbacks, currentUserId]);

  // Average rating
  const averageRating = useMemo(() => {
    if (feedbacks.length === 0) return 5.0;
    const total = feedbacks.reduce((acc, f) => {
      const r = f.extra?.rating ? Number(f.extra.rating) : 5;
      return acc + r;
    }, 0);
    return Math.round((total / feedbacks.length) * 10) / 10;
  }, [feedbacks]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Submit new or updated feedback
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      toast({
        variant: "error",
        title: "Comment Required",
        description: "Please write a few words about your experience with the course.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        coures_id: courseId,
        comment: comment.trim(),
        extra: {
          rating,
          tags: selectedTags,
          recommend: rating >= 4,
          student_role: currentUserRole,
          submitted_at: new Date().toISOString(),
        },
      };

      if (editingFeedbackId) {
        // Update existing feedback
        const res = await updateOnlineCourseFeedback(
          editingFeedbackId,
          payload,
          currentUserId,
          currentUserRole
        );
        if (res.success) {
          toast({
            variant: "success",
            title: "Feedback Updated",
            description: "Your course review has been updated successfully!",
          });
          loadFeedbacks();
          setActiveTab("reviews");
          if (onFeedbackSubmitted) onFeedbackSubmitted();
        } else {
          throw new Error(res.message || "Failed to update feedback.");
        }
      } else {
        // Create new feedback
        const res = await submitOnlineCourseFeedback(
          payload,
          currentUserId,
          currentUserRole
        );
        if (res.success) {
          toast({
            variant: "success",
            title: "Feedback Submitted!",
            description: "Thank you for reviewing the course!",
          });
          loadFeedbacks();
          setActiveTab("reviews");
          if (onFeedbackSubmitted) onFeedbackSubmitted();
        } else {
          throw new Error(res.message || "Failed to submit feedback.");
        }
      }
    } catch (err: any) {
      toast({
        variant: "error",
        title: "Submission Error",
        description: err?.message || "Failed to save course feedback.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete own feedback
  const handleDeleteFeedback = async (id: number) => {
    if (!confirm("Are you sure you want to delete your review?")) return;
    try {
      const res = await deleteOnlineCourseFeedback(id, currentUserId, currentUserRole);
      if (res.success) {
        toast({
          variant: "success",
          title: "Feedback Deleted",
          description: "Your review was deleted successfully.",
        });
        setEditingFeedbackId(null);
        setComment("");
        setRating(5);
        setSelectedTags([]);
        loadFeedbacks();
        if (onFeedbackSubmitted) onFeedbackSubmitted();
      }
    } catch (err: any) {
      toast({
        variant: "error",
        title: "Delete Error",
        description: err?.message || "Failed to delete feedback.",
      });
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col my-auto relative max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-[#5B21F4] via-[#6D28D9] to-[#7C3AED] text-white relative shrink-0">
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-xs">
              <MessageSquare className="w-3.5 h-3.5 text-white" />
            </span>
            <span className="text-xs uppercase font-extrabold tracking-wider text-purple-200">
              End-of-Course Evaluation
            </span>
            {courseCode && (
              <Badge className="bg-white/20 text-white border-white/30 text-[10px] px-2 py-0">
                {courseCode}
              </Badge>
            )}
          </div>

          <h2 className="text-lg sm:text-xl font-black tracking-tight text-white line-clamp-1">
            {courseName}
          </h2>
          <p className="text-xs text-purple-100 mt-0.5">
            Share your thoughts, suggestions &amp; rating to help instructors and fellow learners.
          </p>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/20">
            <button
              type="button"
              onClick={() => setActiveTab("write")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "write"
                  ? "bg-white text-[#5B21F4] shadow-sm"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{editingFeedbackId ? "Edit My Review" : "Write Feedback"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("reviews")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "reviews"
                  ? "bg-white text-[#5B21F4] shadow-sm"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
              <span>
                All Reviews ({feedbacks.length})
                {feedbacks.length > 0 && ` • ${averageRating}★`}
              </span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {activeTab === "write" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Star Rating Section */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FAF5FF] via-white to-purple-50/40 border border-[#DDD6FE] text-center space-y-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                  How would you rate this course?
                </span>

                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((starVal) => {
                    const activeVal = hoverRating ?? rating;
                    const isFilled = starVal <= activeVal;

                    return (
                      <button
                        key={starVal}
                        type="button"
                        onClick={() => setRating(starVal)}
                        onMouseEnter={() => setHoverRating(starVal)}
                        onMouseLeave={() => setHoverRating(null)}
                        className="p-1.5 rounded-xl hover:scale-125 transition-transform cursor-pointer focus:outline-none"
                      >
                        <Star
                          className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                            isFilled
                              ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                              : "text-slate-300 hover:text-slate-400"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Rating Label and Emoji */}
                <div className="flex items-center justify-center gap-1.5 text-xs">
                  <span className="text-base">{RATING_LABELS[hoverRating ?? rating].emoji}</span>
                  <span className="font-bold text-slate-900">
                    {RATING_LABELS[hoverRating ?? rating].label}
                  </span>
                  <span className="text-slate-400">—</span>
                  <span className="text-slate-500 font-medium">
                    {RATING_LABELS[hoverRating ?? rating].desc}
                  </span>
                </div>
              </div>

              {/* Quick Tags Selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  What did you like most? (Tap tags)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`text-xs px-2.5 py-1 rounded-xl font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#5B21F4] text-white border-[#5B21F4] shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {isSelected ? "✓ " : "+ "}
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Feedback Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Your Review &amp; Experience
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {comment.length}/5000 characters
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us what you learned, how the course helped you, quality of videos, or suggestions..."
                  className="w-full p-3.5 text-xs bg-slate-50/70 border border-slate-200 rounded-2xl focus:outline-none focus:border-[#5B21F4] focus:bg-white focus:ring-2 focus:ring-[#5B21F4]/10 transition-all text-slate-900 placeholder:text-slate-400"
                  maxLength={5000}
                />
              </div>

              {/* Existing review warning if editing */}
              {editingFeedbackId && myExistingFeedback && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>You are updating your previously submitted review.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteFeedback(editingFeedbackId)}
                    className="text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="text-xs h-9 px-4 rounded-xl cursor-pointer"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting || !comment.trim()}
                  className="text-xs h-9 px-5 rounded-xl bg-[#5B21F4] hover:bg-[#4C1BD4] text-white font-bold cursor-pointer shadow-md shadow-[#5B21F4]/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      <span>{editingFeedbackId ? "Update Review" : "Submit Feedback"}</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            /* Tab: View All Reviews */
            <div className="space-y-4">
              {/* Summary Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50/50 to-white border border-purple-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-slate-900 font-mono">
                      {averageRating}
                    </span>
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((st) => (
                        <Star
                          key={st}
                          className={`w-4 h-4 ${
                            st <= Math.round(averageRating)
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Based on {feedbacks.length} student rating{feedbacks.length === 1 ? "" : "s"}
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setActiveTab("write")}
                  className="bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold rounded-xl h-8 px-3 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3 mr-1" />
                  <span>{editingFeedbackId ? "Edit Mine" : "Write Review"}</span>
                </Button>
              </div>

              {/* Feedbacks List */}
              {isLoadingFeedbacks ? (
                <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#5B21F4]" />
                  <span className="text-xs">Loading course reviews...</span>
                </div>
              ) : feedbacks.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-medium text-slate-500">
                    No reviews yet for this course.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab("write")}
                    className="text-xs font-bold rounded-xl"
                  >
                    Be the first to review!
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {feedbacks.map((item) => {
                    const itemRating = item.extra?.rating ? Number(item.extra.rating) : 5;
                    const isMyItem = Number(item.user_id) === Number(currentUserId);

                    return (
                      <div
                        key={item.feedback_id}
                        className={`p-4 rounded-2xl border transition-all text-left space-y-2 ${
                          isMyItem
                            ? "bg-purple-50/50 border-[#DDD6FE] shadow-xs"
                            : "bg-white border-slate-200/80"
                        }`}
                      >
                        {/* Reviewer Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#5B21F4] to-[#7C3AED] text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {item.student_name ? item.student_name.charAt(0).toUpperCase() : "S"}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900">
                                  {item.student_name || "Enrolled Student"}
                                </span>
                                {isMyItem && (
                                  <Badge className="bg-[#5B21F4] text-white text-[9px] px-1.5 py-0">
                                    You
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block">
                                {item.created_at ? item.created_at.split(" ")[0] : "Verified Student"}
                              </span>
                            </div>
                          </div>

                          {/* Star score */}
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((st) => (
                              <Star
                                key={st}
                                className={`w-3.5 h-3.5 ${
                                  st <= itemRating
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-slate-200"
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Comment text */}
                        <p className="text-xs text-slate-700 leading-relaxed font-normal">
                          {item.comment}
                        </p>

                        {/* Tags */}
                        {Array.isArray(item.extra?.tags) && item.extra.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {item.extra.tags.map((t: string) => (
                              <span
                                key={t}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600"
                              >
                                ✓ {t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Edit/Delete if own */}
                        {isMyItem && (
                          <div className="flex items-center justify-end gap-3 pt-1 border-t border-purple-100">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFeedbackId(item.feedback_id);
                                setComment(item.comment);
                                if (item.extra?.rating) setRating(Number(item.extra.rating));
                                if (Array.isArray(item.extra?.tags)) setSelectedTags(item.extra.tags);
                                setActiveTab("write");
                              }}
                              className="text-xs text-[#5B21F4] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteFeedback(item.feedback_id)}
                              className="text-xs text-rose-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
