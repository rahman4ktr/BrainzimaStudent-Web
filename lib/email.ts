// lib/email.ts
// Nodemailer email sender — server-side only (used in Next.js API routes)
// Reads SMTP config from environment variables (never exposed to browser)
// Enhanced for production reliability on Vercel / Cloud / Serverless environments.

import nodemailer, { type Transporter } from "nodemailer";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  cleanPass: string;
  fromName: string;
  fromEmail: string;
  isGmail: boolean;
  configured: boolean;
}

/**
 * Clean and parse SMTP configuration from process.env at call-time.
 * Automatically trims quotes, sanitizes Gmail App Passwords, and picks optimal ports.
 */
export function getCleanSmtpConfig(): SmtpConfig {
  const rawHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const rawPort = process.env.SMTP_PORT || "";
  const rawUser = process.env.SMTP_USER || process.env.GMAIL_USER || "";
  const rawPass = process.env.SMTP_PASS || process.env.GMAIL_PASS || "";
  const rawFromName =
    process.env.SMTP_FROM_NAME ||
    process.env.MAIL_FROM_NAME ||
    "Brainzima";
  const rawFromEmail =
    process.env.SMTP_FROM ||
    process.env.MAIL_FROM ||
    rawUser;

  // Strip accidental quotes often copied from .env files ("value" -> value)
  const host = rawHost.replace(/^["']|["']$/g, "").trim();
  const user = rawUser.replace(/^["']|["']$/g, "").trim();
  const pass = rawPass.replace(/^["']|["']$/g, "").trim();
  const fromName = rawFromName.replace(/^["']|["']$/g, "").trim();
  const fromEmail = (rawFromEmail || user).replace(/^["']|["']$/g, "").trim();

  const isGmail =
    host.toLowerCase().includes("gmail.com") ||
    user.toLowerCase().endsWith("@gmail.com");

  // Google App Passwords are 16 characters. Google presents them in 4 groups of 4 (e.g. "abcd efgh ijkl mnop").
  // Gmail SMTP strictly accepts the 16 characters with spaces stripped ("abcdefghijklmnop").
  const cleanPass = isGmail ? pass.replace(/\s+/g, "") : pass;

  // On cloud platforms (Vercel/AWS Lambda/Render/GCP), outbound port 587 (STARTTLS)
  // is often blocked, throttled, or encounters TLS handshake timeouts.
  // Port 465 (direct SSL/TLS) is the industry standard and vastly more reliable for Gmail.
  let port = rawPort ? parseInt(rawPort.replace(/^["']|["']$/g, "").trim(), 10) : (isGmail ? 465 : 587);
  if (isNaN(port) || port <= 0) {
    port = isGmail ? 465 : 587;
  }
  const secure = port === 465;

  const configured = Boolean(user && pass);

  return {
    host,
    port,
    secure,
    user,
    pass,
    cleanPass,
    fromName,
    fromEmail,
    isGmail,
    configured,
  };
}

/**
 * Creates a transporter instance with strict timeouts and SSL compatibility.
 */
function createTransporter(options?: {
  useGmailService?: boolean;
  alternatePort?: number;
  useRawPass?: boolean;
}): Transporter {
  const config = getCleanSmtpConfig();
  const password = options?.useRawPass ? config.pass : config.cleanPass;

  const baseConfig: any = {
    auth: {
      user: config.user,
      pass: password,
    },
    // Crucial for serverless environments (AWS/Vercel) to prevent hanging
    connectionTimeout: 8000, // 8 seconds
    greetingTimeout: 8000,   // 8 seconds
    socketTimeout: 12000,    // 12 seconds
    tls: {
      rejectUnauthorized: false, // Prevents certificate chain issues on cloud firewalls/proxies
    },
  };

  if (options?.useGmailService) {
    baseConfig.service = "gmail";
    return nodemailer.createTransport(baseConfig);
  }

  const port = options?.alternatePort ?? config.port;
  const secure = port === 465;

  baseConfig.host = config.host;
  baseConfig.port = port;
  baseConfig.secure = secure;

  return nodemailer.createTransport(baseConfig);
}

// ── Mask email for display (te****@gmail.com) ──────────────────────────────
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}****@${domain}`;
}

// ── OTP Email Template ─────────────────────────────────────────────────────
function buildOtpEmailHtml(name: string, otp: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Verify your Brainzima account</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; }
  .wrapper { max-width: 560px; margin: 40px auto; padding: 0 16px; }
  .card { background: #ffffff; border-radius: 20px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.07); }
  .header { background: linear-gradient(135deg, #5B21F4 0%, #7C3AED 55%, #2563EB 100%); padding: 32px 32px 28px; text-align: center; }
  .logo { display: inline-flex; align-items: center; gap: 10px; }
  .logo-icon { width: 44px; height: 44px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
  .logo-text { color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
  .logo-sub { color: rgba(255,255,255,0.7); font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin-top: 1px; }
  .body { padding: 36px 32px; }
  .greeting { font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 10px; }
  .message { font-size: 14px; color: #475569; line-height: 1.7; margin-bottom: 28px; }
  .otp-section { text-align: center; margin: 0 0 28px; }
  .otp-label { font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 14px; }
  .otp-code { display: inline-block; font-size: 42px; font-weight: 900; letter-spacing: 10px; color: #5B21F4; background: #F1EEFF; border: 2px solid #DDD6FE; border-radius: 16px; padding: 16px 28px; font-family: 'Courier New', monospace; }
  .validity { text-align: center; background: #FFFBEB; border: 1px solid #FEF3C7; border-radius: 12px; padding: 12px 16px; margin-bottom: 28px; }
  .validity p { font-size: 13px; color: #92400E; font-weight: 600; }
  .validity span { color: #F59E0B; }
  .divider { height: 1px; background: #F1F5F9; margin: 0 0 24px; }
  .footer-note { font-size: 12px; color: #94A3B8; line-height: 1.6; text-align: center; }
  .footer { background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px 32px; text-align: center; }
  .footer p { font-size: 12px; color: #94A3B8; }
  .footer strong { color: #5B21F4; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <!-- Header -->
    <div class="header">
      <div class="logo">
        <div class="logo-icon">🎓</div>
        <div>
          <div class="logo-text">Brainzima</div>
          <div class="logo-sub">Student Portal</div>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div class="body">
      <p class="greeting">Hello, ${name}! 👋</p>
      <p class="message">
        Thank you for registering with Brainzima. To complete your account verification, 
        please use the following One-Time Password (OTP):
      </p>

      <!-- OTP Code -->
      <div class="otp-section">
        <p class="otp-label">Your Verification Code</p>
        <div class="otp-code">${otp}</div>
      </div>

      <!-- Validity Notice -->
      <div class="validity">
        <p>⏱ This OTP is valid for <span>10 minutes only</span>.</p>
      </div>

      <div class="divider"></div>

      <p class="footer-note">
        If you did not create a Brainzima account, you can safely ignore this email. 
        No account will be created without verification.
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>© 2026 <strong>Brainzima</strong> Student Management System</p>
      <p style="margin-top: 4px;">Need help? Contact <a href="mailto:support@brainzima.com" style="color:#2563EB;">support@brainzima.com</a></p>
    </div>
  </div>

  <!-- Security note below card -->
  <p style="text-align:center; font-size:11px; color:#CBD5E1; margin-top:16px;">
    This is an automated message. Please do not reply to this email.
  </p>
</div>
</body>
</html>`;
}

/**
 * Diagnostic helper: Verifies SMTP credentials and connectivity.
 * Useful for checking health in production without sending real emails.
 */
export async function verifySmtpConnection(): Promise<{
  success: boolean;
  message: string;
  config: {
    configured: boolean;
    host: string;
    port: number;
    user: string;
    fromEmail: string;
    fromName: string;
    isGmail: boolean;
    hasPass: boolean;
    passLength: number;
  };
  error?: {
    code?: string;
    response?: string;
    responseCode?: number;
    message: string;
    diagnosis: string;
  };
}> {
  const config = getCleanSmtpConfig();

  const configSummary = {
    configured: config.configured,
    host: config.host,
    port: config.port,
    user: config.user ? maskEmail(config.user) : "(not set)",
    fromEmail: config.fromEmail ? maskEmail(config.fromEmail) : "(not set)",
    fromName: config.fromName,
    isGmail: config.isGmail,
    hasPass: Boolean(config.pass),
    passLength: config.cleanPass ? config.cleanPass.length : 0,
  };

  if (!config.configured) {
    return {
      success: false,
      message: "SMTP configuration is incomplete in production environment.",
      config: configSummary,
      error: {
        message: "Missing SMTP_USER or SMTP_PASS environment variables.",
        diagnosis:
          "Please configure SMTP_USER and SMTP_PASS (or GMAIL_USER and GMAIL_PASS) in your hosting dashboard (e.g. Vercel Project Settings > Environment Variables).",
      },
    };
  }

  // Attempt verification using primary transporter
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return {
      success: true,
      message: "SMTP connection verified successfully.",
      config: configSummary,
    };
  } catch (err: any) {
    console.error("[Brainzima SMTP Diagnostic] Primary verify failed:", err);

    // Fallback: If Gmail on port 465/587 failed, test with service: 'gmail'
    if (config.isGmail) {
      try {
        const gmailTransporter = createTransporter({ useGmailService: true });
        await gmailTransporter.verify();
        return {
          success: true,
          message: "SMTP connection verified successfully using Gmail service fallback.",
          config: configSummary,
        };
      } catch (fallbackErr: any) {
        console.error("[Brainzima SMTP Diagnostic] Fallback verify failed:", fallbackErr);
      }
    }

    let diagnosis = "Unknown error occurred while connecting to SMTP server.";
    if (err.code === "EAUTH" || err.responseCode === 535) {
      diagnosis =
        "Google rejected the credentials. Ensure 2-Step Verification is active on the Gmail account and use a freshly generated 16-character App Password (not your normal Gmail login password). Do not include quotes.";
    } else if (err.code === "ETIMEDOUT" || err.code === "ECONNREFUSED" || err.code === "ESOCKETTIMEDOUT") {
      diagnosis =
        "Connection timed out. Hosting provider (e.g. Vercel or AWS) may be blocking outbound port. For Gmail, use port 465 with SSL.";
    }

    return {
      success: false,
      message: err.message || "Failed to verify SMTP connection.",
      config: configSummary,
      error: {
        code: err.code,
        response: err.response,
        responseCode: err.responseCode,
        message: err.message,
        diagnosis,
      },
    };
  }
}

// ── Send OTP Email with multi-transport failover ───────────────────────────
export async function sendOtpEmail(params: {
  to: string;
  name: string;
  otp: string;
}): Promise<void> {
  const config = getCleanSmtpConfig();

  // Section 15: Safe server-side diagnostics (never log password, OTP, or token)
  console.log("[SMTP Diagnostic]", {
    "SMTP host configured": Boolean(config.host),
    "SMTP port": config.port,
    "SMTP username configured": Boolean(config.user),
    "SMTP connection result": config.configured ? "credentials_present" : "credentials_missing",
    "error code": config.configured ? null : "ECONFIG",
    "error message": config.configured ? null : "SMTP credentials missing in environment",
  });

  // 1. Immediate validation with clear error if environment variables are missing
  if (!config.configured) {
    const missingKeys: string[] = [];
    if (!config.user) missingKeys.push("SMTP_USER / GMAIL_USER");
    if (!config.pass) missingKeys.push("SMTP_PASS / GMAIL_PASS");

    const errDetail = `[Brainzima SMTP Error] Production email credentials missing: ${missingKeys.join(", ")}. Please configure these in your deployment environment variables (e.g. Vercel dashboard).`;
    console.error(errDetail);

    const error: any = new Error(
      "Email configuration missing: SMTP_USER or SMTP_PASS is not set in production."
    );
    error.code = "ECONFIG";
    error.isConfigError = true;
    throw error;
  }

  const mailOptions: any = {
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: params.to,
    replyTo: config.fromEmail,
    subject: `${params.otp} is your Brainzima verification code`,
    html: buildOtpEmailHtml(params.name, params.otp),
    text: `Hello ${params.name},\n\nYour Brainzima verification code is: ${params.otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not create this account, please ignore this email.\n\nBrainzima Student Management System`,
    priority: "high",
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      Importance: "high",
    },
  };

  // 2. Primary attempt (Port 465 SSL or configured host/port with clean password)
  let lastError: any = null;
  try {
    const primaryTransporter = createTransporter();
    await primaryTransporter.sendMail(mailOptions);
    return;
  } catch (err: any) {
    lastError = err;
    console.warn(
      `[Brainzima SMTP] Primary delivery attempt failed (${err.code || err.message}). Attempting fallback transport...`
    );
  }

  // 3. Fallback attempt for Gmail (service: 'gmail' or alternate port)
  if (config.isGmail) {
    try {
      const fallbackTransporter = createTransporter({ useGmailService: true });
      await fallbackTransporter.sendMail(mailOptions);
      console.info("[Brainzima SMTP] Delivery succeeded via Gmail service fallback.");
      return;
    } catch (fallbackErr: any) {
      lastError = fallbackErr;
      console.warn(
        `[Brainzima SMTP] Fallback attempt 1 failed (${fallbackErr.code || fallbackErr.message}). Trying raw password format...`
      );
    }

    // Attempt with raw password format (in case spaces were required or vice versa)
    try {
      const rawPassTransporter = createTransporter({
        useGmailService: true,
        useRawPass: true,
      });
      await rawPassTransporter.sendMail(mailOptions);
      console.info("[Brainzima SMTP] Delivery succeeded via raw password format.");
      return;
    } catch (rawErr: any) {
      lastError = rawErr;
    }
  } else {
    // Custom SMTP fallback: try alternate port (587 <-> 465)
    try {
      const altPort = config.port === 465 ? 587 : 465;
      const altTransporter = createTransporter({ alternatePort: altPort });
      await altTransporter.sendMail(mailOptions);
      console.info(`[Brainzima SMTP] Delivery succeeded via alternate port ${altPort}.`);
      return;
    } catch (altErr: any) {
      lastError = altErr;
    }
  }

  // 4. Exhaustive error logging for production diagnostics
  const isAuth = lastError?.code === "EAUTH" || lastError?.responseCode === 535;
  const isTimeout =
    lastError?.code === "ETIMEDOUT" ||
    lastError?.code === "ECONNREFUSED" ||
    lastError?.code === "ESOCKETTIMEDOUT";

  console.error("[Brainzima SMTP Delivery Failure Summary]:", {
    to: maskEmail(params.to),
    host: config.host,
    port: config.port,
    user: maskEmail(config.user),
    hasPassword: Boolean(config.pass),
    errorCode: lastError?.code,
    responseCode: lastError?.responseCode,
    response: lastError?.response,
    errorMessage: lastError?.message,
    possibleCause: isAuth
      ? "Google App Password rejected. Check for 2FA, expired app password, or quotes in env."
      : isTimeout
      ? "Outbound SMTP port blocked or timed out by hosting provider. Ensure port 465 SSL is enabled."
      : "SMTP connection or message dispatch rejected by server.",
  });

  throw lastError;
}

// ── Enrollment Success Email Template ─────────────────────────────────────
function buildEnrollmentEmailHtml(params: {
  name: string;
  course_name: string;
  st_regno: string;
  amount: number | string;
  franchisee_name: string;
  franchisee_adrs: string;
}): string {
  const formattedAmount =
    typeof params.amount === "number"
      ? params.amount.toLocaleString("en-IN")
      : params.amount;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Welcome to Brainzima — Course Enrollment Successful</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; }
  .wrapper { max-width: 600px; margin: 36px auto; padding: 0 16px; }
  .card { background: #ffffff; border-radius: 24px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.06); }
  .header { background: linear-gradient(135deg, #5B21F4 0%, #7C3AED 50%, #2563EB 100%); padding: 36px 32px 30px; text-align: center; }
  .logo { display: inline-flex; align-items: center; gap: 10px; }
  .logo-icon { width: 44px; height: 44px; background: rgba(255,255,255,0.22); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; }
  .logo-text { color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
  .logo-sub { color: rgba(255,255,255,0.8); font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
  .badge { display: inline-block; background: #ECFDF5; color: #047857; font-size: 12px; font-weight: 800; border-radius: 20px; padding: 6px 14px; border: 1px solid #A7F3D0; margin-top: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
  .body { padding: 36px 32px; }
  .greeting { font-size: 19px; font-weight: 800; color: #111827; margin-bottom: 12px; }
  .intro { font-size: 14px; color: #475569; line-height: 1.7; margin-bottom: 24px; }
  .summary-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 18px; padding: 22px 24px; margin-bottom: 26px; }
  .summary-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #EDF2F7; }
  .summary-row:last-child { border-bottom: none; padding-bottom: 0; }
  .summary-row:first-child { padding-top: 0; }
  .summary-label { font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.8px; }
  .summary-val { font-size: 14px; font-weight: 700; color: #0F172A; text-align: right; max-width: 65%; }
  .reg-badge { font-family: 'Courier New', monospace; font-size: 16px; font-weight: 900; color: #5B21F4; background: #F1EEFF; border: 1px solid #DDD6FE; padding: 4px 10px; border-radius: 8px; display: inline-block; }
  .amount-val { font-size: 16px; font-weight: 900; color: #059669; }
  .notice { background: #F0FDF4; border: 1px solid #DCFCE7; border-radius: 14px; padding: 14px 18px; margin-bottom: 28px; text-align: center; }
  .notice p { font-size: 13px; font-weight: 700; color: #166534; }
  .btn-wrapper { text-align: center; margin-bottom: 26px; }
  .btn { display: inline-block; background: linear-gradient(135deg, #5B21F4 0%, #2563EB 100%); color: #ffffff !important; font-size: 14px; font-weight: 800; padding: 14px 32px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 14px rgba(91,33,244,0.3); }
  .footer-note { font-size: 12px; color: #94A3B8; line-height: 1.6; text-align: center; }
  .footer { background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 22px 32px; text-align: center; }
  .footer p { font-size: 12px; color: #94A3B8; }
  .footer strong { color: #5B21F4; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div class="logo">
        <div class="logo-icon">🎓</div>
        <div>
          <div class="logo-text">Brainzima</div>
          <div class="logo-sub">Student Portal</div>
        </div>
      </div>
      <div>
        <span class="badge">✓ Admission Confirmed</span>
      </div>
    </div>

    <div class="body">
      <p class="greeting">Hello ${params.name},</p>
      <p class="intro">
        Thank you for enrolling in <strong>${params.course_name}</strong>.
        Your admission has been confirmed and your payment was received successfully.
      </p>

      <div class="summary-card">
        <div class="summary-row">
          <span class="summary-label">Registration Number</span>
          <span class="summary-val"><span class="reg-badge">${params.st_regno}</span></span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Course</span>
          <span class="summary-val">${params.course_name}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Amount Paid</span>
          <span class="summary-val amount-val">₹${formattedAmount}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Study Centre</span>
          <span class="summary-val">${params.franchisee_name}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Centre Address</span>
          <span class="summary-val">${params.franchisee_adrs}</span>
        </div>
      </div>

      <div class="notice">
        <p>🎉 Your Brainzima student account is now active.</p>
      </div>

      <div class="btn-wrapper">
        <a href="https://student.brainzima.com/student" class="btn">Access Student Dashboard</a>
      </div>

      <p class="footer-note">
        You can now view your course curriculum, attendance, fee receipts, and study notes directly inside your Student Portal.
      </p>
    </div>

    <div class="footer">
      <p>© 2026 <strong>Brainzima</strong> Student Management System</p>
      <p style="margin-top: 4px;">Need assistance? Email <a href="mailto:support@brainzima.com" style="color:#2563EB;">support@brainzima.com</a></p>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ── Send Course Enrollment Confirmation Email ─────────────────────────────
export async function sendEnrollmentSuccessEmail(params: {
  to: string;
  name: string;
  course_name: string;
  st_regno: string;
  amount: number | string;
  franchisee_name: string;
  franchisee_adrs: string;
}): Promise<void> {
  const config = getCleanSmtpConfig();

  if (!config.configured) {
    console.warn("[Brainzima SMTP] Skipped sending enrollment email: SMTP not configured.");
    return;
  }

  const formattedAmount =
    typeof params.amount === "number"
      ? params.amount.toLocaleString("en-IN")
      : params.amount;

  const textBody = `Hello ${params.name},\n\n` +
    `Thank you for enrolling in ${params.course_name}.\n\n` +
    `Registration Number:\n${params.st_regno}\n\n` +
    `Course:\n${params.course_name}\n\n` +
    `Amount Paid:\n₹${formattedAmount}\n\n` +
    `Study Centre:\n${params.franchisee_name}\n\n` +
    `Centre Address:\n${params.franchisee_adrs}\n\n` +
    `Your Brainzima student account is now active.\n\n` +
    `Log in at: https://student.brainzima.com/student\n\n` +
    `Brainzima Student Management System`;

  const mailOptions: any = {
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: params.to,
    replyTo: config.fromEmail,
    subject: "Welcome to Brainzima — Course Enrollment Successful",
    html: buildEnrollmentEmailHtml(params),
    text: textBody,
    priority: "high",
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      Importance: "high",
    },
  };

  // Attempt delivery with failover
  try {
    const primaryTransporter = createTransporter();
    await primaryTransporter.sendMail(mailOptions);
    console.info(`[Brainzima SMTP] Enrollment confirmation email sent to ${maskEmail(params.to)}`);
    return;
  } catch (err: any) {
    console.warn(
      `[Brainzima SMTP] Primary delivery for enrollment email failed (${err.message}). Trying fallback transport...`
    );
  }

  if (config.isGmail) {
    try {
      const fallbackTransporter = createTransporter({ useGmailService: true });
      await fallbackTransporter.sendMail(mailOptions);
      console.info(`[Brainzima SMTP] Enrollment confirmation sent via Gmail fallback.`);
      return;
    } catch (fbErr: any) {
      console.error("[Brainzima SMTP] Failed to send enrollment confirmation email:", fbErr.message);
    }
  }
}

// ── Course Payment Confirmation Email (Admission & Installments) ───────────
export interface CoursePaymentEmailParams {
  to: string;
  student_name: string;
  registration_number: string;
  course_name: string;
  course_code?: string;
  stc_id: number | string;
  payment_type: "Initial Admission Payment" | "Course Fee Installment" | string;
  amount_paid: number;
  payment_mode: string;
  payref: string;
  tr_id?: number | string;
  total_fee: number;
  discount: number;
  previous_paid: number;
  total_paid: number;
  remaining_dues: number;
  payment_date: string;
  franchisee_name?: string;
  franchisee_adrs?: string;
}

export function buildPaymentConfirmationHtml(params: CoursePaymentEmailParams): string {
  const formattedAmount = params.amount_paid.toLocaleString("en-IN");
  const formattedTotalFee = params.total_fee.toLocaleString("en-IN");
  const formattedDiscount = params.discount.toLocaleString("en-IN");
  const formattedPrevPaid = params.previous_paid.toLocaleString("en-IN");
  const formattedTotalPaid = params.total_paid.toLocaleString("en-IN");
  const formattedDues = params.remaining_dues <= 0 ? "0" : params.remaining_dues.toLocaleString("en-IN");
  const isFullyPaid = params.remaining_dues <= 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Payment Confirmation — Brainzima</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; }
  .wrapper { max-width: 600px; margin: 36px auto; padding: 0 16px; }
  .card { background: #ffffff; border-radius: 24px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.06); }
  .header { background: linear-gradient(135deg, #5B21F4 0%, #7C3AED 50%, #2563EB 100%); padding: 32px 32px 28px; text-align: center; }
  .logo { display: inline-flex; align-items: center; gap: 10px; }
  .logo-icon { width: 44px; height: 44px; background: rgba(255,255,255,0.22); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; }
  .logo-text { color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
  .logo-sub { color: rgba(255,255,255,0.85); font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
  
  .success-banner { background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 16px; padding: 18px 20px; margin: 24px 32px 0; text-align: center; }
  .success-title { font-size: 16px; font-weight: 800; color: #047857; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .success-sub { font-size: 13px; color: #065F46; margin-top: 4px; font-weight: 500; }
  
  .body { padding: 24px 32px 36px; }
  .greeting { font-size: 17px; font-weight: 800; color: #111827; margin-bottom: 8px; }
  .intro { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px; }
  
  .section-title { font-size: 12px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
  
  .details-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 18px; padding: 18px 20px; margin-bottom: 22px; }
  .details-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #EDF2F7; }
  .details-row:last-child { border-bottom: none; padding-bottom: 0; }
  .details-row:first-child { padding-top: 0; }
  .details-label { font-size: 12px; font-weight: 600; color: #64748B; }
  .details-val { font-size: 13px; font-weight: 700; color: #0F172A; text-align: right; max-width: 65%; }
  
  .badge-reg { font-family: 'Courier New', monospace; font-size: 13px; font-weight: 800; color: #5B21F4; background: #F1EEFF; border: 1px solid #DDD6FE; padding: 2px 8px; border-radius: 6px; display: inline-block; }
  .badge-mono { font-family: 'Courier New', monospace; font-size: 12px; font-weight: 700; color: #475569; background: #F1F5F9; border: 1px solid #E2E8F0; padding: 2px 6px; border-radius: 6px; display: inline-block; }
  .badge-type { font-size: 11px; font-weight: 800; color: #1D4ED8; background: #EFF6FF; border: 1px solid #BFDBFE; padding: 3px 8px; border-radius: 12px; display: inline-block; text-transform: uppercase; }
  .badge-paid { font-size: 16px; font-weight: 900; color: #059669; }
  
  .ledger-card { background: #FFFFFF; border: 2px solid #E2E8F0; border-radius: 18px; padding: 18px 20px; margin-bottom: 26px; }
  .ledger-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; font-size: 13px; }
  .ledger-label { color: #64748B; }
  .ledger-val { font-weight: 700; color: #1E293B; }
  .ledger-divider { height: 1px; background: #E2E8F0; margin: 8px 0; }
  .ledger-total { font-size: 14px; font-weight: 800; color: #0F172A; }
  .ledger-dues { font-size: 15px; font-weight: 900; }
  
  .btn-wrapper { text-align: center; margin: 26px 0 20px; }
  .btn { display: inline-block; background: linear-gradient(135deg, #5B21F4 0%, #2563EB 100%); color: #ffffff !important; font-size: 14px; font-weight: 800; padding: 14px 32px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 14px rgba(91,33,244,0.25); }
  
  .footer { background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 22px 32px; text-align: center; }
  .footer p { font-size: 12px; color: #94A3B8; line-height: 1.6; }
  .footer strong { color: #5B21F4; }
  .footer a { color: #2563EB; text-decoration: none; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <!-- Header -->
    <div class="header">
      <div class="logo">
        <div class="logo-icon">🎓</div>
        <div>
          <div class="logo-text">Brainzima</div>
          <div class="logo-sub">Student Portal</div>
        </div>
      </div>
    </div>

    <!-- Payment Status Alert Banner (Requirement 11) -->
    <div class="success-banner">
      <div class="success-title">✓ Payment Successful</div>
      <div class="success-sub">Your payment has been recorded successfully in the Brainzima Student Management System.</div>
    </div>

    <div class="body">
      <p class="greeting">Dear ${params.student_name},</p>
      <p class="intro">Your course payment has been successfully received.</p>

      <!-- Section: Payment Details (Requirement 9 & 12) -->
      <div class="section-title">Payment & Enrollment Details</div>
      <div class="details-card">
        <div class="details-row">
          <span class="details-label">Student Name</span>
          <span class="details-val">${params.student_name}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Registration Number</span>
          <span class="details-val"><span class="badge-reg">${params.registration_number}</span></span>
        </div>
        <div class="details-row">
          <span class="details-label">Course</span>
          <span class="details-val">${params.course_name}${params.course_code ? ` (${params.course_code})` : ""}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Enrollment ID</span>
          <span class="details-val"><span class="badge-mono">#${params.stc_id}</span></span>
        </div>
        <div class="details-row">
          <span class="details-label">Payment Type</span>
          <span class="details-val"><span class="badge-type">${params.payment_type}</span></span>
        </div>
        <div class="details-row">
          <span class="details-label">Amount Paid</span>
          <span class="details-val badge-paid">₹${formattedAmount}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Payment Mode</span>
          <span class="details-val" style="text-transform:uppercase;">${params.payment_mode}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Payment Reference</span>
          <span class="details-val"><span class="badge-mono">${params.payref}</span></span>
        </div>
        ${params.tr_id ? `
        <div class="details-row">
          <span class="details-label">Transaction ID</span>
          <span class="details-val"><span class="badge-mono">#${params.tr_id}</span></span>
        </div>` : ""}
        <div class="details-row">
          <span class="details-label">Payment Date</span>
          <span class="details-val">${params.payment_date}</span>
        </div>
        ${params.franchisee_name ? `
        <div class="details-row">
          <span class="details-label">Study Centre</span>
          <span class="details-val">${params.franchisee_name}</span>
        </div>` : ""}
      </div>

      <!-- Section: Fee Summary (Requirement 10) -->
      <div class="section-title">Authoritative Fee Summary</div>
      <div class="ledger-card">
        <div class="ledger-row">
          <span class="ledger-label">Total Course Fee</span>
          <span class="ledger-val">₹${formattedTotalFee}</span>
        </div>
        ${params.discount > 0 ? `
        <div class="ledger-row" style="color:#059669;">
          <span>Discount Applied</span>
          <span style="font-weight:700;">-₹${formattedDiscount}</span>
        </div>` : ""}
        <div class="ledger-row">
          <span class="ledger-label">Previous Paid</span>
          <span class="ledger-val">₹${formattedPrevPaid}</span>
        </div>
        <div class="ledger-row" style="color:#059669;">
          <span style="font-weight:700;">Current Payment</span>
          <span style="font-weight:800;">+₹${formattedAmount}</span>
        </div>
        <div class="ledger-divider"></div>
        <div class="ledger-row ledger-total">
          <span>Total Paid To Date</span>
          <span style="color:#059669;">₹${formattedTotalPaid}</span>
        </div>
        <div class="ledger-divider"></div>
        <div class="ledger-row">
          <span style="font-weight:800; color:${isFullyPaid ? "#059669" : "#B45309"};">Remaining Dues</span>
          <span class="ledger-dues" style="color:${isFullyPaid ? "#059669" : "#B45309"};">
            ${isFullyPaid ? "₹0 (Fully Paid 🎉)" : `₹${formattedDues}`}
          </span>
        </div>
      </div>

      <!-- Action Button -->
      <div class="btn-wrapper">
        <a href="https://student.brainzima.com/student/fees" class="btn">View in Student Portal</a>
      </div>
    </div>

    <!-- Footer (Requirement 13) -->
    <div class="footer">
      <p>Regards,<br /><strong>Brainzima Student Portal</strong></p>
      <p style="margin-top: 8px;">
        Need help or have questions regarding your fee receipt? Contact <a href="mailto:support@brainzima.com">support@brainzima.com</a>
      </p>
      <p style="margin-top: 10px; font-size: 11px; color: #CBD5E1;">
        This is an automated confirmation of your payment in the Brainzima Student Management System. Please do not reply directly to this email.
      </p>
    </div>
  </div>
</div>
</body>
</html>`;
}

export async function sendPaymentConfirmationEmail(
  params: CoursePaymentEmailParams
): Promise<{ success: boolean; error?: string }> {
  const config = getCleanSmtpConfig();

  if (!config.configured) {
    console.warn("[Brainzima SMTP] Skipped sending payment confirmation: SMTP not configured.");
    return { success: false, error: "SMTP not configured" };
  }

  const isAdmission =
    params.payment_type.toLowerCase().includes("admission") ||
    params.payment_type.toLowerCase().includes("initial") ||
    params.payment_type.toLowerCase().includes("enrollment");

  const subject = isAdmission
    ? `Course Enrollment Payment Successful — ${params.course_name} | Brainzima`
    : `Course Fee Payment Successful — ${params.course_name} | Brainzima`;

  const textBody =
    `Dear ${params.student_name},\n\n` +
    `Your course payment has been successfully received.\n\n` +
    `--- Payment Details ---\n` +
    `Status: SUCCESS\n` +
    `Student Name: ${params.student_name}\n` +
    `Registration Number: ${params.registration_number}\n` +
    `Course: ${params.course_name}${params.course_code ? ` (${params.course_code})` : ""}\n` +
    `Enrollment ID: #${params.stc_id}\n` +
    `Payment Type: ${params.payment_type}\n` +
    `Amount Paid: ₹${params.amount_paid.toLocaleString("en-IN")}\n` +
    `Payment Mode: ${params.payment_mode.toUpperCase()}\n` +
    `Payment Reference: ${params.payref}\n` +
    (params.tr_id ? `Transaction ID: #${params.tr_id}\n` : "") +
    `Payment Date: ${params.payment_date}\n\n` +
    `--- Fee Summary ---\n` +
    `Total Course Fee: ₹${params.total_fee.toLocaleString("en-IN")}\n` +
    `Discount: ₹${params.discount.toLocaleString("en-IN")}\n` +
    `Previous Paid: ₹${params.previous_paid.toLocaleString("en-IN")}\n` +
    `Current Payment: ₹${params.amount_paid.toLocaleString("en-IN")}\n` +
    `Total Paid: ₹${params.total_paid.toLocaleString("en-IN")}\n` +
    `Remaining Dues: ₹${params.remaining_dues.toLocaleString("en-IN")}\n\n` +
    `Log in to view your receipts: https://student.brainzima.com/student/fees\n\n` +
    `Regards,\nBrainzima Student Portal\nsupport@brainzima.com`;

  const mailOptions: any = {
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: params.to,
    replyTo: config.fromEmail,
    subject,
    html: buildPaymentConfirmationHtml(params),
    text: textBody,
    priority: "high",
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      Importance: "high",
    },
  };

  let lastError: any = null;

  try {
    const primaryTransporter = createTransporter();
    await primaryTransporter.sendMail(mailOptions);
    console.info(
      `[Brainzima SMTP] Payment confirmation email sent successfully to ${maskEmail(params.to)} (stc_id #${params.stc_id})`
    );
    return { success: true };
  } catch (err: any) {
    lastError = err;
    console.warn(
      `[Brainzima SMTP] Primary delivery for payment email failed (${err?.message}). Trying fallback transport...`
    );
  }

  if (config.isGmail) {
    try {
      const fallbackTransporter = createTransporter({ useGmailService: true });
      await fallbackTransporter.sendMail(mailOptions);
      console.info(
        `[Brainzima SMTP] Payment confirmation sent via Gmail fallback to ${maskEmail(params.to)}`
      );
      return { success: true };
    } catch (fbErr: any) {
      lastError = fbErr;
    }
  }

  console.error("[Payment Email Failure]", {
    stc_id: params.stc_id,
    tr_id: params.tr_id,
    recipient: maskEmail(params.to),
    error: lastError?.message,
  });

  return { success: false, error: lastError?.message || "Delivery failed" };
}

