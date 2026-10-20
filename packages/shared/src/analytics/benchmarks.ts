import { SOCIAL_NETWORKS, type SocialNetworkId } from "../social/networks";
import { toZoned, weekdayOf } from "../time/zoned";
import { TIME_SLOTS, timeSlotOf } from "./metrics";

/**
 * Repères anonymes entre les comptes du studio. Chaque publication est comparée à la médiane de SON compte sur
 * ce réseau (un petit compte et un grand compte pèsent pareil), puis les écarts sont moyennés par compte.
 * Un repère n'existe qu'à partir de 5 comptes différents et 30 publications : aucun compte n'est identifiable.
 */
export const BENCHMARK_MIN_WORKSPACES = 5;
export const BENCHMARK_MIN_POSTS = 30;
/** Écart minimal avec l'habitude des comptes pour en faire un conseil. */
export const BENCHMARK_MIN_LIFT = 1.2;
/** Publications mesurées d'un compte sur un réseau, nécessaires pour connaître son « habitude ». */
const MIN_POSTS_FOR_BASELINE = 3;

export type BenchmarkDimension = "slot" | "day" | "format";

export interface BenchmarkPost {
  /** Identifiant opaque du compte (jamais conservé dans les repères). */
  workspaceId: string;
  network: SocialNetworkId;
  publishedAt: Date;
  timeZone: string;
  format: "text" | "image" | "video";
  engagement: number;
}

export interface BenchmarkGroup {
  network: SocialNetworkId;
  dimension: BenchmarkDimension;
  value: string;
  /** Nombre de comptes et de publications derrière le repère. */
  workspaces: number;
  posts: number;
  /** Interactions par rapport à l'habitude du même compte (1 = comme d'habitude). */
  lift: number;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

function dimensionValues(post: BenchmarkPost): [BenchmarkDimension, string][] {
  const values: [BenchmarkDimension, string][] = [["format", post.format]];
  const slot = timeSlotOf(post.publishedAt, post.timeZone);
  if (slot) values.push(["slot", slot.id]);
  values.push(["day", String(weekdayOf(toZoned(post.publishedAt, post.timeZone).date))]);
  return values;
}

/** Calcule les repères agrégés (seuls ces agrégats sont conservés). */
export function computeBenchmarks(posts: BenchmarkPost[]): BenchmarkGroup[] {
  // Habitude de chaque compte sur chaque réseau.
  const baselines = new Map<string, number>();
  const byAccount = new Map<string, number[]>();
  for (const post of posts) {
    const key = `${post.workspaceId}|${post.network}`;
    byAccount.set(key, [...(byAccount.get(key) ?? []), post.engagement]);
  }
  for (const [key, values] of byAccount) {
    const base = median(values);
    if (values.length >= MIN_POSTS_FOR_BASELINE && base > 0) baselines.set(key, base);
  }

  // Écarts par groupe, d'abord moyennés par compte.
  const groups = new Map<string, { network: SocialNetworkId; dimension: BenchmarkDimension; value: string; byWorkspace: Map<string, number[]> }>();
  for (const post of posts) {
    const base = baselines.get(`${post.workspaceId}|${post.network}`);
    if (!base) continue;
    for (const [dimension, value] of dimensionValues(post)) {
      const key = `${post.network}|${dimension}|${value}`;
      const group = groups.get(key) ?? { network: post.network, dimension, value, byWorkspace: new Map() };
      group.byWorkspace.set(post.workspaceId, [...(group.byWorkspace.get(post.workspaceId) ?? []), post.engagement / base]);
      groups.set(key, group);
    }
  }

  const result: BenchmarkGroup[] = [];
  for (const group of groups.values()) {
    const perWorkspace = [...group.byWorkspace.values()];
    const postCount = perWorkspace.reduce((sum, values) => sum + values.length, 0);
    if (perWorkspace.length < BENCHMARK_MIN_WORKSPACES || postCount < BENCHMARK_MIN_POSTS) continue;
    result.push({
      network: group.network,
      dimension: group.dimension,
      value: group.value,
      workspaces: perWorkspace.length,
      posts: postCount,
      lift: Math.round(mean(perWorkspace.map(mean)) * 100) / 100,
    });
  }
  return result.sort((a, b) => a.network.localeCompare(b.network) || a.dimension.localeCompare(b.dimension) || b.lift - a.lift);
}

const DAY_LABELS = ["le lundi", "le mardi", "le mercredi", "le jeudi", "le vendredi", "le samedi", "le dimanche"];
const FORMAT_LABELS: Record<BenchmarkPost["format"], string> = { text: "les textes seuls", image: "les publications avec image", video: "les vidéos" };

export interface BenchmarkTip {
  id: string;
  title: string;
  detail: string;
}

const lift = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/**
 * Conseils tirés des repères : pour chaque réseau et chaque dimension, le meilleur groupe s'il dépasse nettement
 * l'habitude et qu'au moins un autre groupe comparable existe.
 */
export function benchmarkTips(groups: BenchmarkGroup[], networks?: readonly SocialNetworkId[]): BenchmarkTip[] {
  const tips: BenchmarkTip[] = [];
  const keys = new Set(groups.map((group) => `${group.network}|${group.dimension}`));
  for (const key of keys) {
    const [network, dimension] = key.split("|") as [SocialNetworkId, BenchmarkDimension];
    if (networks && !networks.includes(network)) continue;
    const candidates = groups.filter((group) => group.network === network && group.dimension === dimension).sort((a, b) => b.lift - a.lift);
    const best = candidates[0];
    if (!best || candidates.length < 2 || best.lift < BENCHMARK_MIN_LIFT) continue;
    const label = SOCIAL_NETWORKS[network].label;
    const subject =
      dimension === "slot"
        ? `les publications ${TIME_SLOTS.find((slot) => slot.id === best.value)?.label ?? ""}`
        : dimension === "day"
          ? `les publications ${DAY_LABELS[Number(best.value) - 1] ?? ""}`
          : FORMAT_LABELS[best.value as BenchmarkPost["format"]];
    tips.push({
      id: `${network}-${dimension}`,
      title: `${label} : ${subject}`,
      detail: `Sur ${label}, ${subject} obtiennent en moyenne ${lift(best.lift)} fois les interactions habituelles du même compte (repère anonyme : ${best.workspaces} comptes, ${best.posts} publications).`,
    });
  }
  return tips;
}
