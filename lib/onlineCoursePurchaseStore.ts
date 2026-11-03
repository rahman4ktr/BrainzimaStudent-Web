// lib/onlineCoursePurchaseStore.ts
// Server-side persistent store for verified Online Course purchases & access control.
// Guarantees access verification is always checked on the backend and never trusted from frontend state.

import fs from "fs";
import path from "path";
import { getBackendApiUrl } from "./apiConfig";

export interface OnlineCoursePurchase {
  id: string;
  user_id: number;
  course_id: number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  amount: number;
  currency: string;
  course_fee?: number;
  discount?: number;
  coupon_code?: string;
  user_email?: string;
  user_name?: string;
  student_id?: number | null;
  registration_number?: string | null;
  purchased_at: string;
  status: "completed" | "refunded";
}

// In-memory cache + file-backed persistence
declare global {
  var __brainzimaOnlinePurchases: Map<string, OnlineCoursePurchase> | undefined;
}

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "online_course_purchases.json");

function getStoreMap(): Map<string, OnlineCoursePurchase> {
  if (globalThis.__brainzimaOnlinePurchases) {
    return globalThis.__brainzimaOnlinePurchases;
  }

  const map = new Map<string, OnlineCoursePurchase>();

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      const list: OnlineCoursePurchase[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const item of list) {
          const key = `${item.user_id}_${item.course_id}`;
          map.set(key, item);
        }
      }
    }
  } catch (err) {
    console.error("[OnlineCoursePurchaseStore] Error loading purchase file:", err);
  }

  globalThis.__brainzimaOnlinePurchases = map;
  return map;
}

function persistStoreFile(map: Map<string, OnlineCoursePurchase>) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const list = Array.from(map.values());
    fs.writeFileSync(STORE_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("[OnlineCoursePurchaseStore] Error saving purchase file:", err);
  }
}

/**
 * Checks if a user has valid purchased access to an online course.
 * Verifies against the server purchase records as well as checking bi_st_course_online backend.
 */
export async function isOnlineCoursePurchased(
  userId: number,
  courseId: number,
  userRole: string = "user"
): Promise<boolean> {
  if (!userId || !courseId) return false;

  const key = `${userId}_${courseId}`;
  const map = getStoreMap();

  // 1. Direct local verified purchase
  const localRecord = map.get(key);
  if (localRecord && localRecord.status === "completed") {
    return true;
  }

  // 1B. Check if any record in local store matches by student_id or user_id
  for (const item of map.values()) {
    if (
      Number(item.course_id) === courseId &&
      (Number(item.user_id) === userId || (item.student_id && Number(item.student_id) === userId)) &&
      item.status === "completed"
    ) {
      return true;
    }
  }

  // 2. Check online course access gate directly via backend (bi_st_course_online)
  try {
    const phpApi = getBackendApiUrl();

    // 2A. Direct access check endpoint
    const accessRes = await fetch(`${phpApi}/onlinecoures/${courseId}/access`, {
      headers: {
        Accept: "application/json",
        "X-User-Id": String(userId),
        "X-User-Role": userRole,
      },
      cache: "no-store",
    });

    if (accessRes.ok) {
      const accessData = await accessRes.json().catch(() => null);
      if (
        accessData?.data?.course_access === true ||
        accessData?.data?.enrolled === true ||
        accessData?.data?.purchased === true
      ) {
        return true;
      }
    }

    // 2B. Direct online enrollments list (bi_st_course_online)
    const enrRes = await fetch(`${phpApi}/onlinecoures/enrollment`, {
      headers: {
        Accept: "application/json",
        "X-User-Id": String(userId),
        "X-User-Role": userRole || "student",
      },
      cache: "no-store",
    });

    if (enrRes.ok) {
      const enrData = await enrRes.json().catch(() => null);
      let list: any[] = [];
      if (enrData?.data) {
        if (Array.isArray(enrData.data)) list = enrData.data;
        else if (Array.isArray(enrData.data.enrollments)) list = enrData.data.enrollments;
      }

      const match = list.some(
        (e: any) =>
          Number(e.course_id ?? e.stco_course_id) === courseId &&
          (e.stco_payment_status === "paid" || e.payment_status === "paid" || Number(e.stco_dues ?? 0) <= 0)
      );

      if (match) {
        return true;
      }
    }

    // 2C. Direct student profile online_courses array
    const meRes = await fetch(`${phpApi}/student/me`, {
      headers: {
        Accept: "application/json",
        "X-User-Id": String(userId),
        "X-User-Role": "student",
      },
      cache: "no-store",
    });

    if (meRes.ok) {
      const meData = await meRes.json().catch(() => null);
      const onlineCourses = Array.isArray(meData?.data?.online_courses)
        ? meData.data.online_courses
        : [];
      if (onlineCourses.some((c: any) => Number(c.course_id ?? c.stco_course_id) === courseId)) {
        return true;
      }
    }
  } catch (err) {
    console.warn("[OnlineCoursePurchaseStore] Backend bi_st_course_online check notice:", err);
  }

  return false;
}

/**
 * Persists a verified online course purchase transaction to the backend.
 */
export async function recordOnlineCoursePurchase(data: {
  userId: number;
  courseId: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amount: number;
  courseFee?: number;
  discount?: number;
  couponCode?: string;
  userEmail?: string;
  userName?: string;
  studentId?: number | null;
  registrationNumber?: string | null;
}): Promise<OnlineCoursePurchase> {
  const map = getStoreMap();
  const key = `${data.userId}_${data.courseId}`;

  const record: OnlineCoursePurchase = {
    id: `onl_pur_${Date.now()}_u${data.userId}_c${data.courseId}`,
    user_id: data.userId,
    course_id: data.courseId,
    razorpay_order_id: data.razorpayOrderId,
    razorpay_payment_id: data.razorpayPaymentId,
    amount: data.amount,
    currency: "INR",
    course_fee: data.courseFee,
    discount: data.discount,
    coupon_code: data.couponCode,
    user_email: data.userEmail,
    user_name: data.userName,
    student_id: data.studentId ?? null,
    registration_number: data.registrationNumber ?? null,
    purchased_at: new Date().toISOString(),
    status: "completed",
  };

  map.set(key, record);
  persistStoreFile(map);

  return record;
}

/**
 * Returns all online course IDs purchased by a specific user.
 */
export async function getUserPurchasedCourseIds(
  userId: number,
  userRole: string = "user"
): Promise<number[]> {
  if (!userId) return [];

  const purchasedList = await getUserPurchasedOnlineCourses(userId, userRole);
  return purchasedList.map((c) => c.course_id);
}

export interface EnrolledOnlineCourseDetail {
  course_id: number;
  course_code: string;
  course_name: string;
  course_description?: string;
  course_type: string;
  course_duration?: string;
  course_validity?: string;
  course_fee: number;
  discount?: number;
  coupon_code?: string;
  amount_paid: number;
  purchased_at: string;
  is_online: true;
  status: "Purchased" | "Active";
  student_id?: number | null;
  registration_number?: string | null;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  stco_id?: number | null;
}

/**
 * Returns all enriched online course records purchased by a specific user from bi_st_course_online.
 */
export async function getUserPurchasedOnlineCourses(
  userId: number,
  userRole: string = "student"
): Promise<EnrolledOnlineCourseDetail[]> {
  if (!userId) return [];

  const phpApi = getBackendApiUrl();

  // 1. Fetch full online courses catalog from PHP API to enrich metadata
  let onlineCoursesCatalog: any[] = [];
  try {
    const res = await fetch(`${phpApi}/onlinecoures`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data?.data)) {
        onlineCoursesCatalog = data.data;
      }
    }
  } catch (err) {
    console.warn("[OnlineCoursePurchaseStore] Notice loading courses catalog:", err);
  }

  const catalogMap = new Map<number, any>();
  for (const c of onlineCoursesCatalog) {
    catalogMap.set(Number(c.course_id), c);
  }

  const resultMap = new Map<number, EnrolledOnlineCourseDetail>();
  const map = getStoreMap();

  // 2. Fetch directly from backend bi_st_course_online via /onlinecoures/enrollment
  try {
    const enrRes = await fetch(`${phpApi}/onlinecoures/enrollment`, {
      headers: {
        Accept: "application/json",
        "X-User-Id": String(userId),
        "X-User-Role": userRole || "student",
      },
      cache: "no-store",
    });

    if (enrRes.ok) {
      const enrData = await enrRes.json().catch(() => null);
      let list: any[] = [];
      if (enrData?.data) {
        if (Array.isArray(enrData.data)) list = enrData.data;
        else if (Array.isArray(enrData.data.enrollments)) list = enrData.data.enrollments;
      }

      for (const e of list) {
        const cId = Number(e.stco_course_id ?? e.course_id);
        if (!cId) continue;
        const meta = catalogMap.get(cId) || {};
        const localPurchase = map.get(`${userId}_${cId}`);
        const fee = Number(e.stco_total_fee ?? localPurchase?.course_fee ?? meta.course_fee ?? 0);
        const paid = Number(localPurchase?.amount ?? (Number(e.stco_initial_payment) > 0 ? e.stco_initial_payment : fee));
        const discount = Number(localPurchase?.discount ?? (Number(e.stco_discount) > 0 ? e.stco_discount : Math.max(0, fee - paid)));

        resultMap.set(cId, {
          course_id: cId,
          course_code: e.course_code || meta.course_code || `ONL-${cId}`,
          course_name: e.course_name || meta.course_name || `Online Course #${cId}`,
          course_description: meta.course_description || e.course_description || undefined,
          course_type: e.course_type || meta.course_type || "basic",
          course_duration: e.course_duration || meta.course_duration || "Self-Paced",
          course_validity: e.course_validity || meta.course_validity || "Lifetime Access",
          course_fee: fee,
          discount: discount,
          coupon_code: localPurchase?.coupon_code || undefined,
          amount_paid: paid,
          purchased_at: e.created_at || new Date().toISOString(),
          is_online: true,
          status: "Active",
          student_id: Number(e.stco_st_id ?? e.student_id ?? e.st_id) || null,
          registration_number: e.st_regno || e.registration_number || null,
          razorpay_payment_id: e.stco_razorpay_payment_id || undefined,
          razorpay_order_id: e.stco_razorpay_order_id || undefined,
          stco_id: Number(e.stco_id) || null,
        });
      }
    }
  } catch (enrErr) {
    console.warn("[OnlineCoursePurchaseStore] Fetch onlinecoures enrollment error:", enrErr);
  }

  // 3. Also check student profile /student/me online_courses array (bi_st_course_online)
  try {
    const meRes = await fetch(`${phpApi}/student/me`, {
      headers: {
        Accept: "application/json",
        "X-User-Id": String(userId),
        "X-User-Role": "student",
      },
      cache: "no-store",
    });

    if (meRes.ok) {
      const meData = await meRes.json().catch(() => null);
      const onlineCourses = Array.isArray(meData?.data?.online_courses)
        ? meData.data.online_courses
        : [];

      for (const e of onlineCourses) {
        const cId = Number(e.course_id ?? e.stco_course_id);
        if (!cId) continue;
        const meta = catalogMap.get(cId) || {};
        const localPurchase = map.get(`${userId}_${cId}`);
        const fee = Number(e.stco_total_fee ?? localPurchase?.course_fee ?? meta.course_fee ?? 0);
        const paid = Number(localPurchase?.amount ?? (Number(e.stco_initial_payment) > 0 ? e.stco_initial_payment : fee));
        const discount = Number(localPurchase?.discount ?? (Number(e.stco_discount) > 0 ? e.stco_discount : Math.max(0, fee - paid)));

        if (!resultMap.has(cId)) {
          resultMap.set(cId, {
            course_id: cId,
            course_code: e.course_code || meta.course_code || `ONL-${cId}`,
            course_name: e.course_name || meta.course_name || `Online Course #${cId}`,
            course_description: meta.course_description || e.course_description || undefined,
            course_type: e.course_type || meta.course_type || "basic",
            course_duration: e.course_duration || meta.course_duration || "Self-Paced",
            course_validity: e.course_validity || meta.course_validity || "Lifetime Access",
            course_fee: fee,
            discount: discount,
            coupon_code: localPurchase?.coupon_code || undefined,
            amount_paid: paid,
            purchased_at: e.created_at || new Date().toISOString(),
            is_online: true,
            status: "Active",
            student_id: Number(meData.data.st_id ?? meData.data.student_id) || null,
            registration_number: meData.data.st_regno || meData.data.registration_number || null,
            razorpay_payment_id: e.stco_razorpay_payment_id || undefined,
            razorpay_order_id: e.stco_razorpay_order_id || undefined,
            stco_id: Number(e.stco_id) || null,
          });
        }
      }
    }
  } catch (meErr) {
    console.warn("[OnlineCoursePurchaseStore] Fetch student/me online courses notice:", meErr);
  }

  // 4. Merge with local file-backed verified purchases
  const userPurchases = Array.from(map.values()).filter(
    (item) =>
      (Number(item.user_id) === userId || (item.student_id && Number(item.student_id) === userId)) &&
      item.status === "completed"
  );

  for (const pur of userPurchases) {
    const meta = catalogMap.get(pur.course_id) || {};
    const existing = resultMap.get(pur.course_id);

    if (existing) {
      if (pur.razorpay_payment_id) existing.razorpay_payment_id = pur.razorpay_payment_id;
      if (pur.razorpay_order_id) existing.razorpay_order_id = pur.razorpay_order_id;
      if (pur.student_id && !existing.student_id) existing.student_id = pur.student_id;
      if (pur.registration_number && !existing.registration_number)
        existing.registration_number = pur.registration_number;
      if (pur.coupon_code) existing.coupon_code = pur.coupon_code;
      if (pur.discount) existing.discount = pur.discount;
      if (pur.course_fee) existing.course_fee = pur.course_fee;
    } else {
      resultMap.set(pur.course_id, {
        course_id: pur.course_id,
        course_code: meta.course_code || `ONL-${pur.course_id}`,
        course_name: meta.course_name || `Online Course #${pur.course_id}`,
        course_description: meta.course_description || undefined,
        course_type: meta.course_type || "basic",
        course_duration: meta.course_duration || "Self-Paced",
        course_validity: meta.course_validity || "Lifetime Access",
        course_fee: Number(pur.course_fee || meta.course_fee || pur.amount || 0),
        discount: Number(pur.discount || 0),
        coupon_code: pur.coupon_code || undefined,
        amount_paid: pur.amount,
        purchased_at: pur.purchased_at,
        is_online: true,
        status: "Purchased",
        student_id: pur.student_id ?? null,
        registration_number: pur.registration_number ?? null,
        razorpay_payment_id: pur.razorpay_payment_id,
        razorpay_order_id: pur.razorpay_order_id,
      });
    }
  }

  const result = Array.from(resultMap.values());
  // Sort latest purchased first
  result.sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime());

  return result;
}

/**
 * Returns all verified online course purchases across all students (used for admin unified fee ledger).
 */
export async function getAllPurchasedOnlineCourses(): Promise<EnrolledOnlineCourseDetail[]> {
  const phpApi = getBackendApiUrl();
  const resultMap = new Map<string, EnrolledOnlineCourseDetail>();
  const map = getStoreMap();

  let onlineCoursesCatalog: any[] = [];
  try {
    const res = await fetch(`${phpApi}/onlinecoures`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data?.data)) onlineCoursesCatalog = data.data;
    }
  } catch {}

  const catalogMap = new Map<number, any>();
  for (const c of onlineCoursesCatalog) {
    catalogMap.set(Number(c.course_id), c);
  }

  try {
    const enrRes = await fetch(`${phpApi}/onlinecoures/enrollment`, {
      headers: {
        Accept: "application/json",
        "X-User-Id": "1",
        "X-User-Role": "admin",
      },
      cache: "no-store",
    });

    if (enrRes.ok) {
      const enrData = await enrRes.json().catch(() => null);
      let list: any[] = [];
      if (enrData?.data) {
        if (Array.isArray(enrData.data)) list = enrData.data;
        else if (Array.isArray(enrData.data.enrollments)) list = enrData.data.enrollments;
      }

      for (const e of list) {
        const cId = Number(e.stco_course_id ?? e.course_id);
        const stId = Number(e.stco_st_id ?? e.student_id ?? e.st_id);
        if (!cId) continue;
        const meta = catalogMap.get(cId) || {};
        const fee = Number(e.stco_total_fee ?? meta.course_fee ?? 0);
        const paid = Number(e.stco_initial_payment ?? fee);
        const discount = Number(e.stco_discount ?? Math.max(0, fee - paid));
        const key = `st_${stId}_c_${cId}`;

        resultMap.set(key, {
          course_id: cId,
          course_code: e.course_code || meta.course_code || `ONL-${cId}`,
          course_name: e.course_name || meta.course_name || `Online Course #${cId}`,
          course_description: meta.course_description || e.course_description,
          course_type: e.course_type || meta.course_type || "basic",
          course_duration: e.course_duration || meta.course_duration || "Self-Paced",
          course_validity: e.course_validity || meta.course_validity || "Lifetime Access",
          course_fee: fee,
          discount: discount,
          coupon_code: e.coupon_code || undefined,
          amount_paid: paid,
          purchased_at: e.created_at || new Date().toISOString(),
          is_online: true,
          status: "Active",
          student_id: stId || null,
          registration_number: e.st_regno || e.registration_number || null,
          razorpay_payment_id: e.stco_razorpay_payment_id || undefined,
          razorpay_order_id: e.stco_razorpay_order_id || undefined,
          stco_id: Number(e.stco_id) || null,
        });
      }
    }
  } catch {}

  for (const pur of map.values()) {
    if (pur.status !== "completed") continue;
    const meta = catalogMap.get(pur.course_id) || {};
    const key = pur.student_id ? `st_${pur.student_id}_c_${pur.course_id}` : `u_${pur.user_id}_c_${pur.course_id}`;
    const existing = resultMap.get(key);
    if (existing) {
      if (pur.coupon_code) existing.coupon_code = pur.coupon_code;
      if (pur.discount) existing.discount = pur.discount;
      if (pur.course_fee) existing.course_fee = pur.course_fee;
      if (pur.razorpay_payment_id) existing.razorpay_payment_id = pur.razorpay_payment_id;
      if (pur.razorpay_order_id) existing.razorpay_order_id = pur.razorpay_order_id;
    } else {
      resultMap.set(key, {
        course_id: pur.course_id,
        course_code: meta.course_code || `ONL-${pur.course_id}`,
        course_name: meta.course_name || `Online Course #${pur.course_id}`,
        course_description: meta.course_description,
        course_type: meta.course_type || "basic",
        course_duration: meta.course_duration || "Self-Paced",
        course_validity: meta.course_validity || "Lifetime Access",
        course_fee: Number(pur.course_fee || meta.course_fee || pur.amount || 0),
        discount: Number(pur.discount || 0),
        coupon_code: pur.coupon_code || undefined,
        amount_paid: pur.amount,
        purchased_at: pur.purchased_at,
        is_online: true,
        status: "Purchased",
        student_id: pur.student_id ?? null,
        registration_number: pur.registration_number ?? null,
        razorpay_payment_id: pur.razorpay_payment_id,
        razorpay_order_id: pur.razorpay_order_id,
      });
    }
  }

  const list = Array.from(resultMap.values());
  list.sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime());
  return list;
}

