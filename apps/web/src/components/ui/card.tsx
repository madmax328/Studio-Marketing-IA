import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-xl border border-border bg-surface p-5", className)}>{children}</section>;
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        tone === "error" && "border-danger/40 text-danger",
        tone === "success" && "border-success/40 text-success",
        tone === "info" && "border-border text-muted",
      )}
    >
      {children}
    </div>
  );
}
