"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LockKeyhole,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Shield,
  KeyRound,
} from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] as const },
});

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  show,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide flex items-center gap-1.5">
        <LockKeyhole className="w-3.5 h-3.5" />
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
          <LockKeyhole className="w-4 h-4" />
        </div>
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-11 pl-10 pr-11 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:bg-white focus:border-[#5B21F4] focus:ring-2 focus:ring-[#5B21F4]/10 transition-all"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94A3B8] hover:text-[#475569] cursor-pointer"
          aria-label={show ? "Hide" : "Show"}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function StrengthBar({ password }: { password: string }) {
  const checks = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter", ok: /[a-z]/.test(password) },
    { label: "Number", ok: /[0-9]/.test(password) },
    { label: "Special character", ok: /[^a-zA-Z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const levels = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  const colors = ["", "#EF4444", "#F59E0B", "#F59E0B", "#08A66A", "#08A66A"];

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex-1 h-1.5 rounded-full transition-all duration-300"
            style={{ backgroundColor: i <= score ? colors[score] : "#F1F5F9" }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {checks.map((c) => (
            <span
              key={c.label}
              className={`flex items-center gap-1 text-[10px] font-medium ${
                c.ok ? "text-[#08A66A]" : "text-[#94A3B8]"
              }`}
            >
              <CheckCircle2 className={`w-3 h-3 ${c.ok ? "text-[#08A66A]" : "text-[#CBD5E1]"}`} />
              {c.label}
            </span>
          ))}
        </div>
        {score > 0 && (
          <span className="text-[11px] font-bold shrink-0 ml-2" style={{ color: colors[score] }}>
            {levels[score]}
          </span>
        )}
      </div>
    </div>
  );
}

export default function UserChangePasswordPage() {
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!current) return setError("Please enter your current password.");
    if (newPass.length < 8) return setError("New password must be at least 8 characters.");
    if (newPass !== confirm) return setError("Passwords do not match.");

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setCurrent("");
      setNewPass("");
      setConfirm("");
    }, 1400);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-lg mx-auto">

      {/* ── Header ── */}
      <motion.div {...fadeUp(0)}>
        <h2 className="text-xl font-extrabold text-[#111827]">Change Password</h2>
        <p className="text-sm text-[#64748B] mt-0.5">Keep your account secure with a strong password</p>
      </motion.div>

      {/* ── Success State ── */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-2xl p-5 text-center"
          >
            <CheckCircle2 className="w-10 h-10 text-[#08A66A] mx-auto mb-2" />
            <h3 className="text-sm font-extrabold text-[#111827]">Password Changed Successfully</h3>
            <p className="text-xs text-[#475569] mt-1">Your password has been updated. Use your new password next time you log in.</p>
            <button
              onClick={() => setSuccess(false)}
              className="mt-4 px-5 py-2 rounded-xl bg-[#08A66A] text-white text-sm font-bold hover:bg-[#078957] transition-colors cursor-pointer"
            >
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!success && (
        <>
          {/* ── Security Tips ── */}
          <motion.div {...fadeUp(0.05)}>
            <div
              className="rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #F1EEFF 0%, #EFF6FF 100%)" }}
            >
              <div className="w-9 h-9 rounded-xl bg-[#5B21F4]/10 flex items-center justify-center shrink-0">
                <Shield className="w-4.5 h-4.5 w-[18px] h-[18px] text-[#5B21F4]" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#5B21F4]">Password Security Tips</p>
                <ul className="mt-1.5 space-y-1">
                  {[
                    "Use at least 8 characters with mixed case",
                    "Include numbers and special characters",
                    "Avoid using personal information",
                    "Don't reuse passwords from other sites",
                  ].map((tip) => (
                    <li key={tip} className="text-[11px] text-[#475569] flex items-start gap-1.5">
                      <KeyRound className="w-3 h-3 text-[#5B21F4] mt-0.5 shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>

          {/* ── Form ── */}
          <motion.div {...fadeUp(0.1)}>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F1F5F9]">
                <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                  <LockKeyhole className="w-4 h-4 text-[#5B21F4]" />
                  Update Your Password
                </h3>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4" noValidate>
                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#EF4444] text-xs font-medium"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <PasswordField
                  id="current-password"
                  label="Current Password"
                  value={current}
                  onChange={setCurrent}
                  placeholder="Enter your current password"
                  show={showCurrent}
                  onToggle={() => setShowCurrent(!showCurrent)}
                />

                <div className="space-y-2">
                  <PasswordField
                    id="new-password"
                    label="New Password"
                    value={newPass}
                    onChange={setNewPass}
                    placeholder="Choose a strong new password"
                    show={showNew}
                    onToggle={() => setShowNew(!showNew)}
                  />
                  <StrengthBar password={newPass} />
                </div>

                <PasswordField
                  id="confirm-password"
                  label="Confirm New Password"
                  value={confirm}
                  onChange={setConfirm}
                  placeholder="Re-enter your new password"
                  show={showConfirm}
                  onToggle={() => setShowConfirm(!showConfirm)}
                />

                {/* Match indicator */}
                {confirm && newPass && (
                  <div
                    className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl ${
                      newPass === confirm
                        ? "bg-[#ECFDF5] text-[#08A66A]"
                        : "bg-[#FEF2F2] text-[#EF4444]"
                    }`}
                  >
                    {newPass === confirm ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    {newPass === confirm ? "Passwords match" : "Passwords do not match"}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#5B21F4]/20 hover:shadow-xl hover:shadow-[#5B21F4]/25 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #5B21F4 0%, #7C3AED 55%, #2563EB 100%)" }}
                  >
                    {loading ? (
                      <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      <>
                        <LockKeyhole className="w-4 h-4" />
                        Update Password
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}

      <div className="h-4" />
    </div>
  );
}
