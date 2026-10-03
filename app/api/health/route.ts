// app/api/health/route.ts
// Production Diagnostics & Health Endpoint.
// Performs safe, non-destructive audit of:
// 1. Backend PHP API connectivity & HTTPS verification
// 2. Razorpay configuration (Key ID, Secret presence, Test vs Live mode)
// 3. SMTP email transport verification
//
// NEVER logs or exposes secrets, passwords, or tokens.

import { NextResponse } from "next/server";
import { getBackendApiUrl } from "@/lib/apiConfig";
import { getCleanRazorpayConfig } from "@/lib/razorpay";
import { getCleanSmtpConfig, verifySmtpConnection, maskEmail } from "@/lib/email";

export async function GET() {
  const issues: string[] = [];

  // ── 1. Backend API & HTTPS Audit ───────────────────────────────────────────
  const apiUrl = getBackendApiUrl();
  const isHttps = apiUrl.startsWith("https://");
  let apiReachable = false;
  let apiStatus: number | null = null;
  let apiPingMs: number | null = null;

  if (!isHttps) {
    issues.push("NEXT_PUBLIC_API_URL is using unencrypted HTTP. Production must use HTTPS to avoid Mixed Content blocking.");
  }

  const startPing = Date.now();
  try {
    const res = await fetch(`${apiUrl}/course`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    apiStatus = res.status;
    apiReachable = res.ok;
    apiPingMs = Date.now() - startPing;
    if (!res.ok) {
      issues.push(`Backend API responded with non-200 status (${res.status}) on /course.`);
    }
  } catch (err: any) {
    apiPingMs = Date.now() - startPing;
    issues.push(`Backend API unreachable at ${apiUrl}: ${err?.message || "connection timeout"}.`);
  }

  // ── 2. Razorpay Configuration Audit ────────────────────────────────────────
  const rzp = getCleanRazorpayConfig();
  if (!rzp.configured) {
    const missing: string[] = [];
    if (!rzp.key_id) missing.push("RAZORPAY_KEY_ID");
    if (!rzp.key_secret) missing.push("RAZORPAY_KEY_SECRET");
    issues.push(`Razorpay credentials missing in environment: ${missing.join(", ")}.`);
  }

  const razorpayAudit = {
    configured: rzp.configured,
    mode: rzp.mode,
    isTestMode: rzp.isTestMode,
    isLiveMode: rzp.isLiveMode,
    razorpayKeyIdConfigured: Boolean(rzp.key_id),
    razorpaySecretConfigured: Boolean(rzp.key_secret),
    keyIdConfigured: Boolean(rzp.key_id),
    keyIdPrefix: rzp.key_id ? rzp.key_id.slice(0, 8) + "..." : null,
    secretConfigured: Boolean(rzp.key_secret),
    hasQuotesInKeyId: (process.env.RAZORPAY_KEY_ID || "").startsWith('"'),
    hasQuotesInSecret: (process.env.RAZORPAY_KEY_SECRET || "").startsWith('"'),
  };

  // Section 16: Safe server/client configuration check
  const publicConfig = {
    apiConfigured: Boolean(apiUrl),
    razorpayPublicKeyConfigured: Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID),
  };

  const serverConfig = {
    razorpayKeyIdConfigured: Boolean(rzp.key_id),
    razorpaySecretConfigured: Boolean(rzp.key_secret),
  };

  // ── 3. SMTP Configuration & Connectivity Audit ─────────────────────────────
  const smtpConfig = getCleanSmtpConfig();
  let smtpVerified = false;
  let smtpError: any = null;

  if (!smtpConfig.configured) {
    const missing: string[] = [];
    if (!smtpConfig.user) missing.push("SMTP_USER");
    if (!smtpConfig.pass) missing.push("SMTP_PASS");
    issues.push(`SMTP credentials missing in environment: ${missing.join(", ")}.`);
  } else {
    try {
      const verifyResult = await verifySmtpConnection();
      smtpVerified = verifyResult.success;
      if (!verifyResult.success) {
        smtpError = verifyResult.error;
        issues.push(`SMTP connection test failed: ${verifyResult.error?.message || "Authentication / network error"}.`);
      }
    } catch (smtpErr: any) {
      smtpError = { message: smtpErr?.message, code: smtpErr?.code };
      issues.push(`SMTP verification exception: ${smtpErr?.message || "Unknown error"}.`);
    }
  }

  const smtpAudit = {
    configured: smtpConfig.configured,
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    isGmail: smtpConfig.isGmail,
    user: smtpConfig.user ? maskEmail(smtpConfig.user) : null,
    fromEmail: smtpConfig.fromEmail ? maskEmail(smtpConfig.fromEmail) : null,
    fromName: smtpConfig.fromName,
    hasPassword: Boolean(smtpConfig.pass),
    passLength: smtpConfig.cleanPass ? smtpConfig.cleanPass.length : 0,
    hasQuotesInPass: (process.env.SMTP_PASS || "").startsWith('"'),
    connectionVerified: smtpVerified,
    connectionError: smtpError,
  };

  const status = issues.length === 0 ? "healthy" : "configuration_issues";

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      issues: issues.length > 0 ? issues : ["None. All production configurations are valid."],
      api: {
        url: apiUrl,
        isHttps,
        reachable: apiReachable,
        httpStatus: apiStatus,
        latencyMs: apiPingMs,
      },
      publicConfig,
      serverConfig,
      razorpay: razorpayAudit,
      smtp: smtpAudit,
      guidance: {
        vercel:
          "If deploying on Vercel, ensure variables are added under Project Settings > Environment Variables for PRODUCTION and then trigger a REDEPLOY.",
        smtp:
          "For Gmail on cloud platforms: use port 465 (SSL). Generate a 16-character Google App Password (not normal login password) with 2FA enabled. Do not enclose values in quotes.",
        razorpay:
          "For Razorpay in production: create a Live API Key pair in the Razorpay Dashboard. Set RAZORPAY_KEY_ID (rzp_live_...) and RAZORPAY_KEY_SECRET on the server.",
      },
    },
    { status: issues.length === 0 ? 200 : 207 }
  );
}
