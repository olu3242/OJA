import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Inline message block. `error` carries role="alert" for screen readers;
 * `success`/`info` are neutral notices. Replaces the ad-hoc red/green boxes.
 */
export type AlertVariant = "error" | "success" | "info";

const variants: Record<AlertVariant, string> = {
  error: "border-red-300 bg-red-50 font-semibold text-red-800",
  success: "border-oja-green/30 bg-white font-semibold text-oja-green",
  info: "border-oja-green/20 bg-white font-normal text-oja-green-deep/70",
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

export function Alert({ variant = "info", className, ...props }: AlertProps) {
  return (
    <div
      role={variant === "error" ? "alert" : undefined}
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
