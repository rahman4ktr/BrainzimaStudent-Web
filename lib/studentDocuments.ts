// lib/studentDocuments.ts
// Helper to retrieve and normalize student documents from backend bi_st_docs

import { toFullPublicUrl } from "./imageStorage";

const PHP_API =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.brainzima.com/student/api";

export interface ResolvedStudentDocuments {
  docs_st_image: string | null;
  docs_st_aadhaar_front: string | null;
  docs_st_aadhaar_back: string | null;
  docs_st_qualification: string | null;
}

export async function fetchStudentDocumentsHelper(
  studentId: number | string,
  userId?: number | string,
  userRole: string = "student",
  userImageFallback?: string | null
): Promise<ResolvedStudentDocuments | null> {
  if (!studentId) return null;

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (userId) headers["X-User-Id"] = String(userId);
    if (userRole) headers["X-User-Role"] = userRole;

    const res = await fetch(`${PHP_API}/document/student/${studentId}`, {
      headers,
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (!data?.data || typeof data.data !== "object") return null;

    let docRecord = { ...data.data };

    // If PHP returned student row without bi_st_docs fields, retrieve bi_st_docs
    if (
      (docRecord.user_image || userImageFallback) &&
      !("docs_st_aadhaar_front" in docRecord) &&
      !("docs_st_qualification" in docRecord)
    ) {
      try {
        const probeRes = await fetch(`${PHP_API}/document/student/${studentId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(userId ? { "X-User-Id": String(userId) } : {}),
            ...(userRole ? { "X-User-Role": userRole } : {}),
          },
          body: JSON.stringify({
            docs_st_image: docRecord.user_image || userImageFallback,
          }),
        });
        const probeJson = await probeRes.json().catch(() => null);
        if (probeJson?.success && probeJson?.data) {
          docRecord = { ...docRecord, ...probeJson.data };
        }
      } catch {
        /* ignore probe fallback */
      }
    }

    const img = docRecord.docs_st_image || docRecord.user_image || userImageFallback || null;
    const aadhFront = docRecord.docs_st_aadhaar_front || null;
    const aadhBack = docRecord.docs_st_aadhaar_back || null;
    const qual = docRecord.docs_st_qualification || null;

    return {
      docs_st_image: img ? toFullPublicUrl(img) : null,
      docs_st_aadhaar_front: aadhFront ? toFullPublicUrl(aadhFront) : null,
      docs_st_aadhaar_back: aadhBack ? toFullPublicUrl(aadhBack) : null,
      docs_st_qualification: qual ? toFullPublicUrl(qual) : null,
    };
  } catch (err) {
    console.warn("[studentDocuments] Failed to fetch documents for student", studentId, err);
    return null;
  }
}
