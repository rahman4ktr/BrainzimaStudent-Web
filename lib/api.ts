// lib/api.ts
// Clean API client matching the Brainzima PHP REST API (README spec)
// Production: https://api.brainzima.com/student/api

import { getCurrentSqlDateTime } from "./utils";
import { getBackendApiUrl } from "./apiConfig";

const API_BASE = getBackendApiUrl();

// ─── Response Types ────────────────────────────────────────────────────────
// ApiResponse is defined alongside apiRequest below.

export interface LoginData {
  user_id: number;
  student_id?: number | null;
  registration_number?: string | null;
  name: string;
  email: string;
  mobile: string;
  role: "student" | "user" | "admin" | string;
  is_student: boolean;
  centre_id?: number | null;
  user_image?: string | null;
  user_verified?: number | boolean;
  last_login_at?: string | null;
  last_login_ip?: string | null;
  dob?: string | null;
  st_dob?: string | null;
  docs_st_image?: string | null;
  docs_st_aadhaar_front?: string | null;
  docs_st_aadhaar_back?: string | null;
  docs_st_qualification?: string | null;
  documents?: {
    docs_st_image?: string | null;
    docs_st_aadhaar_front?: string | null;
    docs_st_aadhaar_back?: string | null;
    docs_st_qualification?: string | null;
  } | null;
}

export { getFileUrl, getInitials } from "./session";

export interface UserProfile {
  user_id: number;
  name: string;
  email: string;
  mobile: string;
  role: string;
  verified: boolean;
  user_image: string | null;
  is_student: boolean;
  student_id: number | null;
  registration_number: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Core Fetch Utility ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string>;
  /** HTTP status code — populated by apiRequest */
  _status?: number;
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    userId?: number;
    userRole?: "student" | "user" | "admin";
    studentId?: number;
  } = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, userId, userRole, studentId } = options;

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (userId) headers["X-User-Id"] = String(userId);
  if (userRole) headers["X-User-Role"] = userRole;
  if (studentId) headers["X-Student-Id"] = String(studentId);

  try {
    const NEXT_LOCAL_API_PREFIXES = [
      "/api/auth",
      "/auth",
      "/api/user",
      "/api/upload",
      "/api/course",
      "/api/student",
      "/api/enrollment",
      "/api/franchisee",
      "/api/razorpay",
      "/api/document",
      "/api/fee",
      "/api/notes",
      "/api/attendance",
      "/api/onlinecoures",
      "/api/coupon-online",
      "/api/coupon",
      "/api/online-quiz-questions",
      "/api/online-results",
      "/api/online-course-feedback",
      "/api/ebooks",
      "/api/ebook-library",
    ];

    let url: string;
    if (NEXT_LOCAL_API_PREFIXES.some((p) => endpoint.startsWith(p))) {
      url = endpoint;
    } else if (endpoint.startsWith("/api/")) {
      // Strip leading /api since API_BASE already includes /api
      const cleanEndpoint = endpoint.replace(/^\/api/, "");
      url = `${API_BASE}${cleanEndpoint}`;
    } else {
      url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: isFormData ? (body as FormData) : (body ? JSON.stringify(body) : undefined),
    });

    let json: any = null;
    const text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      json = {
        success: false,
        message: text && text.length < 200 ? text : `Server returned HTTP ${res.status}`,
      };
    }

    // Attach HTTP status so callers can detect 409 Conflict, 403 Unverified, 429 Rate Limit, etc.
    return { ...(json as ApiResponse<T>), _status: res.status };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Network error. Please check your connection and try again.",
      _status: 0,
    };
  }
}

// ─── Auth APIs ─────────────────────────────────────────────────────────────

export interface RegisterResponseData {
  user_id: number;
  name: string;
  email: string;
  user_image?: string | null;
  role: "user" | "student";
  is_student: boolean;
  email_verification_required: boolean;
}

export interface VerifyOtpResponseData {
  verified: boolean;
  user?: LoginData;
}

/** POST /api/auth/login — Unified login with unverified email check (HTTP 403) */
export async function detectClientPublicIp(): Promise<string> {
  try {
    const ipRes = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(2000),
    });
    const ipJson = await ipRes.json();
    if (ipJson?.ip && ipJson.ip !== "0.0.0.0") return ipJson.ip;
  } catch {
    /* fallback */
  }

  try {
    const res2 = await fetch("https://api64.ipify.org?format=json", {
      signal: AbortSignal.timeout(2000),
    });
    const j2 = await res2.json();
    if (j2?.ip && j2.ip !== "0.0.0.0") return j2.ip;
  } catch {
    /* fallback */
  }

  return "127.0.0.1";
}

/** POST /api/auth/login — Unified login with unverified email check (HTTP 403) */
export async function loginUser(
  identifier: string,
  password: string
): Promise<ApiResponse<LoginData & { email_verification_required?: boolean; email?: string }>> {
  // Detect IP client-side (best effort; server also checks request headers)
  let ip = "127.0.0.1";
  try {
    ip = await detectClientPublicIp();
  } catch {
    /* ignore - IP fallback */
  }

  const cleanId = identifier.trim();
  const normalizedId = cleanId.includes("@") ? cleanId.toLowerCase() : cleanId;
  const currentSqlTime = getCurrentSqlDateTime();

  return apiRequest<LoginData & { email_verification_required?: boolean; email?: string }>("/api/auth/login", {
    method: "POST",
    body: {
      identifier: normalizedId,
      password,
      ip,
      last_login_ip: ip,
      last_login_at: currentSqlTime,
    },
  });
}

/** POST /api/upload — Upload user / student profile photo directly to PHP backend */
export async function uploadUserImage(
  file: File,
  userId?: number,
  currentImage?: string | null,
  role?: string,
  isStudent?: boolean
): Promise<{
  success: boolean;
  db_path?: string;
  url?: string;
  filename?: string;
  user_image?: string;
  role?: string;
  is_student?: boolean;
  message?: string;
}> {
  const formData = new FormData();
  formData.append("user_image", file);
  formData.append("file", file);
  if (userId) {
    formData.append("userId", String(userId));
    formData.append("user_id", String(userId));
  }
  if (currentImage) {
    formData.append("current_image", currentImage);
  }
  if (role) {
    formData.append("role", role);
    formData.append("user_role", role);
  }
  if (isStudent !== undefined) {
    formData.append("is_student", String(isStudent));
  }

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(userId ? { "X-User-Id": String(userId) } : {}),
        ...(role ? { "X-User-Role": role } : {}),
      },
      body: formData,
    });
    return await res.json();
  } catch {
    return { success: false, message: "Failed to upload image." };
  }
}

/** POST /api/auth/register — Register new user & dispatch OTP via Nodemailer
 *  Email is normalized (trim + toLowerCase) before sending.
 *  Returns _status: 409 when email already exists.
 */
export async function registerUser(
  name: string,
  email: string,
  mobile: string,
  password: string,
  user_image?: string | File | null
): Promise<ApiResponse<RegisterResponseData>> {
  const normalizedEmail = email.trim().toLowerCase();
  let ip = "127.0.0.1";
  try {
    ip = await detectClientPublicIp();
  } catch {
    /* fallback */
  }

  if (
    user_image &&
    typeof user_image === "object" &&
    typeof (user_image as any).arrayBuffer === "function"
  ) {
    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("email", normalizedEmail);
    formData.append("mobile", mobile.trim());
    formData.append("password", password);
    formData.append("user_image", user_image as File);
    formData.append("ip", ip);
    formData.append("last_login_ip", ip);
    formData.append("last_login_at", getCurrentSqlDateTime());

    return apiRequest<RegisterResponseData>("/api/auth/register", {
      method: "POST",
      body: formData,
    });
  }

  return apiRequest<RegisterResponseData>("/api/auth/register", {
    method: "POST",
    body: {
      name: name.trim(),
      email: normalizedEmail,
      mobile: mobile.trim(),
      password,
      user_image: typeof user_image === "string" ? user_image : undefined,
      ip,
      last_login_ip: ip,
      last_login_at: getCurrentSqlDateTime(),
    },
  });
}

/** POST /api/auth/verify-otp — Verify 6-digit OTP and activate account */
export async function verifyOtp(
  email: string,
  otp: string
): Promise<ApiResponse<VerifyOtpResponseData>> {
  const normalizedEmail = email.trim().toLowerCase();
  let ip = "127.0.0.1";
  try {
    ip = await detectClientPublicIp();
  } catch {
    /* fallback */
  }

  return apiRequest<VerifyOtpResponseData>("/api/auth/verify-otp", {
    method: "POST",
    body: {
      email: normalizedEmail,
      otp: otp.trim(),
      ip,
      last_login_ip: ip,
      last_login_at: getCurrentSqlDateTime(),
    },
  });
}

/** POST /api/auth/resend-otp — Resend 6-digit OTP with 60s cooldown limit */
export async function resendOtp(
  email: string
): Promise<ApiResponse<{ wait_seconds?: number }>> {
  const normalizedEmail = email.trim().toLowerCase();
  return apiRequest<{ wait_seconds?: number }>("/api/auth/resend-otp", {
    method: "POST",
    body: {
      email: normalizedEmail,
    },
  });
}

/** POST /api/auth/forgot-password — Initiate password reset (requests 6-digit OTP) */
export async function forgotPassword(
  email: string
): Promise<ApiResponse<null>> {
  const normalizedEmail = email.trim().toLowerCase();
  return apiRequest<null>("/api/auth/forgot-password", {
    method: "POST",
    body: { email: normalizedEmail },
  });
}

/** POST /api/auth/verify-reset-otp — Verify 6-digit reset OTP */
export async function verifyResetOtp(
  email: string,
  otp: string
): Promise<ApiResponse<null>> {
  const normalizedEmail = email.trim().toLowerCase();
  return apiRequest<null>(
    "/api/auth/verify-reset-otp",
    {
      method: "POST",
      body: {
        email: normalizedEmail,
        otp: otp.trim(),
      },
    }
  );
}

/** POST /api/auth/reset-password — Set new password */
export async function resetPassword(
  email: string,
  newPassword: string
): Promise<ApiResponse<null>> {
  const normalizedEmail = email.trim().toLowerCase();
  return apiRequest<null>("/api/auth/reset-password", {
    method: "POST",
    body: {
      email: normalizedEmail,
      new_password: newPassword,
    },
  });
}

// ─── User APIs ─────────────────────────────────────────────────────────────

/** GET /api/user/me — Get current user profile */
export async function getMyProfile(
  userId: number,
  userRole: "student" | "user"
): Promise<ApiResponse<UserProfile>> {
  return apiRequest<UserProfile>("/api/user/me", { userId, userRole });
}

/** PATCH /api/user/profile — Update name / mobile / user_image (supports File, FormData, or JSON) */
export async function updateUserProfile(
  userId: number,
  userRole: "student" | "user",
  data:
    | FormData
    | {
        name?: string;
        mobile?: string;
        user_image?: string | File | null;
        [key: string]: any;
      }
): Promise<ApiResponse<UserProfile>> {
  if (data instanceof FormData) {
    if (!data.has("_method")) data.append("_method", "PATCH");
    return apiRequest<UserProfile>("/api/user/profile", {
      method: "PATCH",
      userId,
      userRole,
      body: data,
    });
  }

  const obj = data as {
    name?: string;
    mobile?: string;
    user_image?: string | File | null;
    [key: string]: any;
  };

  // If user_image is a File, package as FormData for multipart upload
  if (
    obj?.user_image &&
    typeof obj.user_image === "object" &&
    typeof (obj.user_image as any).arrayBuffer === "function"
  ) {
    const formData = new FormData();
    if (obj.name) formData.append("name", obj.name);
    if (obj.mobile) formData.append("mobile", obj.mobile);
    formData.append("user_image", obj.user_image as File);
    formData.append("_method", "PATCH");
    return apiRequest<UserProfile>("/api/user/profile", {
      method: "PATCH",
      userId,
      userRole,
      body: formData,
    });
  }

  return apiRequest<UserProfile>("/api/user/profile", {
    method: "PATCH",
    userId,
    userRole,
    body: obj,
  });
}

/** PUT /api/user/password — Change user password */
export async function changeUserPassword(
  userId: number,
  userRole: "student" | "user",
  current_password: string,
  new_password: string
): Promise<ApiResponse<null>> {
  return apiRequest("/api/user/password", {
    method: "PUT",
    userId,
    userRole,
    body: { current_password, new_password },
  });
}

// ─── Student APIs ──────────────────────────────────────────────────────────

/** PUT /api/student/password — Change student password */
export async function changeStudentPassword(
  userId: number,
  current_password: string,
  new_password: string
): Promise<ApiResponse<null>> {
  return apiRequest("/api/student/password", {
    method: "PUT",
    userId,
    userRole: "student",
    body: { current_password, new_password },
  });
}

// ─── Course APIs ───────────────────────────────────────────────────────────

export interface Course {
  course_id: number;
  course_code: string;
  course_name: string;
  course_img_path?: string | null;
  course_description?: string;
  course_modules?: string;
  course_duration: string;
  course_fee: string | number;
  course_status: "active" | "inactive" | string;
  created_at?: string;
  updated_at?: string;
}

// CourseItem alias for backward compatibility
export type CourseItem = Course;

/** GET /api/course — Public course catalogue with fees, duration & modules */
export async function getCourses(): Promise<ApiResponse<Course[]>> {
  const res = await apiRequest<Course[] | { courses: Course[] }>("/api/course");
  if (res.success && res.data) {
    if (Array.isArray(res.data)) {
      return { ...res, data: res.data };
    }
    if ("courses" in res.data && Array.isArray((res.data as { courses: Course[] }).courses)) {
      return { ...res, data: (res.data as { courses: Course[] }).courses };
    }
  }
  return res as ApiResponse<Course[]>;
}

/** GET /api/course/{id} — Single course details */
export async function getCourseById(
  courseId: number | string
): Promise<ApiResponse<Course>> {
  return apiRequest<Course>(`/api/course/${courseId}`);
}

/** POST /api/course — Create a new course (Admin) */
export async function createCourse(
  data: Partial<Course>,
  userId?: number
): Promise<ApiResponse<Course>> {
  return apiRequest<Course>("/api/course", {
    method: "POST",
    body: data,
    userId,
    userRole: "user",
  });
}

/** PUT /api/course/{id} — Update course details (Admin) */
export async function updateCourse(
  id: number | string,
  data: Partial<Course>,
  userId?: number
): Promise<ApiResponse<Course>> {
  return apiRequest<Course>(`/api/course/${id}`, {
    method: "PUT",
    body: data,
    userId,
    userRole: "user",
  });
}

/** DELETE /api/course/{id} — Deactivate / remove course (Admin) */
export async function deleteCourse(
  id: number | string,
  userId?: number
): Promise<ApiResponse<null>> {
  return apiRequest<null>(`/api/course/${id}`, {
    method: "DELETE",
    userId,
    userRole: "user",
  });
}

// ─── Student Profile APIs ──────────────────────────────────────────────────

export interface StudentProfile {
  st_id: number;
  st_user_id: number;
  st_regno: string;
  st_centre_id: number;
  st_name: string;
  st_email: string;
  st_mobile: string;
  user_image?: string | null;
  st_father_name?: string;
  st_dob?: string;
  dob?: string | null;
  st_gender?: string;
  st_address?: string;
  st_city?: string;
  st_state?: string;
  st_pincode?: string;
  st_qualification?: string;
  centre_name?: string;
  centre_code?: string;
  docs_st_image?: string | null;
  docs_st_aadhaar_front?: string | null;
  docs_st_aadhaar_back?: string | null;
  docs_st_qualification?: string | null;
  documents?: {
    docs_st_image?: string | null;
    docs_st_aadhaar_front?: string | null;
    docs_st_aadhaar_back?: string | null;
    docs_st_qualification?: string | null;
  } | null;
  offline_courses?: EnrollmentItem[];
  online_courses?: OnlineEnrolledCourse[];
  enrolled_courses?: any[];
  courses?: any[];
}

/** GET /api/student/me — Get authenticated student's full profile */
export async function getStudentMe(
  userId: number
): Promise<ApiResponse<StudentProfile & { is_student: boolean }>> {
  return apiRequest<StudentProfile & { is_student: boolean }>("/api/student/me", {
    userId,
    userRole: "student",
  });
}

/** GET /api/student/{id} — Get student details by ID */
export async function getStudentById(
  userId: number,
  studentId: number
): Promise<ApiResponse<StudentProfile>> {
  return apiRequest<StudentProfile>(`/api/student/${studentId}`, {
    userId,
    userRole: "student",
  });
}

/** PUT /api/student/{id} — Update student profile */
export async function updateStudentProfile(
  userId: number,
  studentId: number,
  data: Partial<StudentProfile>
): Promise<ApiResponse<StudentProfile>> {
  return apiRequest<StudentProfile>(`/api/student/${studentId}`, {
    method: "PUT",
    userId,
    userRole: "student",
    body: data,
  });
}

// ─── Enrollment APIs ───────────────────────────────────────────────────────

export interface EnrollmentItem {
  stc_id: number;
  student_id: number;
  registration_number: string;
  course_id: number;
  stc_course_id?: number;
  course_name?: string;
  course_code?: string;
  course_format?: "offline" | "online" | string;
  batch_id?: number;
  batch_name?: string;
  batch_title?: string;
  stc_status?: string;
  status?: string;
  total_fee: number;
  discount: number;
  initial_payment: number;
  total_paid?: number;
  total_successful_paid?: number;
  dues: number;
  remaining_dues?: number;
  stc_total_fee?: number;
  stc_discount?: number;
  stc_initial_payment?: number;
  stc_dues?: number;
  created_at?: string;
}

export interface AdmissionFormData {
  st_fname?: string;
  st_mname?: string;
  st_dob?: string;
  st_gender?: string;
  st_mobile_parent?: string;
  st_aadhaar?: string;
  st_address?: string;
  st_state?: string;
  st_city?: string;
  st_pincode?: string;
  st_qualification?: string;
  st_referredby?: string;
  referred_by?: string;
  referredby?: string;
}

export interface DocumentPathStrings {
  docs_st_image?: string;
  docs_st_aadhaar_front?: string;
  docs_st_aadhaar_back?: string;
  docs_st_qualification?: string;
}

export interface FinalizeEnrollmentPayload {
  course_id: number;
  centre_id: number;
  batch_id?: number | null;
  discount?: number;
  payment_method?: "razorpay" | "center";
  payment_mode?: string;
  initial_payment?: number;
  center_deposit_amount?: number;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  admission?: AdmissionFormData;
  documents?: DocumentPathStrings;
  name?: string;
  email?: string;
  mobile?: string;
  user_image?: string;
  student_id?: number;
  st_referredby?: string;
  referred_by?: string;
  referredby?: string;
  coupon_code?: string;
}

export interface EnrollmentResponseData {
  stc_id: number;
  student_id: number;
  registration_number: string | null;
  course_id: number;
  centre_id?: number;
  amount_paid?: number;
  center_deposit_amount?: number;
  center_balance_due?: number;
  total_fee?: number;
  discount?: number;
  initial_payment?: number;
  dues?: number;
  payment_mode?: string;
  payment_status?: string;
  payment_reference?: string;
  role: "student";
  is_student: true;
  user_id: number;
  email_sent?: boolean;
  email_recipient?: string;
  user_image?: string | null;
}

/** POST /api/enrollment — Complete verified enrollment after Razorpay payment */
export async function createEnrollment(
  userId: number,
  data: FinalizeEnrollmentPayload | Record<string, any>,
  userRole: "user" | "student" = "user"
): Promise<ApiResponse<EnrollmentResponseData>> {
  return apiRequest<EnrollmentResponseData>("/api/enrollment", {
    method: "POST",
    userId,
    userRole,
    body: {
      ...data,
      userId,
      userRole,
    },
  });
}

/** POST /api/razorpay/order — Create server-side Razorpay order */
export async function createRazorpayOrder(
  userId: number,
  courseId: number,
  amount: number,
  discount: number = 0
): Promise<ApiResponse<{
  order_id: string;
  amount: number;
  currency: string;
  key: string;
}>> {
  return apiRequest("/api/razorpay/order", {
    method: "POST",
    userId,
    userRole: "user",
    body: {
      userId,
      course_id: courseId,
      amount,
      discount,
    },
  });
}

/** GET /api/enrollment — List student's enrollments */
export async function getEnrollments(
  userId: number,
  studentId?: number,
  userRole: "student" | "user" | "admin" = "student"
): Promise<ApiResponse<{ enrollments: EnrollmentItem[] } | EnrollmentItem[]>> {
  return apiRequest("/api/enrollment", {
    userId,
    userRole,
    studentId,
  });
}

/** GET /api/enrollment/{id} — Get enrollment detail */
export async function getEnrollmentById(
  userId: number,
  enrollmentId: number
): Promise<ApiResponse<EnrollmentItem>> {
  return apiRequest(`/api/enrollment/${enrollmentId}`, {
    userId,
    userRole: "student",
  });
}

/** PATCH /api/enrollment/{id} — Admin update enrollment (discount, initial_payment, batch_id) */
export async function updateEnrollment(
  userId: number,
  enrollmentId: number,
  data: {
    discount?: number;
    initial_payment?: number;
    batch_id?: number | null;
  }
): Promise<ApiResponse<any>> {
  return apiRequest(`/api/enrollment/${enrollmentId}`, {
    method: "PATCH",
    userId,
    userRole: "admin",
    body: data,
  });
}

// ─── Fee & Transaction APIs ────────────────────────────────────────────────

export interface FeeTransactionItem {
  transaction_id: number;
  enrollment_id: number;
  student_id?: number;
  registration_no?: string;
  student_name?: string;
  course_name: string;
  amount: number;
  mode: string;
  payment_reference: string;
  remark: string;
  date: string;
  tr_id?: number;
  tr_stc_id?: number;
  stc_id?: number;
  tr_stco_id?: number | null;
  tr_course_type?: string;
  tr_amount?: number;
  tr_mode?: string;
  tr_payref?: string;
  tr_remark?: string;
  tr_date?: string;
  summary?: {
    total_fee: number;
    discount: number;
    total_paid: number;
    dues: number;
    stc_total_fee?: number;
    stc_discount?: number;
    stc_initial_payment?: number;
    stc_dues?: number;
    total_successful_paid?: number;
    remaining_dues?: number;
    coupon_code?: string | null;
    course_fee?: number;
    initial_payment?: number;
  };
  total_fee?: number;
  course_fee?: number;
  discount?: number;
  discount_amount?: number;
  coupon_code?: string | null;
  coupon_discount?: number;
  amount_paid?: number;
  initial_payment?: number;
  dues?: number;
  remaining_dues?: number;
  stco_id?: number | null;
  razorpay_payment_id?: string;
  razorpay_order_id?: string | null;
  is_online?: boolean;
  course_format?: string;
  course_id?: number | string;
  course_code?: string;
  payref?: string;
  status?: string;
  registration_number?: string;
  type?: string;
  batch_name?: string;
  center_name?: string;
}

export interface FeeTransactionResponse {
  transactions: FeeTransactionItem[];
  page?: number;
  limit?: number;
  count?: number;
}

/** GET /api/fee — List student fee transactions & payment ledger */
export async function getFeeTransactions(
  userId: number
): Promise<ApiResponse<FeeTransactionResponse>> {
  return apiRequest<FeeTransactionResponse>("/api/fee", {
    userId,
    userRole: "student",
  });
}

/** POST /api/fee — Record installment payment */
export async function recordFeePayment(
  userId: number,
  data: {
    stc_id: number;
    amount: number;
    mode: "upi" | "card" | "netbanking" | "cash" | "razorpay" | string;
    payref: string;
    remark?: string;
  }
): Promise<ApiResponse<{
  tr_id: number;
  stc_id: number;
  amount_paid: number;
  mode: string;
  payref: string;
  remark: string;
  total_fee: number;
  discount: number;
  total_paid: number;
  remaining_dues: number;
}>> {
  return apiRequest("/api/fee", {
    method: "POST",
    userId,
    userRole: "student",
    body: data,
  });
}

// ─── Attendance Tracking APIs ──────────────────────────────────────────────

export interface AttendanceRecord {
  attendance_id: number;
  student_reg: string;
  date: string;
  timein: string;
  timeout: string | null;
  status: number;
}

/** POST /api/attendance/in — Student Check-in (Come In) */
export async function recordAttendanceIn(
  userId: number,
  student_reg: string
): Promise<ApiResponse<AttendanceRecord>> {
  return apiRequest<AttendanceRecord>("/api/attendance/in", {
    method: "POST",
    userId,
    userRole: "student",
    body: { student_reg },
  });
}

/** POST /api/attendance/out — Student Check-out (Go Out) */
export async function recordAttendanceOut(
  userId: number,
  student_reg: string
): Promise<ApiResponse<AttendanceRecord>> {
  return apiRequest<AttendanceRecord>("/api/attendance/out", {
    method: "POST",
    userId,
    userRole: "student",
    body: { student_reg },
  });
}

/** GET /api/attendance/student/{regno} — Student Attendance History */
export async function getStudentAttendance(
  userId: number,
  regno: string
): Promise<ApiResponse<{ records: AttendanceRecord[] } | AttendanceRecord[]>> {
  return apiRequest(`/api/attendance/student/${regno}`, {
    userId,
    userRole: "student",
  });
}

// ─── Student Documents APIs ────────────────────────────────────────────────

export interface StudentDocumentsPaths {
  docs_id?: number;
  docs_st_id?: number;
  docs_st_image?: string | null;
  docs_st_aadhaar_front?: string | null;
  docs_st_aadhaar_back?: string | null;
  docs_st_qualification?: string | null;
  st_regno?: string;
  st_name?: string;
}

/** GET /api/document/student/{student_id} — Get student document paths */
export async function getStudentDocuments(
  userId: number,
  studentId: number
): Promise<ApiResponse<StudentDocumentsPaths>> {
  return apiRequest<StudentDocumentsPaths>(`/api/document/student/${studentId}`, {
    userId,
    userRole: "student",
  });
}

/** POST /api/document/student/{student_id} — Save / Update document path strings */
export async function saveStudentDocuments(
  userId: number,
  studentId: number | string,
  paths: {
    docs_st_image?: string | null;
    docs_st_aadhaar_front?: string | null;
    docs_st_aadhaar_back?: string | null;
    docs_st_qualification?: string | null;
  }
): Promise<ApiResponse<StudentDocumentsPaths>> {
  return apiRequest<StudentDocumentsPaths>(`/api/document/student/${studentId}`, {
    method: "POST",
    userId,
    userRole: "student",
    body: paths,
  });
}

/**
 * Upload student documents directly via multipart/form-data.
 * Adheres to Section 10.2 of Brainzima REST API specification.
 */
export async function uploadStudentDocuments(
  studentId: number,
  userId: number,
  files: {
    docs_st_image?: File;
    docs_st_aadhaar_front?: File;
    docs_st_aadhaar_back?: File;
    docs_st_qualification?: File;
  }
): Promise<ApiResponse<StudentDocumentsPaths>> {
  const formData = new FormData();
  if (files.docs_st_image) formData.append("docs_st_image", files.docs_st_image);
  if (files.docs_st_aadhaar_front) formData.append("docs_st_aadhaar_front", files.docs_st_aadhaar_front);
  if (files.docs_st_aadhaar_back) formData.append("docs_st_aadhaar_back", files.docs_st_aadhaar_back);
  if (files.docs_st_qualification) formData.append("docs_st_qualification", files.docs_st_qualification);

  try {
    const res = await fetch(`/api/document/student/${studentId}`, {
      method: "POST",
      headers: {
        "X-User-Id": String(userId),
        "X-User-Role": "student",
      },
      body: formData,
    });
    return await res.json();
  } catch {
    return {
      success: false,
      message: "Failed to upload student documents.",
    };
  }
}

/** Upload student document file to PHP backend via /api/upload */
export async function uploadStudentDocumentFile(
  file: File,
  docType: string,
  studentId: number | string,
  regno?: string | null,
  userId?: number | string
): Promise<{
  success: boolean;
  message?: string;
  path?: string;
  db_path?: string;
  url?: string;
  filename?: string;
  doc_type?: string;
  user_image?: string;
}> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("doc_type", docType);
  formData.append(docType, file);
  formData.append("student_id", String(studentId));
  if (regno) formData.append("registration_number", regno);
  if (userId) formData.append("userId", String(userId));

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(userId ? { "X-User-Id": String(userId) } : {}),
        "X-User-Role": "student",
      },
      body: formData,
    });
    return await res.json();
  } catch {
    return { success: false, message: "Failed to upload document file." };
  }
}

// ─── Study Notes APIs ──────────────────────────────────────────────────────

export interface StudyNoteItem {
  notes_id: number;
  notes_title: string;
  notes_description: string;
  notes_pdf: string;
  notes_course_id: number;
  course_name?: string;
}

/** GET /api/notes — List enrolled course notes & PDFs */
export async function getNotes(
  userId: number
): Promise<ApiResponse<{ notes: StudyNoteItem[] } | StudyNoteItem[]>> {
  return apiRequest("/api/notes", {
    userId,
    userRole: "student",
  });
}

// ─── Franchisee APIs ───────────────────────────────────────────────────────

export interface FranchiseeItem {
  franchisee_id: number;
  franchisee_name: string;
  franchisee_code?: string;
  franchisee_person?: string;
  franchisee_adrs?: string;
  franchisee_city?: string;
  franchisee_state?: string;
  franchisee_pin?: string;
  franchisee_mobile?: string;
  franchisee_email?: string;
  franchisee_status?: string;
  // Aliases for compatibility
  centre_id: number;
  centre_name: string;
}

/** GET /api/franchisee — List active franchisee centres */
export async function getFranchisees(): Promise<ApiResponse<FranchiseeItem[]>> {
  const res = await apiRequest<any>("/api/franchisee");
  if (res.success && res.data) {
    let rawList: any[] = [];
    if (Array.isArray(res.data)) {
      rawList = res.data;
    } else if (Array.isArray(res.data.franchisees)) {
      rawList = res.data.franchisees;
    }

    const normalized: FranchiseeItem[] = rawList.map((item) => {
      const fId = Number(item.franchisee_id || item.centre_id || 0);
      const fName = String(item.franchisee_name || item.centre_name || "Brainzima Study Centre");
      const fAdrs = String(
        item.franchisee_adrs ||
        item.centre_address ||
        [item.franchisee_city || item.centre_city, item.franchisee_state || item.centre_state]
          .filter(Boolean)
          .join(", ") ||
        "India"
      );

      return {
        ...item,
        franchisee_id: fId,
        franchisee_name: fName,
        franchisee_adrs: fAdrs,
        centre_id: fId,
        centre_name: fName,
      };
    });

    return {
      ...res,
      data: normalized,
    };
  }
  return res as ApiResponse<FranchiseeItem[]>;
}

/** GET /api/franchisee/{id} — Single franchisee details */
export async function getFranchiseeById(
  id: number
): Promise<ApiResponse<FranchiseeItem>> {
  const res = await apiRequest<any>(`/api/franchisee/${id}`);
  if (res.success && res.data) {
    const item = res.data;
    const fId = Number(item.franchisee_id || item.centre_id || id);
    const fName = String(item.franchisee_name || item.centre_name || "Brainzima Study Centre");
    const fAdrs = String(
      item.franchisee_adrs ||
      item.centre_address ||
      [item.franchisee_city, item.franchisee_state].filter(Boolean).join(", ")
    );

    return {
      ...res,
      data: {
        ...item,
        franchisee_id: fId,
        franchisee_name: fName,
        franchisee_adrs: fAdrs,
        centre_id: fId,
        centre_name: fName,
      },
    };
  }
  return res;
}

// ─── Centralized Student Portal API Helpers (Section 16) ───────────────────

/** GET /api/user/me — Current user account information */
export async function getCurrentUser(
  userId: number
): Promise<ApiResponse<UserProfile>> {
  return getMyProfile(userId, "student");
}

/** GET /api/student/me — Currently authenticated student academic profile */
export async function getCurrentStudent(
  userId: number
): Promise<ApiResponse<StudentProfile & { is_student: boolean }>> {
  return getStudentMe(userId);
}

/** GET /api/enrollment — Student's enrolled courses */
export async function getStudentEnrollments(
  userId: number,
  studentId?: number,
  userRole: "student" | "user" | "admin" = "student"
): Promise<ApiResponse<{ enrollments: EnrollmentItem[] } | EnrollmentItem[]>> {
  return getEnrollments(userId, studentId, userRole);
}

/** GET /api/fee — Student's fee ledger, summary balances, and transactions */
export async function getStudentFees(
  userId: number
): Promise<ApiResponse<FeeTransactionResponse>> {
  return getFeeTransactions(userId);
}

/** GET /api/notes — Study notes & PDF resources for enrolled courses */
export async function getStudentNotes(
  userId: number
): Promise<ApiResponse<{ notes: StudyNoteItem[] } | StudyNoteItem[]>> {
  return getNotes(userId);
}

/** POST /api/razorpay/order — Create server-side order for fee installment */
export async function createFeeInstallmentOrder(
  userId: number,
  stcId: number,
  amount: number,
  studentId?: number | null
): Promise<ApiResponse<{
  order_id: string;
  amount: number;
  currency: string;
  key: string;
}>> {
  return apiRequest("/api/razorpay/order", {
    method: "POST",
    userId,
    userRole: "student",
    body: {
      userId,
      user_id: userId,
      student_id: studentId ?? undefined,
      stc_id: stcId,
      amount,
    },
  });
}

/** POST /api/fee — Verify Razorpay payment tokens and record installment payment */
export async function recordVerifiedFeePayment(
  userId: number,
  data: {
    stc_id: number;
    amount: number;
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
    student_id?: number | null;
    mode?: string;
    payref?: string;
    remark?: string;
  }
): Promise<ApiResponse<{
  transaction_id: number;
  stc_id: number;
  student_id: number;
  course_name: string;
  amount_paid: number;
  payment_mode: string;
  payment_reference: string;
  remaining_dues: number;
  email_sent?: boolean;
  email_recipient?: string;
}>> {
  const payref = data.payref || data.razorpay_payment_id;
  return apiRequest("/api/fee", {
    method: "POST",
    userId,
    userRole: "student",
    body: {
      ...data,
      stc_id: data.stc_id,
      amount: data.amount,
      mode: data.mode || "razorpay",
      payref,
      razorpay_payment_id: data.razorpay_payment_id || payref,
      remark: data.remark || "Course fee installment payment",
      user_id: userId,
      student_id: data.student_id ?? undefined,
    },
  });
}

// ─── Online Courses APIs ───────────────────────────────────────────────────

export interface OnlineCourse {
  course_id: number;
  course_code: string;
  course_name: string;
  course_img_path?: string | null;
  course_description?: string | null;
  course_type: "basic" | "normal" | string;
  course_validity?: string | null;
  course_duration?: string | null;
  course_fee: string | number;
  course_status: "active" | "inactive" | string;
  created_at?: string;
  updated_at?: string;
  syllabus?: OnlineSyllabusItem[];
}

export interface OnlineSyllabusItem {
  syllabus_id: number;
  course_id: number;
  syllabus_title: string;
  syllabus_topic: string;
  syllabus_topic_url?: string | null;
  topic_order: number;
  syllabus_status: "active" | "inactive" | string;
  created_at?: string;
  updated_at?: string;
  is_free?: boolean;
  is_locked?: boolean;
}

export interface OnlineCourseAccessData {
  course_id: number;
  purchased: boolean;
  authenticated?: boolean;
  user_id?: number;
}

/** GET /api/onlinecoures — List all active online courses */
export async function getOnlineCourses(params?: {
  status?: string;
  type?: string;
}): Promise<ApiResponse<OnlineCourse[]>> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.type) query.set("type", params.type);
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<OnlineCourse[]>(`/api/onlinecoures${qs}`);
}

/** GET /api/onlinecoures/{id} — Single online course with syllabus */
export async function getOnlineCourseById(
  courseId: number
): Promise<ApiResponse<OnlineCourse>> {
  return apiRequest<OnlineCourse>(`/api/onlinecoures/${courseId}`);
}

/** GET /api/onlinecoures/{id}/syllabus — Syllabus for course ordered by topic_order ASC */
export async function getOnlineCourseSyllabus(
  courseId: number
): Promise<ApiResponse<OnlineSyllabusItem[]>> {
  return apiRequest<OnlineSyllabusItem[]>(`/api/onlinecoures/${courseId}/syllabus`);
}

/** GET /api/onlinecoures/{id}/access — Verify user's purchase access from backend */
export async function checkOnlineCourseAccess(
  courseId: number,
  userId?: number,
  userRole: "user" | "student" = "user"
): Promise<ApiResponse<OnlineCourseAccessData>> {
  return apiRequest<OnlineCourseAccessData>(`/api/onlinecoures/${courseId}/access`, {
    userId,
    userRole,
  });
}

/** POST /api/razorpay/order — Create order for online course purchase */
export async function createOnlineCourseOrder(
  userId: number,
  courseId: number,
  amount: number,
  discount: number = 0
): Promise<ApiResponse<{
  order_id: string;
  amount: number;
  currency: string;
  key: string;
}>> {
  return apiRequest("/api/razorpay/order", {
    method: "POST",
    userId,
    userRole: "user",
    body: {
      userId,
      user_id: userId,
      course_id: courseId,
      amount,
      discount,
      is_online: true,
      course_type: "online",
    },
  });
}

export interface OnlineCoursePurchaseResult {
  purchased: boolean;
  purchase_id?: string;
  course_id: number;
  amount_paid?: number;
  total_fee?: number;
  discount?: number;
  coupon_code?: string | null;
  user_id?: number;
  student_id?: number | null;
  registration_number?: string | null;
  role?: string;
  is_student?: boolean;
  st_referredby?: string;
  email_sent?: boolean;
  email_recipient?: string | null;
}

/** POST /api/onlinecoures/{id}/purchase — Verify payment & confirm purchase on backend */
export async function verifyOnlineCoursePurchase(
  courseId: number,
  userId: number,
  data: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
    user_email?: string;
    user_name?: string;
    coupon_code?: string;
    discount?: number;
    discount_amount?: number;
    course_fee?: number;
  },
  userRole: "user" | "student" = "user"
): Promise<ApiResponse<OnlineCoursePurchaseResult>> {
  return apiRequest(`/api/onlinecoures/${courseId}/purchase`, {
    method: "POST",
    userId,
    userRole,
    body: {
      ...data,
      userId,
      user_id: userId,
      course_id: courseId,
    },
  });
}

export interface OnlineEnrolledCourse {
  course_id: number;
  course_code: string;
  course_name: string;
  course_img_path?: string | null;
  course_description?: string;
  course_type?: string;
  course_duration?: string;
  course_validity?: string;
  course_fee: number | string;
  total_fee?: number | string;
  amount_paid: number | string;
  discount?: number | string;
  coupon_code?: string | null;
  purchased_at?: string;
  is_online?: boolean;
  status?: string;
  payment_status?: string;
  enrollment_status?: string;
  course_format?: "online";
  stco_id?: number;
  enrollment_id?: number;
  student_id?: number | null;
  registration_number?: string | null;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  created_at?: string;
}

/** GET /api/onlinecoures/enrolled — Retrieve all online courses purchased by the student */
export async function getStudentOnlineCourses(
  userId: number,
  userRole: "user" | "student" = "student"
): Promise<ApiResponse<OnlineEnrolledCourse[]>> {
  return apiRequest<OnlineEnrolledCourse[]>("/api/onlinecoures/enrolled", {
    method: "GET",
    userId,
    userRole,
  });
}

// ─── Coupons API (Offline & Online) ────────────────────────────────────────

export interface CouponItem {
  coupon_id: number;
  coupon_code: string;
  coupon_for: "all" | "user_id" | string;
  coupon_for_user_id?: number | null;
  coupon_discount_type: "percentage" | "amount" | string;
  coupon_discount: string | number;
  coupon_for_course: "all" | "specific" | string;
  coupon_for_course_id?: number | null;
  coupon_for_mobile?: string | null;
  coupon_for_email?: string | null;
  coupon_validity: string;
  coupon_expired: number | boolean;
  coupon_limit?: number | null;
  created_at?: string;
  updated_at?: string;
  target_course_code?: string | null;
  target_course_name?: string | null;
  target_user_name?: string | null;
  target_user_email?: string | null;
}

export interface ValidateCouponPayload {
  coupon_code: string;
  course_id: number;
  course_fee?: number;
  base_amount?: number;
  user_id?: number;
  email?: string;
  mobile?: string;
}

export interface CouponValidationData {
  coupon_id?: number;
  coupon_code: string;
  is_valid: boolean;
  discount_type: "percentage" | "amount" | string;
  discount_value: number;
  base_amount: number;
  discount_amount: number;
  net_payable: number;
}

// ─── Offline Coupons (/api/coupon → bi_coupons) ───────────────────────────

/** GET /api/coupon — List offline course coupons from bi_coupons */
export async function getOfflineCoupons(
  params?: {
    status?: "active" | "expired" | string;
    discount_type?: "percentage" | "amount" | string;
    course_id?: number;
    user_id?: number;
    search?: string;
  },
  userId?: number,
  userRole?: "user" | "student" | "admin"
): Promise<ApiResponse<CouponItem[]>> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.discount_type) query.set("discount_type", params.discount_type);
  if (params?.course_id) query.set("course_id", String(params.course_id));
  if (params?.user_id) query.set("user_id", String(params.user_id));
  if (params?.search) query.set("search", params.search);
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<CouponItem[]>(`/api/coupon${qs}`, { userId, userRole });
}

/** POST /api/coupon/validate — Validate offline coupon applicability & calculate server-side discount against bi_coupons */
export async function validateOfflineCoupon(
  payload: ValidateCouponPayload,
  userId?: number,
  userRole?: "user" | "student" | "admin"
): Promise<ApiResponse<CouponValidationData>> {
  return apiRequest<CouponValidationData>("/api/coupon/validate", {
    method: "POST",
    userId,
    userRole,
    body: payload,
  });
}

// ─── Online Coupons (/api/coupon-online → bi_coupons_online) ─────────────

/** GET /api/coupon-online — List online course coupons from bi_coupons_online */
export async function getOnlineCoupons(
  params?: {
    status?: "active" | "expired" | string;
    discount_type?: "percentage" | "amount" | string;
    course_id?: number;
    user_id?: number;
    search?: string;
  },
  userId?: number,
  userRole?: "user" | "student" | "admin"
): Promise<ApiResponse<CouponItem[]>> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.discount_type) query.set("discount_type", params.discount_type);
  if (params?.course_id) query.set("course_id", String(params.course_id));
  if (params?.user_id) query.set("user_id", String(params.user_id));
  if (params?.search) query.set("search", params.search);
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<CouponItem[]>(`/api/coupon-online${qs}`, { userId, userRole });
}

/** POST /api/coupon-online/validate — Validate online coupon applicability & calculate server-side discount against bi_coupons_online */
export async function validateOnlineCoupon(
  payload: ValidateCouponPayload,
  userId?: number,
  userRole?: "user" | "student" | "admin"
): Promise<ApiResponse<CouponValidationData>> {
  return apiRequest<CouponValidationData>("/api/coupon-online/validate", {
    method: "POST",
    userId,
    userRole,
    body: payload,
  });
}

/** Backward compatibility alias for validateOnlineCoupon */
export const validateCoupon = validateOnlineCoupon;

// ─── Online Quiz & Results APIs ──────────────────────────────────────────

export interface QuizQuestion {
  quiz_id: number;
  quiz_questions: string;
  quiz_option_1: string;
  quiz_option_2: string;
  quiz_option_3: string;
  quiz_option_4: string;
  quiz_correct_answer?: number;
}

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

export interface OnlineResultRecord {
  result_id: number;
  std_id: number;
  user_id?: number;
  course_id: number;
  marks: number;
  created_at: string;
  updated_at: string;
  extra?: OnlineResultExtra;
  st_name?: string;
  st_regno?: string;
  course_name?: string;
  course_code?: string;
}

/** GET /api/online-quiz-questions/random/{count} — Fetch random questions */
export async function getOnlineQuizQuestions(
  count: number = 50,
  courseId?: number
): Promise<ApiResponse<QuizQuestion[]>> {
  const query = courseId ? `?course_id=${courseId}` : "";
  return apiRequest<QuizQuestion[]>(`/api/online-quiz-questions/random/${count}${query}`);
}

/** GET /api/online-results — List results for student */
export async function getOnlineResults(
  params?: {
    std_id?: number;
    user_id?: number;
    course_id?: number;
    page?: number;
    limit?: number;
  },
  userId?: number,
  userRole?: "user" | "student" | "admin",
  studentId?: number
): Promise<ApiResponse<{ results: OnlineResultRecord[]; pagination: any }>> {
  const query = new URLSearchParams();
  if (params?.std_id) query.set("std_id", String(params.std_id));
  if (params?.user_id) query.set("user_id", String(params.user_id));
  if (params?.course_id) query.set("course_id", String(params.course_id));
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/api/online-results${qs}`, { userId, userRole, studentId });
}

/** Submit Quiz Result (Inserts on 1st attempt, Updates on 2nd/3rd attempts) */
export async function submitOnlineQuizResult(
  payload: {
    std_id?: number;
    user_id?: number;
    course_id: number;
    marks: number;
    extra: Partial<OnlineResultExtra>;
    st_name?: string;
    st_regno?: string;
    course_name?: string;
    course_code?: string;
  },
  userId?: number,
  userRole?: "user" | "student" | "admin",
  studentId?: number
): Promise<ApiResponse<OnlineResultRecord>> {
  return apiRequest<OnlineResultRecord>("/api/online-results", {
    method: "POST",
    userId,
    userRole,
    studentId,
    body: payload,
  });
}



// ── Course Feedback API ──────────────────────────────────────────

export interface CourseFeedbackRecord {
  feedback_id: number;
  coures_id: number;
  user_id?: number | null;
  student_name: string;
  comment: string;
  created_at?: string;
  updated_at?: string;
  extra?: {
    rating?: number;
    difficulty?: string;
    recommend?: boolean;
    tags?: string[];
    [key: string]: any;
  } | null;
}

/** GET /api/online-course-feedback — Fetch course feedbacks */
export async function getOnlineCourseFeedback(
  courseId?: number,
  options?: { page?: number; limit?: number }
): Promise<ApiResponse<CourseFeedbackRecord[]>> {
  const query = new URLSearchParams();
  if (courseId) query.set("coures_id", String(courseId));
  if (options?.page) query.set("page", String(options.page));
  if (options?.limit) query.set("limit", String(options.limit));
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<CourseFeedbackRecord[]>(`/api/online-course-feedback${qs}`);
}

/** POST /api/online-course-feedback — Submit course feedback & rating */
export async function submitOnlineCourseFeedback(
  payload: {
    coures_id: number;
    comment: string;
    extra?: {
      rating?: number;
      difficulty?: string;
      recommend?: boolean;
      tags?: string[];
      [key: string]: any;
    } | null;
  },
  userId?: number,
  userRole?: "user" | "student" | "admin"
): Promise<ApiResponse<CourseFeedbackRecord>> {
  return apiRequest<CourseFeedbackRecord>("/api/online-course-feedback", {
    method: "POST",
    userId,
    userRole,
    body: payload,
  });
}

/** PUT /api/online-course-feedback/{id} — Replace feedback */
export async function updateOnlineCourseFeedback(
  feedbackId: number,
  payload: {
    coures_id: number;
    comment: string;
    extra?: any;
  },
  userId?: number,
  userRole?: "user" | "student" | "admin"
): Promise<ApiResponse<CourseFeedbackRecord>> {
  return apiRequest<CourseFeedbackRecord>(`/api/online-course-feedback/${feedbackId}`, {
    method: "PUT",
    userId,
    userRole,
    body: payload,
  });
}

/** DELETE /api/online-course-feedback/{id} — Delete feedback */
export async function deleteOnlineCourseFeedback(
  feedbackId: number,
  userId?: number,
  userRole?: "user" | "student" | "admin"
): Promise<ApiResponse<null>> {
  return apiRequest<null>(`/api/online-course-feedback/${feedbackId}`, {
    method: "DELETE",
    userId,
    userRole,
  });
}

// ─── E-Books Library (bi_ebook_library) ────────────────────────────────────

export interface EbookChapter {
  title: string;
  page: number;
}

export interface EbookRecord {
  ebook_id: number;
  ebook_title: string;
  ebook_subtitle?: string;
  ebook_author: string;
  ebook_description?: string;
  ebook_edition?: string;
  ebook_publication?: string;
  ebook_pdf_link: string;
  raw_pdf_url?: string;
  category?: string;
  cover_image?: string;
  publication_year?: number;
  total_pages?: number;
  is_free?: boolean;
  extra?: {
    category?: string;
    cover_image?: string;
    pages?: number;
    year?: number;
    tag?: string;
    accent_color?: string;
    tech_stack?: string[];
    chapters?: EbookChapter[];
    [key: string]: any;
  } | null;
  created_at?: string;
  updated_at?: string;
}

/** GET /api/ebooks — Fetch all ebooks or filter by search/category/page */
export async function getEbooks(params?: {
  search?: string;
  category?: string;
  author?: string;
  page?: number;
  limit?: number;
}): Promise<ApiResponse<EbookRecord[]>> {
  const query = new URLSearchParams();
  if (params?.search) query.append("search", params.search);
  if (params?.category && params.category !== "All") query.append("category", params.category);
  if (params?.author) query.append("author", params.author);
  if (params?.page) query.append("page", String(params.page));
  if (params?.limit) query.append("limit", String(params.limit));

  const qs = query.toString();
  const endpoint = qs ? `/api/ebooks?${qs}` : "/api/ebooks";
  return apiRequest<EbookRecord[]>(endpoint, { method: "GET" });
}

/** GET /api/ebooks/{id} — Fetch single ebook by ID */
export async function getEbookById(ebookId: number): Promise<ApiResponse<EbookRecord>> {
  return apiRequest<EbookRecord>(`/api/ebooks/${ebookId}`, { method: "GET" });
}
