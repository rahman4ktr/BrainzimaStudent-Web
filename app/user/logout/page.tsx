"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearSession } from "@/lib/session";

export default function UserLogoutPage() {
  const router = useRouter();

  useEffect(() => {
    clearSession();
    router.replace("/");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="text-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#5B21F4]/30 border-t-[#5B21F4] animate-spin mx-auto mb-3" />
        <p className="text-sm text-[#64748B] font-medium">Signing you out...</p>
      </div>
    </div>
  );
}
