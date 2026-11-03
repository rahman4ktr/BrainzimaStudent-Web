// app/api/student/me/route.ts
// Proxy handler for authenticated student profile and avatar update
// Uploads actual binary file to PHP backend: uploads/images/students/
// Stores full canonical public URL in MySQL: https://api.brainzima.com/student/api/uploads/images/students/...

import { NextRequest, NextResponse } from "next/server";
import {
  toFullPublicUrl,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  extractExtension,
} from "@/lib/imageStorage";
import { fetchStudentDocumentsHelper } from "@/lib/studentDocuments";

const PHP_API =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.brainzima.com/student/api";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "student";

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const res = await fetch(`${PHP_API}/student/me`, {
      headers: {
        Accept: "application/json",
        "X-User-Id": userId,
        "X-User-Role": userRole,
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (data?.data && typeof data.data === "object") {
      if (data.data.user_image) {
        data.data.user_image = toFullPublicUrl(data.data.user_image);
      }
      const stId = Number(data.data.st_id);
      const courses = Array.isArray(data.data.courses) ? data.data.courses : [];
      const onlineCourses = Array.isArray(data.data.online_courses) ? data.data.online_courses : [];
      const hasPaid =
        onlineCourses.length > 0 ||
        courses.some(
          (c: any) =>
            Number(c.stc_initial_payment || 0) > 0 ||
            Number(c.stco_initial_payment || 0) > 0 ||
            Number(c.total_paid || 0) > 0 ||
            c.payment_status === "paid" ||
            c.course_format === "online"
        );
      // Requirement:
      // If student has paid fees: Registration number is derived from student_id: BISR${student_id} (e.g. BISR0023 for student 23).
      // If student has 0 payment (e.g. Center Payment pending at study centre): Registration number is null (not generated).
      if (hasPaid && stId) {
        data.data.st_regno = `BISR${String(stId).padStart(4, "0")}`;
      } else if (!hasPaid && courses.length > 0) {
        data.data.st_regno = null;
      }

      data.data.dob = data.data.st_dob || null;

      // Also attach student documents paths
      if (stId) {
        const docs = await fetchStudentDocumentsHelper(
          stId,
          userId,
          userRole,
          data.data.user_image
        );
        if (docs) {
          data.data.docs_st_image = docs.docs_st_image || data.data.user_image || null;
          data.data.docs_st_aadhaar_front = docs.docs_st_aadhaar_front || null;
          data.data.docs_st_aadhaar_back = docs.docs_st_aadhaar_back || null;
          data.data.docs_st_qualification = docs.docs_st_qualification || null;
          data.data.documents = {
            docs_st_image: data.data.docs_st_image,
            docs_st_aadhaar_front: docs.docs_st_aadhaar_front,
            docs_st_aadhaar_back: docs.docs_st_aadhaar_back,
            docs_st_qualification: docs.docs_st_qualification,
          };
          if (docs.docs_st_image && !data.data.user_image) {
            data.data.user_image = docs.docs_st_image;
          }
        }
      }
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[Student Profile API] GET error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to connect to student service." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "student";

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const incomingFormData = await req.formData();
      const outgoingFormData = new FormData();
      outgoingFormData.append("_method", "PATCH");

      for (const [key, value] of incomingFormData.entries()) {
        if (value && typeof value === "object" && typeof (value as any).arrayBuffer === "function") {
          const file = value as File;
          if (file.size > MAX_IMAGE_SIZE_BYTES) {
            return NextResponse.json(
              { success: false, message: "Image must be 5 MB or smaller." },
              { status: 422 }
            );
          }
          const ext = extractExtension(file.name || "");
          if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return NextResponse.json(
              { success: false, message: "Invalid image format. Allowed: jpg, jpeg, png, webp." },
              { status: 422 }
            );
          }
          const bytes = await file.arrayBuffer();
          const blob = new Blob([bytes], { type: file.type || "image/jpeg" });
          outgoingFormData.append(key, blob, file.name || `student-photo.${ext}`);
        } else {
          outgoingFormData.append(key, String(value));
        }
      }

      const phpRes = await fetch(`${PHP_API}/student/me`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-User-Id": userId,
          "X-User-Role": "student",
          "X-HTTP-Method-Override": "PATCH",
        },
        body: outgoingFormData,
      });

      const data = await phpRes.json().catch(() => null);

      if (data?.data && typeof data.data === "object") {
        if (data.data.user_image) {
          data.data.user_image = toFullPublicUrl(data.data.user_image);
        }
      }

      return NextResponse.json(data, { status: phpRes.status });
    }

    // JSON update flow
    const body = await req.json().catch(() => ({}));
    if (body.user_image) {
      body.user_image = toFullPublicUrl(body.user_image);
    }

    const phpRes = await fetch(`${PHP_API}/student/me`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": userId,
        "X-User-Role": "student",
        "X-HTTP-Method-Override": "PATCH",
        Accept: "application/json",
      },
      body: JSON.stringify({ ...body, _method: "PATCH" }),
    });

    const data = await phpRes.json().catch(() => null);

    if (data?.data && typeof data.data === "object") {
      if (data.data.user_image) {
        data.data.user_image = toFullPublicUrl(data.data.user_image);
      }
    }

    return NextResponse.json(data, { status: phpRes.status });
  } catch (error: any) {
    console.error("[Student Profile API] PUT/PATCH error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to update student profile." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  return PUT(req);
}
