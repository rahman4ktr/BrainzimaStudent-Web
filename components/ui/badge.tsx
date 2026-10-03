import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "blue" | "outline" | "secondary";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variant === "default" && "bg-[#F1EEFF] text-[#5B21F4] border border-[#DDD6FE]",
        variant === "success" && "bg-[#ECFDF5] text-[#08A66A] border border-[#A7F3D0]",
        variant === "blue" && "bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]",
        variant === "outline" && "border border-[#E2E8F0] text-[#475569] bg-white",
        variant === "secondary" && "bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0]",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
