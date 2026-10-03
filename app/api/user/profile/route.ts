// app/api/user/profile/route.ts
// Handles PUT /api/user/profile
// Strictly adheres to Brainzima User Profile Image Lifecycle:
// 1. If updating with new image:
//    - Archive old image to uploads/delete/user-{user_id}-{timestamp}-{unique}.ext
//    - Save/move new image to uploads/users/{user_id}/profile.ext
//    - Update bi_users.user_image with new public path
// 2. If removing photo (user_image === null):
//    - Archive old image to uploads/delete/
//    - Set bi_users.user_image = NULL
// 3. If updating without image (only name/mobile):
//    - Keep existing image untouched
// 4. Returns updated user data including user_image public path

import { NextRequest, NextResponse } from "next/server";
import {
  archiveOldImage,
  finalizeRegistrationImage,
  updateUserProfileImage,
  formatDbImagePath,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  extractExtension,
  getBrowserFileUrl,
} from "@/lib/imageStorage";

const PHP_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://try.ajitdev.com/brainzima/student/api";

export async function PUT(req: NextRequest) {
  try {
    const rawUserId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "user";

    if (!rawUserId) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const userId = parseInt(rawUserId, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid user identifier." },
        { status: 403 }
      );
    }

    // Support both application/json and multipart/form-data
    let body: any = {};
    let fileBuffer: Buffer | null = null;
    let fileName: string | null = null;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (file) {
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          return NextResponse.json(
            { success: false, message: "Profile image must be 5 MB or smaller." },
            { status: 422 }
          );
        }
        const ext = extractExtension(file.name || "");
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          return NextResponse.json(
            { success: false, message: "Invalid file type. Allowed formats: jpg, jpeg, png, webp." },
            { status: 422 }
          );
        }
        fileBuffer = Buffer.from(await file.arrayBuffer());
        fileName = file.name;
      }
      body = {
        name: formData.get("name")?.toString() || undefined,
        email: formData.get("email")?.toString() || undefined,
        mobile: formData.get("mobile")?.toString() || undefined,
        user_image: formData.get("user_image")?.toString() || undefined,
      };
    } else {
      body = await req.json().catch(() => ({}));
    }

    // 1. Fetch current user from backend to inspect existing user_image
    let currentImage: string | null = null;
    let currentUser: any = null;
    try {
      const meRes = await fetch(`${PHP_API}/user/${userId}`, {
        headers: {
          "X-User-Id": String(userId),
          "X-User-Role": userRole,
          Accept: "application/json",
        },
      });
      if (meRes.ok) {
        const meJson = await meRes.json();
        if (meJson.success && meJson.data) {
          currentUser = meJson.data;
          currentImage = currentUser.user_image || null;
        }
      }
    } catch {
      /* ignore fetch error */
    }

    const isStudent =
      userRole === "student" ||
      currentUser?.user_role === "student" ||
      currentUser?.role === "student" ||
      currentUser?.is_student === true ||
      Boolean(currentUser?.student_id) ||
      body.is_student === true ||
      body.is_student === "true";
    const targetRole = isStudent ? "student" : "user";

    const payloadToForward: Record<string, any> = {
      user_role: targetRole,
      role: targetRole,
    };
    if (body.name !== undefined) payloadToForward.name = body.name;
    if (body.email !== undefined) payloadToForward.email = body.email;
    if (body.mobile !== undefined) payloadToForward.mobile = body.mobile;
    if (body.last_login_at !== undefined) payloadToForward.last_login_at = body.last_login_at;
    if (body.last_login_ip !== undefined) payloadToForward.last_login_ip = body.last_login_ip;
    if (body.ip !== undefined) payloadToForward.ip = body.ip;

    let finalUserImagePath: string | null | undefined = undefined;

    // 2. Handle Image Lifecycle (Users vs Students)
    if (fileBuffer && fileName) {
      // Direct file upload: archive old image and save new
      const uploadedPath = await updateUserProfileImage({
        userId,
        fileBuffer,
        originalFilename: fileName,
        currentPublicPath: currentImage,
        role: targetRole,
        isStudent,
      });
      finalUserImagePath = formatDbImagePath(uploadedPath);
      payloadToForward.user_image = finalUserImagePath;
    } else if ("user_image" in body) {
      const rawImg = body.user_image;

      if (rawImg === null || rawImg === "" || rawImg === "null" || rawImg === "remove") {
        // "Remove Photo" flow: archive current image to uploads/delete/ and set NULL
        if (currentImage) {
          await archiveOldImage(userId, currentImage, targetRole);
        }
        finalUserImagePath = null;
        payloadToForward.user_image = null;
      } else if (typeof rawImg === "string" && rawImg.trim() !== "") {
        const cleanPath = rawImg.trim();
        // If image path has changed (e.g. uploaded via /api/upload to temp or new path)
        if (cleanPath !== currentImage) {
          if (cleanPath.includes("temp") || cleanPath.startsWith("data:")) {
            // Archive old and move temp to permanent uploads/students or uploads/users
            if (currentImage) {
              await archiveOldImage(userId, currentImage, targetRole);
            }
            finalUserImagePath = await finalizeRegistrationImage(userId, cleanPath, targetRole);
          } else {
            finalUserImagePath = cleanPath;
          }
          finalUserImagePath = formatDbImagePath(finalUserImagePath);
          payloadToForward.user_image = finalUserImagePath;
        } else {
          // Unchanged image: do NOT modify or move
          finalUserImagePath = formatDbImagePath(currentImage);
        }
      }
    }

    // 3. Forward update to PHP backend
    let phpSuccess = false;
    let phpResponseData: any = null;

    // 3A. If user_image was updated, call dedicated avatar endpoint
    if (finalUserImagePath !== undefined) {
      try {
        await fetch(`${PHP_API}/user/image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": String(userId),
            "X-User-Role": targetRole,
            "X-HTTP-Method-Override": "PATCH",
            Accept: "application/json",
          },
          body: JSON.stringify({
            user_image: finalUserImagePath,
            user_role: targetRole,
            role: targetRole,
          }),
        });
      } catch (imgErr) {
        console.warn("[Profile API] Error calling /user/image:", imgErr);
      }

      // If student, sync with student endpoints
      if (isStudent) {
        try {
          await fetch(`${PHP_API}/student/me`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-User-Id": String(userId),
              "X-User-Role": "student",
              "X-HTTP-Method-Override": "PATCH",
              Accept: "application/json",
            },
            body: JSON.stringify({ user_image: finalUserImagePath }),
          });
        } catch {
          /* ignore */
        }

        const studentId = currentUser?.student_id;
        if (studentId) {
          try {
            await fetch(`${PHP_API}/document/student/${studentId}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-User-Id": String(userId),
                "X-User-Role": "student",
                Accept: "application/json",
              },
              body: JSON.stringify({ docs_st_image: finalUserImagePath }),
            });
          } catch {
            /* ignore */
          }
        }
      }
    }

    // 3B. Forward to PHP /user/profile with Method Override
    try {
      const phpRes = await fetch(`${PHP_API}/user/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(userId),
          "X-User-Role": targetRole,
          "X-HTTP-Method-Override": "PATCH",
          Accept: "application/json",
        },
        body: JSON.stringify({ ...payloadToForward, _method: "PATCH" }),
      });

      const phpData = await phpRes.json().catch(() => null);

      if (phpRes.status === 422) {
        return NextResponse.json(
          {
            success: false,
            message: phpData?.message || "Validation failed.",
            errors: phpData?.errors || {},
          },
          { status: 422 }
        );
      }

      if (phpRes.status === 409) {
        return NextResponse.json(
          {
            success: false,
            message: phpData?.message || "Duplicate entry conflict.",
            errors: phpData?.errors || {},
          },
          { status: 409 }
        );
      }

      if (phpRes.ok && phpData?.success) {
        phpSuccess = true;
        phpResponseData = phpData;
      }
    } catch (phpErr) {
      console.warn("[Profile API] Notice forwarding to PHP backend:", phpErr);
    }

    // Fallback: Native PUT /user/profile
    if (!phpSuccess) {
      try {
        const putRes = await fetch(`${PHP_API}/user/profile`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": String(userId),
            "X-User-Role": targetRole,
            Accept: "application/json",
          },
          body: JSON.stringify(payloadToForward),
        });
        const putData = await putRes.json().catch(() => null);
        if (putRes.ok && putData?.success) {
          phpSuccess = true;
          phpResponseData = putData;
        }
      } catch {
        /* ignore */
      }
    }

    if (phpSuccess && phpResponseData) {
      return NextResponse.json(phpResponseData);
    }

    // Fallback response with synchronized fields
    const updatedResponseUser = {
      user_id: userId,
      name: body.name || currentUser?.name || "User",
      email: body.email || currentUser?.email || "",
      mobile: body.mobile !== undefined ? body.mobile : (currentUser?.mobile ?? null),
      user_role: targetRole,
      role: targetRole,
      is_student: isStudent,
      student_id: currentUser?.student_id ?? null,
      registration_number: currentUser?.registration_number ?? null,
      user_image:
        finalUserImagePath !== undefined
          ? finalUserImagePath
          : (currentImage ? formatDbImagePath(currentImage) : null),
      last_login_at: body.last_login_at || currentUser?.last_login_at || null,
      last_login_ip: body.last_login_ip || currentUser?.last_login_ip || null,
    };

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      data: updatedResponseUser,
    });
  } catch (error: any) {
    console.error("[Profile API] PUT /api/user/profile error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to save profile image." },
      { status: 500 }
    );
  }
}

export const PATCH = PUT;
export const POST = PUT;
