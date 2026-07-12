import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Surface primitive — the white bordered panel used across every screen. */
export type CardPadding = "sm" | "md" | "lg";

const paddings: Record<CardPadding, string> = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

/** Card look as a class string — for non-div elements (e.g. a `<form>` card). */
export function cardClasses(
  padding: CardPadding = "lg",
  className?: string,
): string {
  return cn(
    "rounded-xl border border-oja-green/20 bg-white",
    paddings[padding],
    className,
  );
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
}

export function Card({ padding = "lg", className, ...props }: CardProps) {
  return <div className={cardClasses(padding, className)} {...props} />;
}
