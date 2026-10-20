import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Titre de section éditorial : numéro de chapitre, grand titre à empattements, chapeau. */
export function SectionHeading({
  number,
  kicker,
  title,
  children,
  className,
  tone = "dark",
}: {
  number?: string;
  kicker: string;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <div className={cn("max-w-3xl", className)}>
      <p className={cn("flex items-center gap-3 text-sm font-semibold", tone === "light" ? "text-cream/70" : "text-ink-soft")}>
        {number ? <span className="font-serif text-lg italic">{number}</span> : null}
        <span className={cn("h-px w-8", tone === "light" ? "bg-cream/40" : "bg-ink/40")} aria-hidden="true" />
        {kicker}
      </p>
      <h2 className={cn("mt-3 font-serif text-5xl leading-[0.95] tracking-tight sm:text-6xl", tone === "light" ? "text-cream" : "text-ink")}>{title}</h2>
      {children ? <div className={cn("mt-4 text-lg", tone === "light" ? "text-cream/75" : "text-ink-soft")}>{children}</div> : null}
    </div>
  );
}
