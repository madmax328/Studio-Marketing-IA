import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <p className="text-center text-lg font-semibold">Studio Marketing IA</p>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
