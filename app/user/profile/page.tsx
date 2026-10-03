"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  UserCircle2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  BookOpen,
  Edit3,
  Camera,
  CheckCircle2,
  AlertCircle,
  Save,
  ShieldCheck,
  UserRound,
  Loader2,
  Sparkles,
  Trash2,
  Clock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getFileUrl, getInitials, formatIstDateTime } from "@/lib/session";
import { uploadUserImage, updateUserProfile } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] as const },
});

export default function UserProfilePage() {
  const { user, updateUserImage, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    mobile: "",
    dob: "2000-05-15",
    gender: "Male",
    address: "MG Road, Bangalore, Karnataka",
    interestedCourse: "MERN Stack Development",
    qualification: "Graduate",
  });

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        fullName: user.name || "",
        email: user.email || "",
        mobile: user.mobile || "",
      }));
    }
  }, [user]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (user?.user_id) {
      try {
        await updateUserProfile(user.user_id, "user", {
          name: form.fullName.trim(),
          mobile: form.mobile.trim(),
        });
      } catch (err) {
        console.warn("[Profile] Could not update profile fields:", err);
      }
    }
    setEditing(false);
    setSaved(true);
    toast({
      variant: "success",
      title: "Profile Saved",
      description: "Your personal details have been updated.",
    });
    setTimeout(() => setSaved(false), 3000);
  };

  // ── Profile Photo Upload Handler ──────────────────────────────────────────
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "error",
        title: "Image Too Large",
        description: "Profile image must be 5 MB or smaller.",
      });
      return;
    }

    setIsUploadingImage(true);
    try {
      const res = await uploadUserImage(file, user?.user_id, user?.user_image, "user", false);
      if (res.success && (res.user_image || res.db_path || res.url)) {
        const storedPath = res.user_image || res.db_path || res.url || "";

        // Persist to user profile
        if (user?.user_id) {
          await updateUserProfile(user.user_id, "user", {
            user_image: storedPath,
          });
        }

        // Update session in sessionStorage + auth state immediately
        updateUserImage(storedPath);

        toast({
          variant: "success",
          title: "Profile Photo Updated",
          description: "Your new avatar has been applied immediately.",
        });
      } else {
        toast({
          variant: "error",
          title: "Upload Failed",
          description: res.message || "Failed to upload profile photo.",
        });
      }
    } catch {
      toast({
        variant: "error",
        title: "Upload Error",
        description: "Network error while uploading photo.",
      });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Profile Photo Remove Handler ──────────────────────────────────────────
  const handleRemovePhoto = async () => {
    if (!user?.user_image) return;
    setIsUploadingImage(true);
    try {
      if (user?.user_id) {
        await updateUserProfile(user.user_id, "user", {
          user_image: null,
        });
      }
      updateUserImage(null);
      toast({
        variant: "success",
        title: "Photo Removed",
        description: "Profile photo has been moved to archive and removed.",
      });
    } catch {
      toast({
        variant: "error",
        title: "Action Failed",
        description: "Could not remove profile photo.",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const avatarUrl = getFileUrl(user?.user_image);
  const initials = getInitials(user?.name);
  const completion = 85;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      {/* ── Header ── */}
      <motion.div {...fadeUp(0)} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#111827]">My Profile</h2>
          <p className="text-sm text-[#64748B] mt-0.5">Manage your personal information and credentials</p>
        </div>
        <button
          onClick={() => (editing ? handleSave() : setEditing(true))}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            editing
              ? "bg-[#08A66A] text-white shadow-md shadow-[#08A66A]/20 hover:bg-[#078957]"
              : "bg-white border border-[#E2E8F0] text-[#5B21F4] hover:bg-[#F1EEFF]"
          }`}
        >
          {editing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
          {editing ? "Save Changes" : "Edit Profile"}
        </button>
      </motion.div>

      {/* ── Save Success Toast ── */}
      {saved && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-2.5 p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#08A66A] text-sm font-semibold"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Profile updated successfully!
        </motion.div>
      )}

      {/* ── Profile Card ── */}
      <motion.div {...fadeUp(0.05)}>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
          {/* Cover */}
          <div
            className="h-28 relative"
            style={{
              background:
                "linear-gradient(135deg, #5B21F4 0%, #7C3AED 55%, #2563EB 100%)",
            }}
          >
            <div className="absolute -bottom-10 left-5">
              <div className="relative">
                {/* Avatar: Real image or Fallback */}
                <div
                  className="w-20 h-20 rounded-2xl border-4 border-white shadow-lg overflow-hidden flex items-center justify-center text-white text-xl font-extrabold bg-[#5B21F4]"
                  style={{
                    background: "linear-gradient(135deg, #5B21F4, #2563EB)",
                  }}
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt={user?.name || "Profile"}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // If image fails to load, fallback to initials
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>

                {/* Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  title="Upload profile photo"
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#5B21F4] border-2 border-white flex items-center justify-center cursor-pointer hover:bg-[#4C1BD4] transition-colors shadow-sm"
                >
                  {isUploadingImage ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5 text-white" />
                  )}
                </button>

                {/* Remove Photo Button if image exists */}
                {user?.user_image && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={isUploadingImage}
                    title="Remove profile photo"
                    className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-[#EF4444] border-2 border-white flex items-center justify-center cursor-pointer hover:bg-[#DC2626] transition-colors shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleImageFileChange}
                />
              </div>
            </div>
          </div>

          <div className="pt-14 px-5 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-[#111827]">
                    {user?.name || "Student User"}
                  </h3>
                
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">{user?.email}</p>
                {user?.mobile && (
                  <p className="text-xs text-[#64748B]">{user.mobile}</p>
                )}
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#ECFDF5] text-[#08A66A] border border-[#A7F3D0]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active Account
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified
                </span>
                {(user?.last_login_at || user?.last_login_ip) && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0]">
                    <Clock className="w-3.5 h-3.5 text-[#64748B]" />
                    <span>Last Login: {formatIstDateTime(user?.last_login_at)}</span>
                    {user?.last_login_ip && (
                      <span className="text-[#94A3B8]">({user.last_login_ip})</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Personal Information ── */}
      <motion.div {...fadeUp(0.1)}>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F1F5F9]">
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
              <UserCircle2 className="w-4 h-4 text-[#5B21F4]" />
              Personal Information
            </h3>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Full Name", field: "fullName", icon: UserCircle2, type: "text" },
              { label: "Date of Birth", field: "dob", icon: Calendar, type: "date" },
              {
                label: "Gender",
                field: "gender",
                icon: UserCircle2,
                type: "select",
                options: ["Male", "Female", "Other"],
              },
              { label: "Qualification", field: "qualification", icon: BookOpen, type: "text" },
            ].map((item) => (
              <div key={item.field} className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide flex items-center gap-1.5">
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </label>
                {editing ? (
                  item.type === "select" ? (
                    <select
                      value={form[item.field as keyof typeof form]}
                      onChange={(e) => handleChange(item.field, e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#111827] focus:outline-none focus:border-[#5B21F4] focus:ring-2 focus:ring-[#5B21F4]/10 transition-all"
                    >
                      {item.options?.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={item.type}
                      value={form[item.field as keyof typeof form]}
                      onChange={(e) => handleChange(item.field, e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#111827] focus:outline-none focus:border-[#5B21F4] focus:ring-2 focus:ring-[#5B21F4]/10 transition-all"
                    />
                  )
                ) : (
                  <p className="text-sm font-semibold text-[#111827] py-2 px-3 bg-[#F8FAFC] rounded-xl border border-[#F1F5F9]">
                    {form[item.field as keyof typeof form]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Contact & Course Info ── */}
      <motion.div {...fadeUp(0.15)}>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F1F5F9]">
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#5B21F4]" />
              Contact &amp; Account Details
            </h3>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Email Address", field: "email", icon: Mail, type: "email", readOnly: true },
              { label: "Mobile Number", field: "mobile", icon: Phone, type: "tel" },
              {
                label: "Interested Course",
                field: "interestedCourse",
                icon: BookOpen,
                type: "select",
                options: [
                  "Advanced Diploma in Computer Applications",
                  "Diploma in Web Development",
                  "MERN Stack Development",
                  "Java Full Stack Development",
                  "Cyber Security Fundamentals",
                ],
              },
              { label: "Address", field: "address", icon: MapPin, type: "text" },
            ].map((item) => (
              <div
                key={item.field}
                className={`space-y-1.5 ${item.field === "address" ? "sm:col-span-2" : ""}`}
              >
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide flex items-center gap-1.5">
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </label>
                {editing && !item.readOnly ? (
                  item.type === "select" ? (
                    <select
                      value={form[item.field as keyof typeof form]}
                      onChange={(e) => handleChange(item.field, e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#111827] focus:outline-none focus:border-[#5B21F4] focus:ring-2 focus:ring-[#5B21F4]/10 transition-all"
                    >
                      {item.options?.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={item.type}
                      value={form[item.field as keyof typeof form]}
                      onChange={(e) => handleChange(item.field, e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#111827] focus:outline-none focus:border-[#5B21F4] focus:ring-2 focus:ring-[#5B21F4]/10 transition-all"
                    />
                  )
                ) : (
                  <p className="text-sm font-semibold text-[#111827] py-2 px-3 bg-[#F8FAFC] rounded-xl border border-[#F1F5F9]">
                    {form[item.field as keyof typeof form]}
                  </p>
                )}
              </div>
            ))}
          </div>

          {editing && (
            <div className="px-5 pb-5">
              <button
                onClick={handleSave}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#5B21F4] to-[#2563EB] text-white text-sm font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
              >
                Save Profile Changes →
              </button>
            </div>
          )}
        </div>
      </motion.div>

      <div className="h-4" />
    </div>
  );
}
