import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "link" | "success" | "purple";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B21F4] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
          // Variant
          variant === "default" &&
            "bg-[#5B21F4] text-white hover:bg-[#4C1BD4] shadow-sm active:scale-[0.99]",
          variant === "success" &&
            "bg-[#08A66A] text-white hover:bg-[#078957] shadow-sm active:scale-[0.99]",
          variant === "purple" &&
            "bg-gradient-to-r from-[#5B21F4] via-[#7C3AED] to-[#2563EB] text-white hover:opacity-95 shadow-md active:scale-[0.99]",
          variant === "outline" &&
            "border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#111827]",
          variant === "ghost" &&
            "hover:bg-[#F1EEFF] text-[#5B21F4]",
          variant === "link" &&
            "text-[#2563EB] underline-offset-4 hover:underline p-0 h-auto",
          // Size
          size === "default" && "h-11 px-4 py-2 text-sm",
          size === "sm" && "h-8.5 rounded-lg px-2.5 sm:px-3 text-xs",
          size === "lg" && "h-[50px] rounded-xl px-6 text-sm font-semibold",
          size === "icon" && "h-9 w-9 p-0",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
