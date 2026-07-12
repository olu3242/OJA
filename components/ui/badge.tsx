import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Status pill. `success`/`warning`/`neutral` cover subscription + order states;
 * `eyebrow` is the uppercase tracking label used for hero/section kickers.
 */
export type BadgeVariant = "success" | "warning" | "neutral" | "eyebrow";

const variants: Record<BadgeVariant, string> = {
  success: "bg-oja-green text-white",
  warning: "bg-oja-orange-soft text-oja-green-deep",
  neutral: "bg-gray-200 text-gray-600",
  eyebrow: "bg-oja-orange-soft text-oja-green-deep uppercase tracking-widest",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({
  variant = "neutral",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-3 py-1 text-xs font-bold",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
