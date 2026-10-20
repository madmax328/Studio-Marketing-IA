import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** En-tête de section : étiquette discrète, titre net, chapeau. */
export function SectionHeading({
  eyebrow,
  title,
  children,
  align = "left",
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <p className="font-mono text-xs tracking-[0.14em] text-solar uppercase">{eyebrow}</p>
      <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">{title}</h2>
      {children ? <div className="mt-5 text-lg leading-relaxed text-pretty text-fg-muted">{children}</div> : null}
    </div>
  );
}
