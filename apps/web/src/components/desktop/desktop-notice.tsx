"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/card";
import { isDesktopApp } from "@/lib/desktop";

/** Message affiché seulement dans l'application de bureau. */
export function DesktopNotice({ children }: { children: ReactNode }) {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => setDesktop(isDesktopApp()), []);
  return desktop ? <Alert>{children}</Alert> : null;
}

/** Suggestion affichée seulement dans un navigateur (pas dans l'application de bureau). */
export function BrowserOnly({ children }: { children: ReactNode }) {
  const [browser, setBrowser] = useState(false);
  useEffect(() => setBrowser(!isDesktopApp()), []);
  return browser ? <>{children}</> : null;
}
