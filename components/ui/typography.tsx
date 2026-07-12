import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Page-level H1. `sm` for compact auth screens, `hero` for the marketing home. */
export type TitleSize = "sm" | "md" | "hero";

const titleSizes: Record<TitleSize, string> = {
  sm: "text-2xl",
  md: "text-3xl",
  hero: "text-5xl tracking-tight",
};

export interface PageTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  size?: TitleSize;
}
export function PageTitle({
  size = "md",
  className,
  ...props
}: PageTitleProps) {
  return (
    <h1
      className={cn(
        "font-extrabold text-oja-green-deep",
        titleSizes[size],
        className,
      )}
      {...props}
    />
  );
}

/** Section-level H2 used above every card group. */
export function SectionTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-xl font-bold text-oja-green-deep", className)}
      {...props}
    />
  );
}

/** Muted placeholder line for "nothing here yet" states. */
export function EmptyState({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-oja-green-deep/60", className)} {...props} />
  );
}
