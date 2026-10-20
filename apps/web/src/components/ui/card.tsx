import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-gradient-to-b from-white/[0.035] to-white/[0.01] p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed",
        tone === "error" && "border-danger/30 bg-danger/[0.07] text-danger",
        tone === "success" && "border-success/30 bg-success/[0.07] text-success",
        tone === "info" && "border-border bg-white/[0.025] text-muted",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-[0.45rem] size-1.5 shrink-0 rounded-full",
          tone === "error" && "bg-danger",
          tone === "success" && "bg-success",
          tone === "info" && "bg-primary",
        )}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
