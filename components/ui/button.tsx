import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * The one button in the Oja design system. Three variants (primary = orange
 * fill, success = green fill, secondary = green outline) and three sizes.
 * `buttonClasses` is exported so `<Link>`s and other elements can adopt the
 * exact same look without duplicating Tailwind strings.
 */
export type ButtonVariant = "primary" | "success" | "secondary";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors focus-visible:ring-2 focus-visible:ring-oja-orange/50 focus-visible:ring-offset-2 focus-visible:ring-offset-oja-cream focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-oja-orange text-white hover:bg-oja-orange/90",
  success: "bg-oja-green text-white hover:bg-oja-green-deep",
  secondary:
    "border-2 border-oja-green bg-transparent text-oja-green hover:bg-oja-green/5",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-4 py-1.5 text-sm",
  md: "px-6 py-3",
  lg: "px-8 py-4 text-lg",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}
