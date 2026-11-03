// hooks/useStudent.ts
// Centralized authenticated student hook & session accessor
// Strictly enforces separation of user_id (account) and student_id (academic profile)

import { useState, useEffect, useCallback } from "react";
import {
  getSession,
  updateSession,
  isBirthdayToday,
  BrainzimaSession,
  StudentDocuments,
} from "@/lib/session";
import {
  getCurrentStudent,
  getCurrentUser,
  getStudentDocuments,
  StudentProfile,
  UserProfile,
} from "@/lib/api";
import { formatRegistrationNumber } from "@/lib/studentUtils";

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
  dob?: string | null;
  st_dob?: string | null;
  docs_st_image?: string | null;
  docs_st_aadhaar_front?: string | null;
  docs_st_aadhaar_back?: string | null;
  docs_st_qualification?: string | null;
  documents?: StudentDocuments | null;
  isBirthday?: boolean;
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

  const studentId = Number(session.student_id);
  const regNo =
    session.registration_number === null || !session.registration_number
      ? ""
      : formatRegistrationNumber(studentId) || session.registration_number || "";

  const dobVal = session.dob || session.st_dob || null;

  return {
    user_id: Number(session.user_id),
    student_id: studentId,
    registration_number: regNo,
    role: session.role || "student",
    is_student: true,
    name: session.name || "Student",
    email: session.email || "",
    mobile: session.mobile || null,
    user_image: session.docs_st_image || session.user_image || null,
    centre_id: session.centre_id ? Number(session.centre_id) : null,
    dob: dobVal,
    st_dob: dobVal,
    docs_st_image: session.docs_st_image || session.documents?.docs_st_image || session.user_image || null,
    docs_st_aadhaar_front: session.docs_st_aadhaar_front || session.documents?.docs_st_aadhaar_front || null,
    docs_st_aadhaar_back: session.docs_st_aadhaar_back || session.documents?.docs_st_aadhaar_back || null,
    docs_st_qualification: session.docs_st_qualification || session.documents?.docs_st_qualification || null,
    documents: session.documents || null,
    isBirthday: isBirthdayToday(dobVal),
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

    // Proceed to call student endpoints if user has student context or student role
    if (!current.is_student && current.role !== "student" && (!current.student_id || Number(current.student_id) <= 0)) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch fresh profile and documents from API in parallel
      const [studentRes, userRes, docRes] = await Promise.allSettled([
        getCurrentStudent(current.user_id),
        getCurrentUser(current.user_id),
        getStudentDocuments(current.user_id, Number(current.student_id)),
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
        if (stData.st_dob || stData.dob) {
          const dobVal = stData.st_dob || stData.dob || null;
          updatedData.dob = dobVal;
          updatedData.st_dob = dobVal;
        }
        if (stData.docs_st_image) updatedData.docs_st_image = stData.docs_st_image;
        if (stData.docs_st_aadhaar_front) updatedData.docs_st_aadhaar_front = stData.docs_st_aadhaar_front;
        if (stData.docs_st_aadhaar_back) updatedData.docs_st_aadhaar_back = stData.docs_st_aadhaar_back;
        if (stData.docs_st_qualification) updatedData.docs_st_qualification = stData.docs_st_qualification;
        if (stData.documents) updatedData.documents = stData.documents;
      }

      if (docRes.status === "fulfilled" && docRes.value.success && docRes.value.data) {
        const d = docRes.value.data;
        if (d.docs_st_image) updatedData.docs_st_image = d.docs_st_image;
        if (d.docs_st_aadhaar_front) updatedData.docs_st_aadhaar_front = d.docs_st_aadhaar_front;
        if (d.docs_st_aadhaar_back) updatedData.docs_st_aadhaar_back = d.docs_st_aadhaar_back;
        if (d.docs_st_qualification) updatedData.docs_st_qualification = d.docs_st_qualification;
        updatedData.documents = {
          docs_st_image: d.docs_st_image || updatedData.docs_st_image || current.docs_st_image || null,
          docs_st_aadhaar_front: d.docs_st_aadhaar_front || updatedData.docs_st_aadhaar_front || current.docs_st_aadhaar_front || null,
          docs_st_aadhaar_back: d.docs_st_aadhaar_back || updatedData.docs_st_aadhaar_back || current.docs_st_aadhaar_back || null,
          docs_st_qualification: d.docs_st_qualification || updatedData.docs_st_qualification || current.docs_st_qualification || null,
        };
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
  const student_id =
    session?.student_id && Number(session.student_id) > 0
      ? Number(session.student_id)
      : studentProfile?.st_id
      ? Number(studentProfile.st_id)
      : userProfile?.student_id
      ? Number(userProfile.student_id)
      : null;

  const rawReg = session?.registration_number ?? studentProfile?.st_regno ?? userProfile?.registration_number;
  // If explicitly null (e.g. Center Payment pending at study centre), keep null!
  const isExplicitlyPending =
    session?.registration_number === null ||
    studentProfile?.st_regno === null ||
    userProfile?.registration_number === null;

  // If active/paid, format registration number strictly from student_id: BISR${student_id} (e.g. BISR0023).
  const registration_number = isExplicitlyPending
    ? null
    : (session?.registration_number || studentProfile?.st_regno || userProfile?.registration_number)
    ? (student_id ? formatRegistrationNumber(student_id) : rawReg || null)
    : null;
  const is_student = Boolean(session?.is_student);
  const role = session?.role || (is_student ? "student" : "user");
  const isStudentValid = Boolean(is_student && student_id && student_id > 0);

  const dob = session?.dob ?? session?.st_dob ?? studentProfile?.st_dob ?? studentProfile?.dob ?? null;
  const isBirthday = isBirthdayToday(dob);

  const docs_st_image =
    session?.docs_st_image ||
    studentProfile?.docs_st_image ||
    session?.documents?.docs_st_image ||
    session?.user_image ||
    studentProfile?.user_image ||
    null;

  const docs_st_aadhaar_front =
    session?.docs_st_aadhaar_front ||
    studentProfile?.docs_st_aadhaar_front ||
    session?.documents?.docs_st_aadhaar_front ||
    null;

  const docs_st_aadhaar_back =
    session?.docs_st_aadhaar_back ||
    studentProfile?.docs_st_aadhaar_back ||
    session?.documents?.docs_st_aadhaar_back ||
    null;

  const docs_st_qualification =
    session?.docs_st_qualification ||
    studentProfile?.docs_st_qualification ||
    session?.documents?.docs_st_qualification ||
    null;

  const documents = session?.documents ||
    studentProfile?.documents || {
      docs_st_image,
      docs_st_aadhaar_front,
      docs_st_aadhaar_back,
      docs_st_qualification,
    };

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
    user_image: docs_st_image || session?.user_image || null,
    centre_id: session?.centre_id ? Number(session?.centre_id) : null,
    dob,
    st_dob: dob,
    docs_st_image,
    docs_st_aadhaar_front,
    docs_st_aadhaar_back,
    docs_st_qualification,
    documents,
    isBirthday,
    studentProfile,
    userProfile,
    isLoading,
    error,
    refreshStudent,
  };
}
