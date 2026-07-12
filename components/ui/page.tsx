import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Standard page container — centers content, caps width, applies the shared
 * horizontal/vertical page rhythm. `centered` vertically centers the content
 * (auth/marketing screens); otherwise it's a normal top-aligned page.
 */
export type PageWidth =
  "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";

const widths: Record<PageWidth, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
};

export interface PageMainProps extends HTMLAttributes<HTMLElement> {
  width?: PageWidth;
  centered?: boolean;
}

export function PageMain({
  width = "2xl",
  centered = false,
  className,
  ...props
}: PageMainProps) {
  return (
    <main
      className={cn(
        "mx-auto w-full flex-1 px-6",
        widths[width],
        centered ? "flex flex-col justify-center gap-6 py-16" : "py-12",
        className,
      )}
      {...props}
    />
  );
}
