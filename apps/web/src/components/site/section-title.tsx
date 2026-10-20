import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Titre de section façon panneau d'aéroport : code en chasse fixe, titre condensé. */
export function SectionTitle({
  code,
  title,
  children,
  tone = "light",
  className,
}: {
  code: string;
  title: ReactNode;
  children?: ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl space-y-4", className)}>
      <p className={cn("inline-flex items-center gap-2 font-board text-xs tracking-[0.22em] uppercase", tone === "dark" ? "text-signal" : "text-ink-soft")}>
        <span className={cn("inline-block h-2 w-6", tone === "dark" ? "bg-signal" : "bg-ink")} aria-hidden="true" />
        {code}
      </p>
      <h2 className={cn("font-display text-5xl leading-[0.92] font-black uppercase sm:text-6xl", tone === "dark" ? "text-paper" : "text-ink")}>
        {title}
      </h2>
      {children ? <div className={cn("text-lg", tone === "dark" ? "text-paper/70" : "text-ink-soft")}>{children}</div> : null}
    </div>
  );
}
