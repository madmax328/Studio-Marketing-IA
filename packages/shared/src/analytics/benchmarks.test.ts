import { describe, expect, it } from "vitest";
import { benchmarkTips, computeBenchmarks, type BenchmarkPost } from "./benchmarks";

/** Publication du compte `ws` : le soir (19 h à Paris) ou le matin (8 h), un lundi de 2031. */
const post = (ws: string, evening: boolean, engagement: number, index: number): BenchmarkPost => ({
  workspaceId: ws,
  network: "instagram",
  publishedAt: new Date(Date.UTC(2031, 0, 6 + 7 * index, evening ? 18 : 7)),
  timeZone: "Europe/Paris",
  format: "image",
  engagement,
});

function accounts(count: number, scale = 1) {
  return Array.from({ length: count }, (_, a) =>
    // Petits et grands comptes : seule compte la comparaison avec l'habitude du même compte.
    [0, 1, 2, 3].flatMap((i) => [post(`ws${a}`, true, 20 * (a + 1) * scale, i), post(`ws${a}`, false, 10 * (a + 1) * scale, i)]),
  ).flat();
}

describe("repères anonymes", () => {
  it("compare chaque publication à l'habitude de son compte et pondère les comptes à égalité", () => {
    const groups = computeBenchmarks(accounts(8));
    const soir = groups.find((group) => group.dimension === "slot" && group.value === "soir");
    const matin = groups.find((group) => group.dimension === "slot" && group.value === "matin");
    expect(soir).toMatchObject({ workspaces: 8, posts: 32 });
    // Médiane du compte = 15 : soir 20/15, matin 10/15.
    expect(soir?.lift).toBeCloseTo(1.33, 2);
    expect(matin?.lift).toBeCloseTo(0.67, 2);
    // 6 comptes × 4 publications du soir = 24 : sous le seuil de 30, pas de repère.
    expect(computeBenchmarks(accounts(6)).find((group) => group.value === "soir")).toBeUndefined();
  });

  it("aucun repère sous 5 comptes ou 30 publications", () => {
    expect(computeBenchmarks(accounts(4))).toEqual([]);
    const tips = benchmarkTips(computeBenchmarks(accounts(8)));
    expect(tips).toHaveLength(1);
    expect(tips[0]?.detail).toContain("8 comptes");
    expect(tips[0]?.title).toContain("le soir");
  });

  it("pas de conseil sans écart net, ni pour un réseau non demandé", () => {
    const flat = Array.from({ length: 8 }, (_, a) => [0, 1, 2, 3].flatMap((i) => [post(`w${a}`, true, 10, i), post(`w${a}`, false, 10, i)])).flat();
    expect(benchmarkTips(computeBenchmarks(flat))).toEqual([]);
    expect(benchmarkTips(computeBenchmarks(accounts(8)), ["facebook"])).toEqual([]);
  });
});
