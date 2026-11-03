// lib/onlineResultsStore.ts
// Server-side persistent store for Online Quiz Results (bi_online_result).
// Implements 3-attempt rule, insert-on-first-attempt, and update-on-subsequent-attempts.

import fs from "fs";
import path from "path";
import { getBackendApiUrl } from "./apiConfig";

export interface OnlineResultExtra {
  attempt: number;
  max_attempts: number;
  total_questions: number;
  correct: number;
  wrong: number;
  unanswered: number;
  marks_per_question: number;
  total_marks: number;
  percentage: number;
  passed: boolean;
  duration_minutes?: number;
  time_spent_seconds?: number;
  completed_at: string;
  attempts_history?: Array<{
    attempt: number;
    marks: number;
    percentage: number;
    correct: number;
    date: string;
  }>;
}

export interface OnlineResult {
  result_id: number;
  std_id: number;
  user_id?: number;
  course_id: number;
  marks: number;
  created_at: string;
  updated_at: string;
  extra: OnlineResultExtra;
  st_name?: string;
  st_regno?: string;
  course_name?: string;
  course_code?: string;
}

declare global {
  var __brainzimaOnlineResults: Map<string, OnlineResult> | undefined;
}

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "online_results.json");

function getStoreMap(): Map<string, OnlineResult> {
  if (globalThis.__brainzimaOnlineResults) {
    return globalThis.__brainzimaOnlineResults;
  }

  const map = new Map<string, OnlineResult>();

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      const list: OnlineResult[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const item of list) {
          // Key by student/user and course
          const stdKey = `${item.std_id}_${item.course_id}`;
          map.set(stdKey, item);
          if (item.user_id) {
            const userKey = `u_${item.user_id}_${item.course_id}`;
            map.set(userKey, item);
          }
        }
      }
    }
  } catch (err) {
    console.error("[OnlineResultsStore] Error loading results file:", err);
  }

  globalThis.__brainzimaOnlineResults = map;
  return map;
}

function persistStore(): void {
  const map = getStoreMap();
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // Filter unique by result_id
    const seen = new Set<number>();
    const list: OnlineResult[] = [];
    for (const res of map.values()) {
      if (!seen.has(res.result_id)) {
        seen.add(res.result_id);
        list.push(res);
      }
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("[OnlineResultsStore] Error saving results file:", err);
  }
}

/**
 * Find existing quiz result for a student/user and course.
 */
export function findOnlineResult(
  stdId: number,
  courseId: number,
  userId?: number
): OnlineResult | null {
  const map = getStoreMap();
  if (stdId && map.has(`${stdId}_${courseId}`)) {
    return map.get(`${stdId}_${courseId}`) || null;
  }
  if (userId && map.has(`u_${userId}_${courseId}`)) {
    return map.get(`u_${userId}_${courseId}`) || null;
  }
  // Linear search fallback
  for (const item of map.values()) {
    if (Number(item.course_id) === Number(courseId)) {
      if (stdId && Number(item.std_id) === Number(stdId)) return item;
      if (userId && Number(item.user_id) === Number(userId)) return item;
    }
  }
  return null;
}

/**
 * List results for a given student or user.
 */
export function listOnlineResultsForUser(
  stdId?: number,
  userId?: number
): OnlineResult[] {
  const map = getStoreMap();
  const seen = new Set<number>();
  const results: OnlineResult[] = [];

  for (const item of map.values()) {
    if (seen.has(item.result_id)) continue;
    const matchStd = stdId && Number(item.std_id) === Number(stdId);
    const matchUser = userId && Number(item.user_id) === Number(userId);
    if (matchStd || matchUser) {
      seen.add(item.result_id);
      results.push(item);
    }
  }

  return results.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

/**
 * Save or update online quiz result according to user rule:
 * - 1st attempt: Insert new result
 * - 2nd/3rd attempts: Update existing result
 * - Maximum 3 attempts
 */
export async function saveOrUpdateQuizResult(params: {
  std_id: number;
  user_id?: number;
  course_id: number;
  marks: number;
  extra: Omit<OnlineResultExtra, "attempt" | "max_attempts" | "attempts_history"> & {
    attempt?: number;
  };
  st_name?: string;
  st_regno?: string;
  course_name?: string;
  course_code?: string;
}): Promise<{
  success: boolean;
  result?: OnlineResult;
  message?: string;
  isUpdate: boolean;
  attemptNumber: number;
}> {
  const { std_id, user_id, course_id, marks, extra, st_name, st_regno, course_name, course_code } = params;
  const map = getStoreMap();
  const existing = findOnlineResult(std_id, course_id, user_id);

  const nowIso = new Date().toISOString().replace("T", " ").substring(0, 19);

  let attemptNumber = 1;
  let history: Array<{
    attempt: number;
    marks: number;
    percentage: number;
    correct: number;
    date: string;
  }> = [];

  if (existing) {
    const prevAttempt = existing.extra?.attempt || 1;
    if (prevAttempt >= 3) {
      return {
        success: false,
        message: "Maximum quiz attempts (3 of 3) already reached for this course.",
        isUpdate: false,
        attemptNumber: prevAttempt,
        result: existing,
      };
    }

    attemptNumber = prevAttempt + 1;
    history = Array.isArray(existing.extra?.attempts_history)
      ? [...existing.extra.attempts_history]
      : [
          {
            attempt: prevAttempt,
            marks: existing.marks,
            percentage: existing.extra?.percentage || 0,
            correct: existing.extra?.correct || 0,
            date: existing.updated_at || existing.created_at,
          },
        ];
  }

  // Record current attempt in history
  history.push({
    attempt: attemptNumber,
    marks,
    percentage: extra.percentage,
    correct: extra.correct,
    date: nowIso,
  });

  const fullExtra: OnlineResultExtra = {
    ...extra,
    attempt: attemptNumber,
    max_attempts: 3,
    attempts_history: history,
  };

  const phpApi = getBackendApiUrl();

  // Try sync with PHP Backend
  let remoteResultId = existing?.result_id;
  try {
    const res = await fetch(`${phpApi}/online-results`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-User-Id": String(user_id || std_id || 1),
        "X-User-Role": "student",
        "X-Student-Id": String(std_id || ""),
      },
      body: JSON.stringify({
        std_id: std_id || user_id || 1,
        course_id,
        marks,
        extra: fullExtra,
      }),
    });
    const data = await res.json().catch(() => null);
    if (data?.data?.result_id) {
      remoteResultId = Number(data.data.result_id);
    }
  } catch (syncErr) {
    console.warn("[OnlineResultsStore] Remote PHP sync notice:", syncErr);
  }

  const finalResultId = remoteResultId || existing?.result_id || Date.now();

  const finalRecord: OnlineResult = {
    result_id: finalResultId,
    std_id: std_id || (user_id as number) || 1,
    user_id: user_id || std_id,
    course_id,
    marks,
    created_at: existing ? existing.created_at : nowIso,
    updated_at: nowIso,
    extra: fullExtra,
    st_name: st_name || existing?.st_name || "Student",
    st_regno: st_regno || existing?.st_regno || `BISR${String(std_id || user_id).padStart(4, "0")}`,
    course_name: course_name || existing?.course_name || `Online Course #${course_id}`,
    course_code: course_code || existing?.course_code || `CRSE${course_id}`,
  };

  // Save to map & persist
  map.set(`${std_id}_${course_id}`, finalRecord);
  if (user_id) {
    map.set(`u_${user_id}_${course_id}`, finalRecord);
  }
  persistStore();

  return {
    success: true,
    result: finalRecord,
    isUpdate: Boolean(existing),
    attemptNumber,
    message: existing
      ? `Quiz Attempt ${attemptNumber} submitted successfully. Result updated!`
      : "Quiz submitted successfully. Result recorded!",
  };
}
