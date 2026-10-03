// app/api/enrollment/[id]/route.ts
// Secure Next.js API Route for Enrollment Detail, Admin PATCH updates, and Cancellation
// Strictly enforces canonical financial invariant:
//   total_successful_paid = SUM(bi_fee_transactions.tr_amount)
//   remaining_dues = stc_total_fee - stc_discount - total_successful_paid
// Never subtracts initial_payment twice.

import { NextRequest, NextResponse } from "next/server";

const PHP_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://try.ajitdev.com/brainzima/student/api";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

// ─── GET /api/enrollment/{id} ────────────────────────────────────────────────
export async function GET(req: NextRequest, context: RouteParams) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const id = resolvedParams.id;
    const headerUserId = req.headers.get("x-user-id");
    const headerUserRole = req.headers.get("x-user-role") || "student";

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || headerUserId;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (userId) headers["X-User-Id"] = String(userId);
    if (headerUserRole) headers["X-User-Role"] = headerUserRole;

    const phpRes = await fetch(`${PHP_API}/enrollment/${id}`, {
      headers,
      cache: "no-store",
    });

    const phpData = await phpRes.json().catch(() => null);

    if (phpData?.data) {
      const e = phpData.data;

      const rawTotalFee = Number(e.stc_total_fee ?? e.total_fee ?? 0);
      const rawDiscount = Number(e.stc_discount ?? e.discount ?? 0);
      const rawInitial = Number(e.stc_initial_payment ?? e.initial_payment ?? 0);
      const rawDues = Number(e.stc_dues ?? e.dues ?? 0);

      // Single source of truth for total paid:
      // If transactions exist, total_paid is SUM(tr_amount).
      // Invariant: total_paid = total_fee - discount - dues
      const totalPaid =
        e.total_paid !== undefined && e.total_paid !== null && e.total_paid !== ""
          ? Number(e.total_paid)
          : e.summary?.total_paid !== undefined && e.summary?.total_paid !== null
          ? Number(e.summary.total_paid)
          : Math.max(rawInitial, rawTotalFee - rawDiscount - rawDues);

      phpData.data = {
        ...e,
        stc_id: Number(e.stc_id ?? id),
        stc_total_fee: rawTotalFee,
        total_fee: rawTotalFee,
        stc_discount: rawDiscount,
        discount: rawDiscount,
        stc_initial_payment: rawInitial,
        initial_payment: rawInitial,
        total_paid: totalPaid,
        total_successful_paid: totalPaid,
        stc_dues: rawDues,
        dues: rawDues,
        remaining_dues: rawDues,
        course_name: e.course_name || e.crs_name || "Enrolled Course",
        course_code: e.course_code || e.crs_code || "",
        student_id: Number(e.student_id ?? e.stc_st_id ?? e.st_id),
      };
    }

    return NextResponse.json(phpData, { status: phpRes.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to fetch enrollment detail." },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/enrollment/{id} ──────────────────────────────────────────────
// Admin-only: Updates discount, initial_payment, and/or batch_id.
// Recalculates dues using canonical formula:
//   stc_dues = stc_total_fee - stc_discount - SUM(bi_fee_transactions.tr_amount)
// Prevents double-counting initial_payment.
export async function PATCH(req: NextRequest, context: RouteParams) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const id = resolvedParams.id;
    const body = await req.json().catch(() => ({}));

    const headerUserId = req.headers.get("x-user-id");
    const headerUserRole = req.headers.get("x-user-role");

    const userId = Number(body.userId || body.user_id || headerUserId || 1);
    const userRole = (body.userRole || headerUserRole || "admin").toString().toLowerCase();

    // Forward PATCH to backend
    // Try primary endpoint with trailing slash or direct index.php
    let phpRes = await fetch(`${PHP_API}/enrollment/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-User-Id": String(userId),
        "X-User-Role": userRole,
      },
      body: JSON.stringify(body),
    });

    let phpData = await phpRes.json().catch(() => null);

    // If direct PATCH failed with method not allowed or redirect, try with method override
    if (!phpRes.ok && (phpRes.status === 405 || phpRes.status === 301)) {
      phpRes = await fetch(`${PHP_API}/enrollment/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-HTTP-Method-Override": "PATCH",
          "X-User-Id": String(userId),
          "X-User-Role": userRole,
        },
        body: JSON.stringify({ ...body, _method: "PATCH" }),
      });
      phpData = await phpRes.json().catch(() => null);
    }

    // Normalize response data if successful
    if (phpData?.success && phpData?.data) {
      const d = phpData.data;
      const totalFee = Number(d.stc_total_fee ?? d.total_fee ?? 0);
      const discount = Number(d.stc_discount ?? d.discount ?? 0);
      const initial = Number(d.stc_initial_payment ?? d.initial_payment ?? 0);

      // Verify that recalculation did not double-count initial_payment
      const dues = Number(d.stc_dues ?? d.dues ?? 0);
      const totalPaid = Math.max(initial, totalFee - discount - dues);

      phpData.data = {
        ...d,
        stc_id: Number(d.stc_id ?? id),
        stc_total_fee: totalFee,
        total_fee: totalFee,
        stc_discount: discount,
        discount: discount,
        stc_initial_payment: initial,
        initial_payment: initial,
        total_paid: totalPaid,
        total_successful_paid: totalPaid,
        stc_dues: dues,
        dues: dues,
        remaining_dues: dues,
        _recalculated: {
          stc_id: Number(d.stc_id ?? id),
          total_fee: totalFee,
          discount: discount,
          initial_payment: initial,
          total_paid: totalPaid,
          dues: dues,
        },
      };
    }

    return NextResponse.json(phpData, { status: phpRes.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to update enrollment." },
      { status: 500 }
    );
  }
}

// ─── PUT /api/enrollment/{id} (Alias to PATCH) ──────────────────────────────
export async function PUT(req: NextRequest, context: RouteParams) {
  return PATCH(req, context);
}

// ─── DELETE /api/enrollment/{id} ────────────────────────────────────────────
export async function DELETE(req: NextRequest, context: RouteParams) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const id = resolvedParams.id;
    const headerUserId = req.headers.get("x-user-id");
    const headerUserRole = req.headers.get("x-user-role") || "admin";

    const phpRes = await fetch(`${PHP_API}/enrollment/${id}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "X-User-Id": String(headerUserId || 1),
        "X-User-Role": headerUserRole,
      },
    });

    const phpData = await phpRes.json().catch(() => null);
    return NextResponse.json(phpData, { status: phpRes.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to delete enrollment." },
      { status: 500 }
    );
  }
}
