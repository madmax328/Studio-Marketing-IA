import type { ReactNode } from "react";

/** Icônes de navigation (traits fins, 20 px), dessinées à la main pour rester légères. */
const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const NAV_ICONS = {
  dashboard: svg(<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z" />),
  campaigns: svg(<path d="M4 19V5M4 5h11l-2 4 2 4H4" />),
  calendar: svg(<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />),
  studio: svg(<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" />),
  posts: svg(<path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3" />),
  media: svg(<path d="M4 5h16v14H4zM4 15l4.5-4.5 4 4L15 12l5 5M15.5 9a1 1 0 100-2 1 1 0 000 2z" />),
  brand: svg(<path d="M12 21s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.6-7 10-7 10z" />),
  networks: svg(<path d="M6 12a2.5 2.5 0 100-.01M18 6a2.5 2.5 0 100-.01M18 18a2.5 2.5 0 100-.01M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" />),
  billing: svg(<path d="M3 7h18v10H3zM3 11h18M7 15h3" />),
  settings: svg(<path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />),
  alerts: svg(<path d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15zM10 20a2 2 0 004 0" />),
  soon: svg(<path d="M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z" />),
};

export type NavIconName = keyof typeof NAV_ICONS;
