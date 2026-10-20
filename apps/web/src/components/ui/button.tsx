import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";

export const buttonStyles = (variant: Variant = "primary", extra?: string) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variant === "primary" && "bg-foreground text-background shadow-[0_6px_24px_-10px_rgb(255_122_69/0.7)] hover:bg-white",
    variant === "secondary" && "border border-border-strong bg-white/[0.02] text-foreground hover:bg-white/[0.06]",
    variant === "danger" && "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
    variant === "ghost" && "text-muted hover:bg-white/[0.05] hover:text-foreground",
    extra,
  );

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={buttonStyles(variant, className)} {...props} />;
}
