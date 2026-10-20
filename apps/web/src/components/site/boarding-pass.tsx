import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Carte d'embarquement : corps à gauche, talon détachable à droite (dessous sur mobile). */
export function BoardingPass({
  children,
  stub,
  className,
  highlighted = false,
}: {
  children: ReactNode;
  stub: ReactNode;
  className?: string;
  highlighted?: boolean;
}) {
  return (
    <article className={cn("pass flex flex-col overflow-visible md:flex-row", highlighted && "ring-2 ring-signal", className)}>
      <div className="flex-1 p-6 sm:p-7">{children}</div>
      <div className="pass-perforation flex flex-col justify-between gap-4 p-6 sm:p-7 md:w-48">{stub}</div>
    </article>
  );
}

/** Petite étiquette façon champ de billet : « PORTE », « VOL »… */
export function PassField({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="font-board text-[10px] tracking-[0.2em] text-ink-soft uppercase">{label}</p>
      <p className="font-display text-2xl leading-tight font-extrabold uppercase">{value}</p>
    </div>
  );
}
