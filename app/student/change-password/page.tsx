"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
} from "lucide-react";
import { useStudent } from "@/hooks/useStudent";
import { changeStudentPassword } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] as const },
});

export default function StudentChangePasswordPage() {
  const { user_id } = useStudent();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Password strength validation checks
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);

    if (!user_id) {
      toast({
        variant: "error",
        title: "Session Expired",
        description: "Please log in again to change your password.",
      });
      return;
    }

    if (!hasMinLength) {
      toast({
        variant: "error",
        title: "Weak Password",
        description: "New password must be at least 8 characters long.",
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        variant: "error",
        title: "Passwords Do Not Match",
        description: "New password and confirmation do not match.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changeStudentPassword(user_id, currentPassword, newPassword);

      if (res.success) {
        setSuccessMessage("Your password has been changed successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        toast({
          variant: "success",
          title: "Password Updated",
          description: "Your security credentials have been updated in the database.",
        });
      } else {
        toast({
          variant: "error",
          title: "Update Failed",
          description: res.message || "Failed to update password. Please check your current password.",
        });
      }
    } catch {
      toast({
        variant: "error",
        title: "Network Error",
        description: "Failed to connect to authentication server.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-xl mx-auto">
      {/* ── Page Header ── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-[#5B21F4] animate-pulse" />
          <span className="text-xs font-bold text-[#5B21F4] uppercase tracking-wider">
            Account Security
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
          Change Password
        </h1>
        <p className="text-sm text-[#64748B] mt-0.5">
          Update your student portal password to keep your academic profile secure.
        </p>
      </div>

      {/* ── Success Alert ── */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-center gap-3 text-emerald-800 text-xs font-bold"
        >
          <CheckCircle2 className="w-5 h-5 text-[#08A66A] shrink-0" />
          <span>{successMessage}</span>
        </motion.div>
      )}

      {/* ── Security Advice Card ── */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#F1EEFF] to-[#EFF6FF] border border-[#DDD6FE] flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#5B21F4] shrink-0 mt-0.5" />
        <p className="text-xs text-[#475569] leading-relaxed">
          Use a strong, unique password that you do not use on other websites. Your password protects access to fee receipts and course records.
        </p>
      </div>

      {/* ── Password Change Form ── */}
      <motion.div {...fadeUp(0.05)}>
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 space-y-5"
        >
          {/* Current Password */}
          <div>
            <Label className="text-xs font-bold text-[#111827]">Current Password</Label>
            <div className="relative mt-1">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter existing password"
                required
                className="pr-10 h-11 text-xs rounded-xl"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#111827] cursor-pointer"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <Label className="text-xs font-bold text-[#111827]">New Password</Label>
            <div className="relative mt-1">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter strong new password"
                required
                className="pr-10 h-11 text-xs rounded-xl"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#111827] cursor-pointer"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <Label className="text-xs font-bold text-[#111827]">Confirm New Password</Label>
            <div className="relative mt-1">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                className="pr-10 h-11 text-xs rounded-xl"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#111827] cursor-pointer"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Requirements Checklist */}
          {newPassword && (
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5 text-[11px]">
              <p className="font-bold text-[#475569] mb-1">Password Requirements:</p>
              <div className="grid grid-cols-2 gap-1.5">
                <span className={hasMinLength ? "text-emerald-600 font-semibold" : "text-[#94A3B8]"}>
                  {hasMinLength ? "✓" : "○"} 8+ characters
                </span>
                <span className={hasUppercase ? "text-emerald-600 font-semibold" : "text-[#94A3B8]"}>
                  {hasUppercase ? "✓" : "○"} Uppercase letter
                </span>
                <span className={hasNumber ? "text-emerald-600 font-semibold" : "text-[#94A3B8]"}>
                  {hasNumber ? "✓" : "○"} Number included
                </span>
                <span className={passwordsMatch ? "text-emerald-600 font-semibold" : "text-[#94A3B8]"}>
                  {passwordsMatch ? "✓" : "○"} Passwords match
                </span>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 rounded-xl bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold shadow-md shadow-[#5B21F4]/20 gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Updating Password in Database...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Update Password</span>
              </>
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
