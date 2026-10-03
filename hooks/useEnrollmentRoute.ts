"use client";

import { useState, useEffect, useCallback } from "react";
import { getSession, type BrainzimaSession, getEnrollmentUrl } from "@/lib/session";

/**
 * Reusable hook to resolve course enrollment routes reactively based on
 * the current authenticated user session in sessionStorage.
 *
 * Automatically updates when brainzima_session_change fires.
 *
 * Case 1: First-time normal user -> /user/courses/enroll?course_id=X
 * Case 2: Existing student -> /student/courses/enroll?course_id=X
 */
export function useEnrollmentRoute() {
  const [session, setSession] = useState<BrainzimaSession | null>(() => {
    if (typeof window !== "undefined") {
      return getSession();
    }
    return null;
  });
  const [isLoaded, setIsLoaded] = useState<boolean>(() => typeof window !== "undefined");

  useEffect(() => {
    const s = getSession();
    setSession(s);
    setIsLoaded(true);

    const handleSessionChange = (e: Event) => {
      const customEvent = e as CustomEvent<BrainzimaSession | null>;
      setSession(customEvent.detail ?? getSession());
    };

    window.addEventListener("brainzima_session_change", handleSessionChange);
    return () => {
      window.removeEventListener("brainzima_session_change", handleSessionChange);
    };
  }, []);

  const effectiveSession = session ?? (typeof window !== "undefined" ? getSession() : null);

  const isExistingStudent = Boolean(
    effectiveSession?.is_student === true &&
    effectiveSession?.student_id &&
    Number(effectiveSession.student_id) > 0
  );

  const resolveEnrollmentUrl = useCallback(
    (courseId: number | string) => {
      const current = session ?? (typeof window !== "undefined" ? getSession() : null);
      return getEnrollmentUrl(courseId, current);
    },
    [session]
  );

  return {
    isExistingStudent,
    isLoaded,
    session: effectiveSession,
    getEnrollmentUrl: resolveEnrollmentUrl,
  };
}
