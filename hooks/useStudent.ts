// hooks/useStudent.ts
// Centralized authenticated student hook & session accessor
// Strictly enforces separation of user_id (account) and student_id (academic profile)

import { useState, useEffect, useCallback } from "react";
import {
  getSession,
  updateSession,
  BrainzimaSession,
} from "@/lib/session";
import {
  getCurrentStudent,
  getCurrentUser,
  StudentProfile,
  UserProfile,
} from "@/lib/api";

export interface AuthenticatedStudentInfo {
  user_id: number;
  student_id: number;
  registration_number: string;
  role: string;
  is_student: boolean;
  name: string;
  email: string;
  mobile: string | null;
  user_image: string | null;
  centre_id: number | null;
}

/**
 * Synchronous direct helper to get authenticated student info from sessionStorage.
 * Returns null if unauthenticated or if the user is not a verified enrolled student.
 */
export function getAuthenticatedStudent(): AuthenticatedStudentInfo | null {
  const session = getSession();
  if (
    !session ||
    !session.user_id ||
    !session.is_student ||
    !session.student_id ||
    Number(session.student_id) <= 0
  ) {
    return null;
  }

  return {
    user_id: Number(session.user_id),
    student_id: Number(session.student_id),
    registration_number: session.registration_number || `BISR${String(session.student_id).padStart(4, "0")}`,
    role: session.role || "student",
    is_student: true,
    name: session.name || "Student",
    email: session.email || "",
    mobile: session.mobile || null,
    user_image: session.user_image || null,
    centre_id: session.centre_id ? Number(session.centre_id) : null,
  };
}

export function useStudent() {
  const [session, setSession] = useState<BrainzimaSession | null>(() => getSession());
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read session on mount and react to updates
  useEffect(() => {
    const handleSessionChange = (e: Event) => {
      const customEvent = e as CustomEvent<BrainzimaSession | null>;
      setSession(customEvent.detail ?? getSession());
    };

    window.addEventListener("brainzima_session_change", handleSessionChange);
    return () => {
      window.removeEventListener("brainzima_session_change", handleSessionChange);
    };
  }, []);

  const refreshStudent = useCallback(async () => {
    const current = getSession();
    if (!current?.user_id) {
      setIsLoading(false);
      return;
    }

    // Only proceed to call student endpoints if authenticated student context exists
    if (!current.is_student || !current.student_id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch fresh profile from API in parallel
      const [studentRes, userRes] = await Promise.allSettled([
        getCurrentStudent(current.user_id),
        getCurrentUser(current.user_id),
      ]);

      let updatedData: Partial<BrainzimaSession> = {};

      if (studentRes.status === "fulfilled" && studentRes.value.success && studentRes.value.data) {
        const stData = studentRes.value.data;
        setStudentProfile(stData);
        if (stData.st_id) {
          updatedData.student_id = Number(stData.st_id);
        }
        if (stData.st_regno) {
          updatedData.registration_number = stData.st_regno;
        }
        if (stData.st_name) {
          updatedData.name = stData.st_name;
        }
        if (stData.st_centre_id) {
          updatedData.centre_id = Number(stData.st_centre_id);
        }
      }

      if (userRes.status === "fulfilled" && userRes.value.success && userRes.value.data) {
        const uData = userRes.value.data;
        setUserProfile(uData);
        if (uData.name) updatedData.name = uData.name;
        if (uData.email) updatedData.email = uData.email;
        if (uData.mobile) updatedData.mobile = uData.mobile;
        if (uData.user_image !== undefined) updatedData.user_image = uData.user_image;
        if (uData.student_id) updatedData.student_id = Number(uData.student_id);
        if (uData.registration_number) updatedData.registration_number = uData.registration_number;
        if (uData.is_student !== undefined) updatedData.is_student = Boolean(uData.is_student);
      }

      // Update sessionStorage with fresh safe profile values
      if (Object.keys(updatedData).length > 0) {
        const updated = updateSession(updatedData);
        if (updated) setSession(updated);
      }
    } catch (err: any) {
      console.warn("[useStudent] Failed to refresh profile:", err);
      setError(err?.message || "Failed to refresh student profile.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Automatic profile refresh on initial mount
  useEffect(() => {
    refreshStudent();
  }, [refreshStudent]);

  const user_id = session?.user_id ? Number(session.user_id) : null;
  const student_id = session?.student_id ? Number(session.student_id) : null;
  const registration_number = session?.registration_number || (student_id ? `BISR${String(student_id).padStart(4, "0")}` : null);
  const is_student = Boolean(session?.is_student);
  const role = session?.role || (is_student ? "student" : "user");
  const isStudentValid = Boolean(is_student && student_id && student_id > 0);

  return {
    session,
    user_id,
    student_id,
    registration_number,
    role,
    is_student,
    isStudentValid,
    name: session?.name || "Student",
    email: session?.email || "",
    mobile: session?.mobile || null,
    user_image: session?.user_image || null,
    centre_id: session?.centre_id ? Number(session?.centre_id) : null,
    studentProfile,
    userProfile,
    isLoading,
    error,
    refreshStudent,
  };
}
