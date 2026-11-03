"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/session";

export default function CertificateRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const session = getSession();
    if (session?.is_student || session?.role === "student") {
      router.replace("/student/certificate");
    } else {
      router.replace("/user/certificate");
    }
  }, [router]);

  return null;
}
