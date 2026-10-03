export function cn(...classes: (string | undefined | null | false | Record<string, boolean>)[]) {
  return classes
    .flatMap((c) => {
      if (!c) return [];
      if (typeof c === "string") return c.split(" ");
      if (typeof c === "object") {
        return Object.entries(c)
          .filter(([_, v]) => Boolean(v))
          .map(([k]) => k);
      }
      return [];
    })
    .filter(Boolean)
    .join(" ");
}

/**
 * Format a Date object into Indian Standard Time (IST, Asia/Kolkata) MySQL DATETIME string: YYYY-MM-DD HH:mm:ss
 */
export function getCurrentSqlDateTime(date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
  } catch {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffsetMs);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${istDate.getUTCFullYear()}-${pad(istDate.getUTCMonth() + 1)}-${pad(istDate.getUTCDate())} ${pad(istDate.getUTCHours())}:${pad(istDate.getUTCMinutes())}:${pad(istDate.getUTCSeconds())}`;
  }
}

/**
 * Format any date string or MySQL UTC timestamp into Indian Standard Time (Asia/Kolkata): YYYY-MM-DD HH:mm:ss
 */
export function formatIstDateTime(val?: string | Date | null): string {
  if (!val) return getCurrentSqlDateTime();
  let date: Date;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return getCurrentSqlDateTime();
    if (trimmed.includes("T") || trimmed.endsWith("Z") || trimmed.includes("+")) {
      date = new Date(trimmed);
    } else {
      // MySQL DATETIME "YYYY-MM-DD HH:mm:ss" without offset is stored in UTC by the backend
      date = new Date(trimmed.replace(" ", "T") + "Z");
    }
  } else {
    date = val;
  }

  if (isNaN(date.getTime())) {
    return String(val);
  }

  return getCurrentSqlDateTime(date);
}

/**
 * Extract real client IP from incoming HTTP request headers or client-reported IP
 */
export function getClientIp(
  req: { headers: Headers } | Request,
  clientReportedIp?: string | null
): string {
  const headers = req.headers;

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0].trim();
    if (first && first !== "::1" && first !== "127.0.0.1" && first !== "0.0.0.0") {
      return first.replace(/^::ffff:/, "");
    }
  }

  const realIp = headers.get("x-real-ip");
  if (realIp && realIp !== "::1" && realIp !== "127.0.0.1" && realIp !== "0.0.0.0") {
    return realIp.replace(/^::ffff:/, "");
  }

  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (
    cfConnectingIp &&
    cfConnectingIp !== "::1" &&
    cfConnectingIp !== "127.0.0.1" &&
    cfConnectingIp !== "0.0.0.0"
  ) {
    return cfConnectingIp.replace(/^::ffff:/, "");
  }

  const trueClientIp = headers.get("true-client-ip");
  if (
    trueClientIp &&
    trueClientIp !== "::1" &&
    trueClientIp !== "127.0.0.1" &&
    trueClientIp !== "0.0.0.0"
  ) {
    return trueClientIp.replace(/^::ffff:/, "");
  }

  const clientIp = headers.get("x-client-ip");
  if (clientIp && clientIp !== "::1" && clientIp !== "127.0.0.1" && clientIp !== "0.0.0.0") {
    return clientIp.replace(/^::ffff:/, "");
  }

  // If client provided a valid public IP or non-empty IP
  if (
    clientReportedIp &&
    clientReportedIp !== "0.0.0.0" &&
    clientReportedIp !== "::1" &&
    clientReportedIp.trim() !== ""
  ) {
    return clientReportedIp.trim().replace(/^::ffff:/, "");
  }

  return "127.0.0.1";
}

