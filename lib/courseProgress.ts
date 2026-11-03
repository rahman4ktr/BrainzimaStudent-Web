/**
 * lib/courseProgress.ts
 *
 * Course progress tracking and sequential lecture locking engine for Brainzima LMS.
 * Requirements:
 * - Student must watch at least 80% of a video lesson before it is marked complete.
 * - Next video lesson remains strictly LOCKED until the previous lesson is completed (>= 80% watched).
 * - Overall course progress is calculated and stored in session & localStorage.
 * - Final Course Quiz and Course Feedback are locked until course completion (>= 80% of syllabus completed).
 */

export interface LessonProgressRecord {
  syllabus_id: number;
  watchedSeconds: number;
  durationSeconds: number;
  percent: number;
  isCompleted: boolean; // true when percent >= 80
  lastWatchedAt: number;
}

export interface CourseProgressState {
  courseId: number;
  userId: number;
  completedLessons: number[]; // syllabus_id[] of completed lessons
  lessonProgress: Record<number, LessonProgressRecord>;
  overallPercent: number; // 0 to 100
  completedCount: number;
  totalLessons: number;
  isEligibleForQuiz: boolean; // completedCount >= totalLessons * 0.8
  isCourseCompleted: boolean; // all lessons completed or >= 80%
}

function getStorageKey(courseId: number, userId?: number): string {
  const uid = userId && userId > 0 ? userId : "guest";
  return `bz_course_progress_${uid}_${courseId}`;
}

/**
 * Loads course progress from localStorage / sessionStorage.
 */
export function getCourseProgress(
  courseId: number,
  totalLessons: number = 0,
  userId?: number
): CourseProgressState {
  if (typeof window === "undefined") {
    return {
      courseId,
      userId: userId || 0,
      completedLessons: [],
      lessonProgress: {},
      overallPercent: 0,
      completedCount: 0,
      totalLessons,
      isEligibleForQuiz: false,
      isCourseCompleted: false,
    };
  }

  const key = getStorageKey(courseId, userId);
  try {
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      const completed = Array.isArray(parsed.completedLessons) ? parsed.completedLessons : [];
      const total = totalLessons > 0 ? totalLessons : parsed.totalLessons || completed.length || 1;
      const count = completed.length;
      const overall = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;

      return {
        courseId,
        userId: userId || 0,
        completedLessons: completed,
        lessonProgress: parsed.lessonProgress || {},
        overallPercent: overall,
        completedCount: count,
        totalLessons: total,
        isEligibleForQuiz: count >= Math.max(1, Math.ceil(total * 0.8)),
        isCourseCompleted: overall >= 80,
      };
    }
  } catch (err) {
    console.warn("[CourseProgress] Failed to read storage:", err);
  }

  return {
    courseId,
    userId: userId || 0,
    completedLessons: [],
    lessonProgress: {},
    overallPercent: 0,
    completedCount: 0,
    totalLessons,
    isEligibleForQuiz: false,
    isCourseCompleted: false,
  };
}

/**
 * Saves course progress to both localStorage and sessionStorage.
 */
export function saveCourseProgress(
  courseId: number,
  state: CourseProgressState,
  userId?: number
): void {
  if (typeof window === "undefined") return;

  const key = getStorageKey(courseId, userId);
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(key, serialized);
    sessionStorage.setItem(key, serialized);
  } catch (err) {
    console.warn("[CourseProgress] Failed to save storage:", err);
  }
}

/**
 * Updates watch time for a lesson. If watch percent reaches >= 80%, marks the lesson complete
 * and unlocks the next lesson.
 */
export function updateLessonWatchTime(
  courseId: number,
  syllabusId: number,
  watchedSeconds: number,
  durationSeconds: number,
  totalLessons: number,
  userId?: number
): { progress: CourseProgressState; newlyCompleted: boolean } {
  const currentProgress = getCourseProgress(courseId, totalLessons, userId);
  const dur = durationSeconds > 0 ? durationSeconds : 300; // default 5 mins if unknown
  const percent = Math.min(100, Math.round((watchedSeconds / dur) * 100));
  const isNowCompleted = percent >= 80;

  const existingRecord = currentProgress.lessonProgress[syllabusId];
  const wasAlreadyCompleted = currentProgress.completedLessons.includes(syllabusId);

  const updatedRecord: LessonProgressRecord = {
    syllabus_id: syllabusId,
    watchedSeconds: Math.max(watchedSeconds, existingRecord?.watchedSeconds || 0),
    durationSeconds: dur,
    percent: Math.max(percent, existingRecord?.percent || 0),
    isCompleted: wasAlreadyCompleted || isNowCompleted,
    lastWatchedAt: Date.now(),
  };

  currentProgress.lessonProgress[syllabusId] = updatedRecord;

  let newlyCompleted = false;
  if (isNowCompleted && !wasAlreadyCompleted) {
    currentProgress.completedLessons.push(syllabusId);
    newlyCompleted = true;
  }

  const completedCount = currentProgress.completedLessons.length;
  const tot = totalLessons > 0 ? totalLessons : Math.max(completedCount, 1);
  currentProgress.completedCount = completedCount;
  currentProgress.totalLessons = tot;
  currentProgress.overallPercent = Math.min(100, Math.round((completedCount / tot) * 100));
  currentProgress.isEligibleForQuiz = completedCount >= Math.max(1, Math.ceil(tot * 0.8));
  currentProgress.isCourseCompleted = currentProgress.overallPercent >= 80;

  saveCourseProgress(courseId, currentProgress, userId);

  return { progress: currentProgress, newlyCompleted };
}

/**
 * Manually marks a lesson as completed (for example when video ends).
 */
export function markLessonCompleted(
  courseId: number,
  syllabusId: number,
  totalLessons: number,
  userId?: number
): CourseProgressState {
  const currentProgress = getCourseProgress(courseId, totalLessons, userId);
  if (!currentProgress.completedLessons.includes(syllabusId)) {
    currentProgress.completedLessons.push(syllabusId);
  }

  currentProgress.lessonProgress[syllabusId] = {
    syllabus_id: syllabusId,
    watchedSeconds: 300,
    durationSeconds: 300,
    percent: 100,
    isCompleted: true,
    lastWatchedAt: Date.now(),
  };

  const completedCount = currentProgress.completedLessons.length;
  const tot = totalLessons > 0 ? totalLessons : Math.max(completedCount, 1);
  currentProgress.completedCount = completedCount;
  currentProgress.totalLessons = tot;
  currentProgress.overallPercent = Math.min(100, Math.round((completedCount / tot) * 100));
  currentProgress.isEligibleForQuiz = completedCount >= Math.max(1, Math.ceil(tot * 0.8));
  currentProgress.isCourseCompleted = currentProgress.overallPercent >= 80;

  saveCourseProgress(courseId, currentProgress, userId);
  return currentProgress;
}

/**
 * Checks if a specific syllabus lesson is unlocked based on:
 * 1. Topic 1 is ALWAYS free and unlocked.
 * 2. Topic > 1 requires course purchase.
 * 3. Topic N requires Topic (N - 1) to be completed (>= 80% watched).
 */
export function checkLessonLockStatus(
  lessonId: number,
  syllabusList: Array<{ syllabus_id: number; topic_order?: number | string; is_free?: boolean }>,
  progress: CourseProgressState,
  isPurchased: boolean
): { isUnlocked: boolean; lockReason?: string; isCompleted: boolean } {
  const index = syllabusList.findIndex((item) => item.syllabus_id === lessonId);
  const isCompleted = progress.completedLessons.includes(lessonId);

  // First lesson (index 0 or topic_order 1) or any free lesson is always unlocked
  if (index <= 0 || syllabusList[index]?.is_free) {
    return { isUnlocked: true, isCompleted };
  }

  // Subsequent lessons require purchase
  if (!isPurchased) {
    return {
      isUnlocked: false,
      lockReason: "Enroll in course to unlock full syllabus.",
      isCompleted,
    };
  }

  // Previous lesson must be completed (>= 80% watched)
  const prevLesson = syllabusList[index - 1];
  const isPrevCompleted = prevLesson
    ? progress.completedLessons.includes(prevLesson.syllabus_id)
    : true;

  if (!isPrevCompleted) {
    return {
      isUnlocked: false,
      lockReason: `Watch at least 80% of Lesson ${index} to unlock this lecture.`,
      isCompleted,
    };
  }

  return { isUnlocked: true, isCompleted };
}

