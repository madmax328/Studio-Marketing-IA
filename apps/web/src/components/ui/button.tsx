import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";

export const buttonStyles = (variant: Variant = "primary", extra?: string) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variant === "primary" && "bg-primary text-primary-foreground hover:opacity-90",
    variant === "secondary" && "border border-border bg-surface hover:bg-background",
    variant === "danger" && "bg-danger text-white hover:opacity-90",
    variant === "ghost" && "hover:bg-background",
    extra,
  );

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={buttonStyles(variant, className)} {...props} />;
}
