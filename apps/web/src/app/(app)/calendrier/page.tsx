import type { Metadata } from "next";
import Link from "next/link";
import {
  addDays,
  DATE_PATTERN,
  monthGrid,
  POST_STATUS_LABELS,
  POST_STATUSES,
  SOCIAL_NETWORK_IDS,
  SOCIAL_NETWORKS,
  startOfWeek,
  toZoned,
  zonedToUtc,
  type PostStatus,
} from "@smia/shared";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { PostDoc } from "@/server/db/collections";
import { getDb } from "@/server/db/client";
import { listBrands } from "@/server/services/brands";
import { listCampaigns } from "@/server/services/campaigns";
import { listCalendarPosts, postStatusLabel, type CalendarFilters } from "@/server/services/posts";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Calendrier" };

type View = "mois" | "semaine" | "liste";
const VIEWS: { id: View; label: string }[] = [
  { id: "mois", label: "Mois" },
  { id: "semaine", label: "Semaine" },
  { id: "liste", label: "Liste" },
];
const WEEKDAY_HEADERS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const LIST_DAYS = 60;

const STATUS_STYLES: Record<PostStatus, string> = {
  draft: "border-border bg-background text-muted",
  scheduled: "border-primary/40 bg-primary/10",
  processing: "border-primary/40 bg-primary/10",
  published: "border-success/40 bg-success/10",
  failed: "border-danger/40 bg-danger/10 text-danger",
  cancelled: "border-border text-muted line-through",
};

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function midnight(date: string, timeZone: string): Date {
  // Minuit existe partout sauf rares fuseaux ; on se rabat sur 01:00 dans ce cas.
  const result = zonedToUtc(date, "00:00", timeZone);
  if (result.ok) return result.instant;
  const fallback = zonedToUtc(date, "01:00", timeZone);
  return fallback.ok ? fallback.instant : new Date(`${date}T00:00:00Z`);
}

function frDay(date: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { ...options, timeZone: "UTC" });
}

function PostChip({ post, timeZone }: { post: PostDoc; timeZone: string }) {
  const local = post.scheduledAt ? toZoned(post.scheduledAt, timeZone) : null;
  return (
    <Link
      href={`/publications/${post._id.toHexString()}`}
      className={cn("block truncate rounded border px-1.5 py-0.5 text-xs hover:border-primary", STATUS_STYLES[post.status], post.publishing?.simulated && "border-dashed")}
      title={`${SOCIAL_NETWORKS[post.network].label} · ${postStatusLabel(post, POST_STATUS_LABELS)} · ${post.text.slice(0, 120)}`}
    >
      {local?.time} {SOCIAL_NETWORKS[post.network].label}
    </Link>
  );
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendrier">) {
  const query = await searchParams;
  const access = await requireWorkspace();
  const db = getDb();
  const [brands, campaigns] = await Promise.all([listBrands(db, access), listCampaigns(db, access)]);

  const filters: CalendarFilters = {
    brandId: str(query.marque),
    network: str(query.reseau),
    campaignId: str(query.campagne),
    status: str(query.statut),
  };
  const selectedBrand = brands.find((b) => b._id.toHexString() === filters.brandId);
  const timeZone = selectedBrand?.timeZone ?? brands[0]?.timeZone ?? "Europe/Paris";
  const today = toZoned(new Date(), timeZone).date;

  const view: View = query.vue === "semaine" || query.vue === "liste" ? query.vue : "mois";
  const rawDate = str(query.date);
  const anchor = rawDate && DATE_PATTERN.test(rawDate) ? rawDate : today;

  let days: string[];
  let weeks: string[][] = [];
  let previous: string;
  let next: string;
  let title: string;
  if (view === "mois") {
    const month = anchor.slice(0, 7);
    weeks = monthGrid(month);
    days = weeks.flat();
    previous = addDays(`${month}-01`, -1).slice(0, 7) + "-01";
    // Le 28 + 7 jours tombe toujours dans le mois suivant.
    next = `${addDays(`${month}-28`, 7).slice(0, 7)}-01`;
    title = frDay(`${month}-15`, { month: "long", year: "numeric" });
  } else if (view === "semaine") {
    const start = startOfWeek(anchor);
    days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    previous = addDays(start, -7);
    next = addDays(start, 7);
    title = `Semaine du ${frDay(start, { day: "numeric", month: "long", year: "numeric" })}`;
  } else {
    days = Array.from({ length: LIST_DAYS }, (_, i) => addDays(anchor, i));
    previous = addDays(anchor, -LIST_DAYS);
    next = addDays(anchor, LIST_DAYS);
    title = `Du ${frDay(anchor, { day: "numeric", month: "long" })} au ${frDay(days.at(-1) ?? anchor, { day: "numeric", month: "long", year: "numeric" })}`;
  }

  const from = midnight(days[0] ?? anchor, timeZone);
  const to = midnight(addDays(days.at(-1) ?? anchor, 1), timeZone);
  const posts = await listCalendarPosts(db, access, from, to, filters);
  const byDay = new Map<string, PostDoc[]>();
  for (const post of posts) {
    if (!post.scheduledAt) continue;
    const day = toZoned(post.scheduledAt, timeZone).date;
    byDay.set(day, [...(byDay.get(day) ?? []), post]);
  }

  const link = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = {
      vue: view,
      date: anchor,
      marque: filters.brandId,
      reseau: filters.network,
      campagne: filters.campaignId,
      statut: filters.status,
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    return `/calendrier?${params.toString()}`;
  };

  const selectClass = "rounded-lg border border-border bg-surface px-2 py-1.5 text-sm";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Calendrier</h1>
          <p className="text-xs text-muted">Heures affichées dans le fuseau {timeZone}.</p>
        </div>
        <Link href="/campagnes/nouvelle" className={buttonStyles("primary")}>
          Créer une campagne
        </Link>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="vue" value={view} />
        <input type="hidden" name="date" value={anchor} />
        <label className="text-xs">
          <span className="block text-muted">Marque</span>
          <select name="marque" defaultValue={filters.brandId ?? ""} className={selectClass}>
            <option value="">Toutes</option>
            {brands.map((b) => (
              <option key={b._id.toHexString()} value={b._id.toHexString()}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-muted">Réseau</span>
          <select name="reseau" defaultValue={filters.network ?? ""} className={selectClass}>
            <option value="">Tous</option>
            {SOCIAL_NETWORK_IDS.map((id) => (
              <option key={id} value={id}>
                {SOCIAL_NETWORKS[id].label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-muted">Campagne</span>
          <select name="campagne" defaultValue={filters.campaignId ?? ""} className={selectClass}>
            <option value="">Toutes</option>
            {campaigns.map((c) => (
              <option key={c._id.toHexString()} value={c._id.toHexString()}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-muted">Statut</span>
          <select name="statut" defaultValue={filters.status ?? ""} className={selectClass}>
            <option value="">Tous</option>
            {POST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {POST_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonStyles("secondary")}>
          Filtrer
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Vue" className="flex gap-1">
          {VIEWS.map((v) => (
            <Link
              key={v.id}
              href={link({ vue: v.id })}
              aria-current={v.id === view ? "page" : undefined}
              className={cn("rounded-full border px-3 py-1 text-sm", v.id === view ? "border-primary bg-primary text-primary-foreground" : "border-border")}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <Link href={link({ date: previous })} className="text-primary hover:underline" aria-label="Période précédente">
            ←
          </Link>
          <span className="font-medium capitalize">{title}</span>
          <Link href={link({ date: next })} className="text-primary hover:underline" aria-label="Période suivante">
            →
          </Link>
          <Link href={link({ date: today })} className="text-primary hover:underline">
            Aujourd&apos;hui
          </Link>
        </div>
      </div>

      {view === "liste" ? (
        posts.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">Aucune publication datée sur cette période.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {days
              .filter((day) => byDay.has(day))
              .map((day) => (
                <li key={day}>
                  <Card className="space-y-2">
                    <p className="text-sm font-medium capitalize">{frDay(day, { weekday: "long", day: "numeric", month: "long" })}</p>
                    <ul className="space-y-1">
                      {(byDay.get(day) ?? []).map((post) => (
                        <li key={post._id.toHexString()}>
                          <Link href={`/publications/${post._id.toHexString()}`} className={cn("block rounded border p-2 text-sm hover:border-primary", STATUS_STYLES[post.status])}>
                            <span className="font-medium">
                              {post.scheduledAt ? toZoned(post.scheduledAt, timeZone).time : ""} · {SOCIAL_NETWORKS[post.network].label}
                            </span>
                            <span className="text-muted"> · {postStatusLabel(post, POST_STATUS_LABELS)}</span>
                            <span className="mt-1 block truncate text-muted">{post.text}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </li>
              ))}
          </ul>
        )
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[44rem] grid-cols-7 gap-px rounded-xl border border-border bg-border">
            {WEEKDAY_HEADERS.map((label) => (
              <div key={label} className="bg-surface px-2 py-1 text-center text-xs font-medium text-muted">
                {label}
              </div>
            ))}
            {(view === "mois" ? weeks.flat() : days).map((day) => {
              const outside = view === "mois" && day.slice(0, 7) !== anchor.slice(0, 7);
              return (
                <div key={day} className={cn("space-y-1 bg-surface p-1.5", view === "mois" ? "min-h-24" : "min-h-64", outside && "opacity-50")}>
                  <p className={cn("text-xs", day === today ? "font-bold text-primary" : "text-muted")}>{Number(day.slice(8))}</p>
                  {(byDay.get(day) ?? []).map((post) => (
                    <PostChip key={post._id.toHexString()} post={post} timeZone={timeZone} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted">
        Pour déplacer une publication, ouvrez-la et changez sa date. Les brouillons datés apparaissent en gris : ils ne
        partiront pas tant qu&apos;ils ne sont pas programmés.
      </p>
    </div>
  );
}
