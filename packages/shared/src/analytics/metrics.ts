import { SOCIAL_NETWORKS, type SocialNetworkId } from "../social/networks";
import { toZoned, weekdayOf } from "../time/zoned";

/**
 * Indicateurs d'une publication, tels que les réseaux les fournissent.
 * Un indicateur absent (undefined) n'est pas fourni par le réseau : il n'est jamais remplacé par une estimation.
 */
export const METRIC_KEYS = ["views", "reach", "likes", "comments", "shares", "saves", "clicks"] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
export type PostMetrics = Partial<Record<MetricKey, number>>;

export const METRIC_LABELS: Record<MetricKey, string> = {
  views: "Vues",
  reach: "Personnes touchées",
  likes: "J'aime",
  comments: "Commentaires",
  shares: "Partages",
  saves: "Enregistrements",
  clicks: "Clics",
};

/** Indicateurs comptés comme des interactions (réactions actives du public). */
export const ENGAGEMENT_KEYS: readonly MetricKey[] = ["likes", "comments", "shares", "saves"];

/** Interactions d'une publication : somme des indicateurs d'interaction disponibles, ou null si aucun ne l'est. */
export function engagementOf(metrics: PostMetrics): number | null {
  const values = ENGAGEMENT_KEYS.map((key) => metrics[key]).filter((value): value is number => typeof value === "number");
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0);
}

/** Ne garde que des nombres entiers positifs ou nuls (les réponses des API ne sont pas toujours propres). */
export function cleanMetrics(raw: Partial<Record<MetricKey, unknown>>): PostMetrics {
  const result: PostMetrics = {};
  for (const key of METRIC_KEYS) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) result[key] = Math.round(value);
  }
  return result;
}

// ---------- Recommandations ----------

/** Publication mesurée, telle qu'utilisée pour les recommandations. */
export interface MeasuredPost {
  network: SocialNetworkId;
  publishedAt: Date;
  timeZone: string;
  hasMedia: boolean;
  engagement: number;
}

export interface Recommendation {
  id: string;
  title: string;
  detail: string;
  /** Nombre de publications sur lesquelles repose le conseil. */
  basedOn: number;
}

/** En dessous, aucun conseil : ce serait du hasard présenté comme une tendance. */
export const MIN_POSTS_FOR_RECOMMENDATIONS = 6;
const MIN_PER_GROUP = 3;
/** Écart minimal entre le meilleur groupe et les autres pour parler de tendance. */
const MIN_RATIO = 1.3;

export const TIME_SLOTS = [
  { id: "matin", label: "le matin (6 h – 11 h)", from: 6, to: 11 },
  { id: "midi", label: "le midi (11 h – 14 h)", from: 11, to: 14 },
  { id: "apres-midi", label: "l'après-midi (14 h – 18 h)", from: 14, to: 18 },
  { id: "soir", label: "le soir (18 h – 23 h)", from: 18, to: 23 },
] as const;

export function timeSlotOf(date: Date, timeZone: string): (typeof TIME_SLOTS)[number] | null {
  const hour = Number(toZoned(date, timeZone).time.slice(0, 2));
  return TIME_SLOTS.find((slot) => hour >= slot.from && hour < slot.to) ?? null;
}

const WEEKDAYS = ["le lundi", "le mardi", "le mercredi", "le jeudi", "le vendredi", "le samedi", "le dimanche"];

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const round = (value: number) => (value >= 10 ? Math.round(value) : Math.round(value * 10) / 10);

interface Group {
  key: string;
  label: string;
  posts: MeasuredPost[];
}

/** Meilleur groupe s'il dépasse nettement la moyenne des autres groupes suffisamment fournis. */
function standout(groups: Group[]): { best: Group; bestAvg: number; othersAvg: number; total: number } | null {
  const eligible = groups.filter((group) => group.posts.length >= MIN_PER_GROUP);
  if (eligible.length < 2) return null;
  const scored = eligible
    .map((group) => ({ group, avg: average(group.posts.map((post) => post.engagement)) }))
    .sort((a, b) => b.avg - a.avg);
  const [first, ...rest] = scored;
  if (!first) return null;
  const others = rest.flatMap((item) => item.group.posts.map((post) => post.engagement));
  const othersAvg = average(others);
  if (first.avg <= 0 || first.avg < othersAvg * MIN_RATIO) return null;
  return { best: first.group, bestAvg: first.avg, othersAvg, total: eligible.reduce((sum, group) => sum + group.posts.length, 0) };
}

function groupBy(posts: MeasuredPost[], keyOf: (post: MeasuredPost) => { key: string; label: string } | null): Group[] {
  const groups = new Map<string, Group>();
  for (const post of posts) {
    const key = keyOf(post);
    if (!key) continue;
    const group = groups.get(key.key) ?? { ...key, posts: [] };
    group.posts.push(post);
    groups.set(key.key, group);
  }
  return [...groups.values()];
}

/**
 * Conseils tirés uniquement des résultats réels de l'utilisateur. Chaque conseil exige assez de
 * publications par groupe et un écart net ; sinon il n'est pas donné.
 */
export function computeRecommendations(posts: MeasuredPost[]): Recommendation[] {
  if (posts.length < MIN_POSTS_FOR_RECOMMENDATIONS) return [];
  const recommendations: Recommendation[] = [];

  const byNetwork = standout(groupBy(posts, (post) => ({ key: post.network, label: SOCIAL_NETWORKS[post.network].label })));
  if (byNetwork) {
    recommendations.push({
      id: "network",
      title: `${byNetwork.best.label} vous réussit le mieux`,
      detail: `Vos publications y obtiennent en moyenne ${round(byNetwork.bestAvg)} interactions, contre ${round(byNetwork.othersAvg)} sur vos autres réseaux. Pensez à y publier en priorité.`,
      basedOn: byNetwork.total,
    });
  }

  const bySlot = standout(
    groupBy(posts, (post) => {
      const slot = timeSlotOf(post.publishedAt, post.timeZone);
      return slot ? { key: slot.id, label: slot.label } : null;
    }),
  );
  if (bySlot) {
    recommendations.push({
      id: "time",
      title: `Publiez plutôt ${bySlot.best.label}`,
      detail: `À ce moment-là, vos publications obtiennent en moyenne ${round(bySlot.bestAvg)} interactions, contre ${round(bySlot.othersAvg)} aux autres heures.`,
      basedOn: bySlot.total,
    });
  }

  const byDay = standout(
    groupBy(posts, (post) => {
      // weekdayOf : 1 = lundi … 7 = dimanche.
      const day = weekdayOf(toZoned(post.publishedAt, post.timeZone).date);
      return { key: String(day), label: WEEKDAYS[day - 1] ?? "" };
    }),
  );
  if (byDay) {
    recommendations.push({
      id: "day",
      title: `${byDay.best.label.charAt(0).toUpperCase()}${byDay.best.label.slice(1)} fonctionne bien`,
      detail: `Vos publications de ce jour obtiennent en moyenne ${round(byDay.bestAvg)} interactions, contre ${round(byDay.othersAvg)} les autres jours.`,
      basedOn: byDay.total,
    });
  }

  // Images ou texte seul : comparé seulement sur les réseaux qui acceptent les deux.
  const mixed = posts.filter((post) => SOCIAL_NETWORKS[post.network].allowsTextOnly);
  const byMedia = standout(groupBy(mixed, (post) => (post.hasMedia ? { key: "media", label: "avec image" } : { key: "text", label: "sans image" })));
  if (byMedia) {
    recommendations.push({
      id: "media",
      title: byMedia.best.key === "media" ? "Les images font la différence" : "Vos textes seuls marchent très bien",
      detail: `Vos publications ${byMedia.best.label} obtiennent en moyenne ${round(byMedia.bestAvg)} interactions, contre ${round(byMedia.othersAvg)} pour les autres.`,
      basedOn: byMedia.total,
    });
  }

  return recommendations;
}
