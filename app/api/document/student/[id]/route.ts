// app/api/document/student/[id]/route.ts
// Proxy handler for student document uploads to Brainzima PHP REST API backend
// Physical files are uploaded directly to PHP flat directories:
// - docs_st_image         → uploads/images/students/
// - docs_st_aadhaar_front → uploads/images/adharfront/
// - docs_st_aadhaar_back  → uploads/images/adharback/
// - docs_st_qualification → uploads/images/qualification/
// MySQL bi_st_docs stores the canonical full public URL strings.

import { NextRequest, NextResponse } from "next/server";
import { toFullPublicUrl } from "@/lib/imageStorage";

const PHP_API =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.brainzima.com/student/api";

function normalizeDocData(docData: any) {
  if (!docData || typeof docData !== "object") return docData;
  const normalized = { ...docData };
  if (normalized.user_image) {
    normalized.user_image = toFullPublicUrl(normalized.user_image);
  }
  if (normalized.docs_st_image) {
    normalized.docs_st_image = toFullPublicUrl(normalized.docs_st_image);
  } else if (normalized.user_image) {
    normalized.docs_st_image = normalized.user_image;
  }
  if (normalized.docs_st_aadhaar_front) {
    normalized.docs_st_aadhaar_front = toFullPublicUrl(normalized.docs_st_aadhaar_front);
  }
  if (normalized.docs_st_aadhaar_back) {
    normalized.docs_st_aadhaar_back = toFullPublicUrl(normalized.docs_st_aadhaar_back);
  }
  if (normalized.docs_st_qualification) {
    normalized.docs_st_qualification = toFullPublicUrl(normalized.docs_st_qualification);
  }
  return normalized;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "student";

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (userId) headers["X-User-Id"] = userId;
    if (userRole) headers["X-User-Role"] = userRole;

    const res = await fetch(`${PHP_API}/document/student/${id}`, {
      headers,
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (data?.data) {
      // If PHP returned student details without bi_st_docs fields, retrieve bi_st_docs record
      if (
        data.data.user_image &&
        !("docs_st_aadhaar_front" in data.data) &&
        !("docs_st_qualification" in data.data)
      ) {
        try {
          const docRes = await fetch(`${PHP_API}/document/student/${id}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              ...(userId ? { "X-User-Id": userId } : {}),
              ...(userRole ? { "X-User-Role": userRole } : {}),
            },
            body: JSON.stringify({ docs_st_image: data.data.user_image }),
          });
          const docJson = await docRes.json().catch(() => null);
          if (docJson?.success && docJson?.data) {
            data.data = { ...data.data, ...docJson.data };
          }
        } catch {
          /* ignore fallback */
        }
      }

      data.data = normalizeDocData(data.data);
    }
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[Document API] GET error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch student documents." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "student";

    const contentType = req.headers.get("content-type") || "";

    // ── 1. Multipart/form-data File Upload Forwarding ─────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const incomingFormData = await req.formData();
      const outgoingFormData = new FormData();

      for (const [key, value] of incomingFormData.entries()) {
        if (value && typeof value === "object" && typeof (value as any).arrayBuffer === "function") {
          const file = value as File;
          const bytes = await file.arrayBuffer();
          const blob = new Blob([bytes], { type: file.type || "application/octet-stream" });
          outgoingFormData.append(key, blob, file.name);
        } else {
          outgoingFormData.append(key, String(value));
        }
      }

      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (userId) headers["X-User-Id"] = userId;
      if (userRole) headers["X-User-Role"] = userRole;

      const res = await fetch(`${PHP_API}/document/student/${id}`, {
        method: "POST",
        headers,
        body: outgoingFormData,
      });

      const data = await res.json().catch(() => null);

      if (data?.data) {
        data.data = normalizeDocData(data.data);

        // Ensure full URL strings are stored in MySQL
        const syncPayload: Record<string, string> = {};
        for (const field of [
          "docs_st_image",
          "docs_st_aadhaar_front",
          "docs_st_aadhaar_back",
          "docs_st_qualification",
        ]) {
          if (data.data[field]) {
            syncPayload[field] = data.data[field];
          }
        }
        if (Object.keys(syncPayload).length > 0) {
          try {
            await fetch(`${PHP_API}/document/student/${id}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...(userId ? { "X-User-Id": userId } : {}),
                ...(userRole ? { "X-User-Role": userRole } : {}),
              },
              body: JSON.stringify(syncPayload),
            });
          } catch {
            /* ignore */
          }
        }
      }

      return NextResponse.json(data, { status: res.status });
    }

    // ── 2. JSON Path Strings Forwarding ───────────────────────────────────────
    const body = await req.json().catch(() => ({}));

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (userId) headers["X-User-Id"] = userId;
    if (userRole) headers["X-User-Role"] = userRole;

    const cleanBody: Record<string, any> = {};
    const validFields = [
      "docs_st_image",
      "docs_st_aadhaar_front",
      "docs_st_aadhaar_back",
      "docs_st_qualification",
    ];

    for (const key of validFields) {
      if (key in body) {
        const val = body[key];
        if (val === null) {
          cleanBody[key] = null;
        } else if (typeof val === "string") {
          const trimmed = val.trim();
          if (
            !trimmed ||
            trimmed === "null" ||
            trimmed === "undefined" ||
            trimmed === "[object Object]"
          ) {
            cleanBody[key] = null;
          } else {
            cleanBody[key] = toFullPublicUrl(trimmed);
          }
        }
      }
    }

    const res = await fetch(`${PHP_API}/document/student/${id}`, {
      method: "POST",
      headers,
      body: JSON.stringify(cleanBody),
    });

    const data = await res.json().catch(() => null);
    if (data?.data) {
      data.data = normalizeDocData(data.data);
    }
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[Document API] POST error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to save student documents." },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return POST(req, context);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return POST(req, context);
}
