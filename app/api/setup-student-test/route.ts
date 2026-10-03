import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Execute diagnostic test immediately on module load
(async () => {
  const logFile = path.join(process.cwd(), "fee_test_result.json");
  const results: any = { timestamp: new Date().toISOString() };

  try {
    const PHP_API =
      process.env.NEXT_PUBLIC_API_URL ||
      "https://try.ajitdev.com/brainzima/student/api";

    results.PHP_API = PHP_API;

    // Test Remote API:
    // 1. GET /enrollment (admin)
    try {
      const res = await fetch(`${PHP_API}/enrollment`, {
        headers: { "X-User-Id": "1", "X-User-Role": "admin", Accept: "application/json" },
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      results.remote_enrollments_admin = {
        status: res.status,
        enrollment_count: Array.isArray(data?.data) ? data.data.length : data?.data?.enrollments?.length ?? 0,
        sample: Array.isArray(data?.data) ? data.data.slice(0, 3) : data?.data?.enrollments?.slice(0, 3),
        stc16: (Array.isArray(data?.data) ? data.data : data?.data?.enrollments || []).find((e: any) => Number(e.stc_id ?? e.id) === 16),
      };
    } catch (e: any) {
      results.remote_enrollments_admin = { error: e.message };
    }

    // 2. GET /enrollment (student 29)
    try {
      const res = await fetch(`${PHP_API}/enrollment`, {
        headers: { "X-User-Id": "29", "X-User-Role": "student", Accept: "application/json" },
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      results.remote_enrollments_user29 = { status: res.status, data };
    } catch (e: any) {
      results.remote_enrollments_user29 = { error: e.message };
    }

    // 3. Test POST /fee/ on remote
    try {
      const res = await fetch(`${PHP_API}/fee/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": "29",
          "X-User-Role": "student",
          Accept: "application/json",
        },
        body: JSON.stringify({
          stc_id: 16,
          amount: 2000,
          mode: "razorpay",
          payref: "probe_check_" + Date.now(),
          remark: "Fee installment payment",
        }),
      });
      results.remote_post_fee = { status: res.status, data: await res.json().catch(() => null) };
    } catch (e: any) {
      results.remote_post_fee = { error: e.message };
    }

    // Test Localhost API:
    try {
      const resLocal = await fetch("http://localhost/student.brainzima.com/api/fee/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": "29",
          "X-User-Role": "student",
          Accept: "application/json",
        },
        body: JSON.stringify({
          stc_id: 16,
          amount: 2000,
          mode: "razorpay",
          payref: "local_probe_" + Date.now(),
          remark: "Fee installment payment",
        }),
      });
      results.local_post_fee = { status: resLocal.status, data: await resLocal.json().catch(() => null) };
    } catch (e: any) {
      results.local_post_fee = { error: e.message };
    }

    fs.writeFileSync(logFile, JSON.stringify(results, null, 2), "utf8");
  } catch (err: any) {
    fs.writeFileSync(logFile, JSON.stringify({ top_level_error: err.message }, null, 2), "utf8");
  }
})();

export async function GET() {
  const logFile = path.join(process.cwd(), "fee_test_result.json");
  let content = "{}";
  try {
    content = fs.readFileSync(logFile, "utf8");
  } catch {}
  return new NextResponse(content, {
    headers: { "Content-Type": "application/json" },
  });
}
