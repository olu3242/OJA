import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

/**
 * Form controls. One shared look (bordered, cream-white, orange focus ring)
 * so every input/select/textarea across the app is identical. `sm` is the
 * compact inline size used in the warehouse receiving grid.
 */
export type FieldSize = "sm" | "md";

const sizes: Record<FieldSize, string> = {
  sm: "rounded border px-2 py-1",
  md: "rounded-lg border px-4 py-3",
};

const fieldBase =
  "border-oja-green/30 bg-white text-oja-green-deep transition-colors focus:border-oja-orange focus:ring-2 focus:ring-oja-orange/30 focus:outline-none disabled:opacity-60";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  fieldSize?: FieldSize;
}
export function Input({ fieldSize = "md", className, ...props }: InputProps) {
  return (
    <input className={cn(fieldBase, sizes[fieldSize], className)} {...props} />
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  fieldSize?: FieldSize;
}
export function Select({ fieldSize = "md", className, ...props }: SelectProps) {
  return (
    <select className={cn(fieldBase, sizes[fieldSize], className)} {...props} />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  fieldSize?: FieldSize;
}
export function Textarea({
  fieldSize = "md",
  className,
  ...props
}: TextareaProps) {
  return (
    <textarea
      className={cn(fieldBase, sizes[fieldSize], className)}
      {...props}
    />
  );
}
