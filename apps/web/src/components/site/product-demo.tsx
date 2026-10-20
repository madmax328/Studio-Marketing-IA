"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Network = "Instagram" | "LinkedIn" | "Facebook";

interface Scenario {
  brand: string;
  kind: string;
  brief: string;
  visual: { title: string; from: string; to: string };
  posts: Record<Network, string>;
  slots: { day: string; time: string; network: Network }[];
}

/** Scénarios de démonstration rédigés à la main ; l'interface les signale comme une démonstration. */
const SCENARIOS: Scenario[] = [
  {
    brand: "Studio Ananda",
    kind: "Studio de yoga",
    brief: "Présenter le nouveau cours du jeudi soir, ouvert aux débutants",
    visual: { title: "Nouveau cours du jeudi", from: "#ffc56b", to: "#ff7a45" },
    posts: {
      Instagram: "Le jeudi soir a désormais son cours ! Un moment pour relâcher la semaine, sans prérequis. Débutants bienvenus.",
      LinkedIn: "Et si la pause de fin de semaine devenait un rendez-vous ? Notre nouveau cours du jeudi est pensé pour celles et ceux qui débutent.",
      Facebook: "Grande nouvelle : un cours le jeudi soir, accessible à tous les niveaux. Venez essayer, on vous attend sur le tapis.",
    },
    slots: [
      { day: "Lun", time: "08:30", network: "LinkedIn" },
      { day: "Mar", time: "18:00", network: "Instagram" },
      { day: "Jeu", time: "12:15", network: "Facebook" },
    ],
  },
  {
    brand: "Les Amis du Faubourg",
    kind: "Association de quartier",
    brief: "Annoncer le vide-grenier et chercher des bénévoles pour l'installation",
    visual: { title: "Vide-grenier du quartier", from: "#7cc8ff", to: "#7c5cff" },
    posts: {
      Instagram: "Le vide-grenier revient ! Tables, voisins et bonnes affaires. On cherche aussi des bras pour l'installation : qui est partant ?",
      LinkedIn: "Notre association recherche des bénévoles pour l'installation du vide-grenier. Une matinée suffit pour faire vivre le quartier.",
      Facebook: "Inscriptions ouvertes pour le vide-grenier ! Et si vous avez une heure le matin même, rejoignez l'équipe d'installation.",
    },
    slots: [
      { day: "Mar", time: "09:00", network: "Facebook" },
      { day: "Mer", time: "17:30", network: "Instagram" },
      { day: "Ven", time: "08:45", network: "LinkedIn" },
    ],
  },
  {
    brand: "Atelier Morel",
    kind: "Cabinet d'architecture",
    brief: "Partager notre dernier projet : la rénovation d'une grange en maison",
    visual: { title: "Une grange devenue maison", from: "#3ddc97", to: "#1e8a77" },
    posts: {
      Instagram: "Avant, des poutres et de la poussière. Après, une maison baignée de lumière. Retour en images sur la rénovation de la grange.",
      LinkedIn: "Rénover sans effacer : comment nous avons conservé la charpente d'origine tout en rendant la maison sobre en énergie.",
      Facebook: "Notre dernier chantier est terminé ! Découvrez la transformation d'une grange en maison familiale, étape par étape.",
    },
    slots: [
      { day: "Lun", time: "12:00", network: "Instagram" },
      { day: "Mer", time: "08:30", network: "LinkedIn" },
      { day: "Sam", time: "10:00", network: "Facebook" },
    ],
  },
];

const NETWORKS: Network[] = ["Instagram", "LinkedIn", "Facebook"];
const LIMITS: Record<Network, string> = { Instagram: "2 200", LinkedIn: "3 000", Facebook: "63 206" };
const DOT: Record<Network, string> = { Instagram: "bg-[#ff4f9a]", LinkedIn: "bg-[#4aa3ff]", Facebook: "bg-[#7c8bff]" };

/** Étapes : 0 saisie · 1 écriture · 2 propositions · 3 programmées · 4 publiées. */
type Phase = 0 | 1 | 2 | 3 | 4;
const TIMELINE: { phase: Phase; at: number }[] = [
  { phase: 1, at: 2300 },
  { phase: 2, at: 3400 },
  { phase: 3, at: 4700 },
  { phase: 4, at: 6300 },
];
const SCENARIO_MS = 9800;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * Maquette animée du studio : une demande est saisie, les publications sont écrites pour chaque réseau,
 * rangées dans la semaine, puis publiées. Purement illustrative, signalée comme démonstration.
 */
export function ProductDemo() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(0);
  const [typed, setTyped] = useState(0);
  const scenario = SCENARIOS[index] as Scenario;

  useEffect(() => {
    if (reduced) {
      setPhase(4);
      setTyped(scenario.brief.length);
      return;
    }
    setPhase(0);
    setTyped(0);
    const typing = window.setInterval(() => setTyped((value) => Math.min(value + 1, scenario.brief.length)), 2000 / scenario.brief.length);
    const timers = TIMELINE.map(({ phase: next, at }) => window.setTimeout(() => setPhase(next), at));
    const nextScenario = window.setTimeout(() => setIndex((value) => (value + 1) % SCENARIOS.length), SCENARIO_MS);
    return () => {
      window.clearInterval(typing);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(nextScenario);
    };
  }, [index, reduced, scenario.brief.length]);

  return (
    <div className="glass overflow-hidden rounded-2xl shadow-[0_40px_120px_-40px_rgb(255_122_69/0.35)]">
      {/* Barre de fenêtre */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
        </div>
        <p className="truncate px-3 font-mono text-[11px] text-fg-dim">
          studio / {scenario.brand} <span className="hidden sm:inline">· {scenario.kind}</span>
        </p>
        <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] tracking-wide text-fg-muted uppercase">Démonstration</span>
      </div>

      <div className="grid gap-px bg-line lg:grid-cols-[1fr_1.35fr_0.9fr]">
        {/* 1. La demande */}
        <section className="space-y-4 bg-deep p-5" aria-label="Demande">
          <p className="font-mono text-[11px] tracking-wide text-fg-dim uppercase">1 · Votre idée</p>
          <div className="min-h-[5.5rem] rounded-xl border border-line bg-void/60 p-3 text-sm leading-relaxed">
            <span className={cn(phase === 0 && "caret")}>{scenario.brief.slice(0, typed)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {NETWORKS.map((network) => (
              <span key={network} className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1 text-xs text-fg-muted">
                <span className={cn("size-1.5 rounded-full", DOT[network])} />
                {network}
              </span>
            ))}
          </div>
          <div
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
              phase === 1 ? "scale-[0.98] bg-solar text-void" : "bg-fg text-void",
            )}
          >
            {phase === 1 ? (
              <>
                <span className="size-3.5 animate-spin rounded-full border-2 border-void/30 border-t-void" aria-hidden="true" />
                Écriture en cours…
              </>
            ) : (
              "Écrire les publications"
            )}
          </div>
          <p className="text-xs leading-relaxed text-fg-dim">Ton : chaleureux · d&apos;après la fiche de {scenario.brand}</p>
        </section>

        {/* 2. Les propositions */}
        <section className="space-y-3 bg-deep p-5" aria-label="Propositions">
          <p className="font-mono text-[11px] tracking-wide text-fg-dim uppercase">2 · Une version par réseau</p>
          {NETWORKS.map((network, position) => (
            <article key={network} className="rounded-xl border border-line bg-panel p-3">
              <header className="mb-2 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className={cn("size-1.5 rounded-full", DOT[network])} />
                  {network}
                </span>
                {phase >= 2 ? (
                  <span className="font-mono text-[10px] text-fg-dim">
                    {scenario.posts[network].length} / {LIMITS[network]}
                  </span>
                ) : null}
              </header>
              {phase < 2 ? (
                <div className="space-y-1.5" aria-hidden="true">
                  <div className={cn("h-2.5 w-11/12 rounded", phase === 1 ? "skeleton" : "bg-white/5")} />
                  <div className={cn("h-2.5 w-4/5 rounded", phase === 1 ? "skeleton" : "bg-white/5")} />
                  <div className={cn("h-2.5 w-3/5 rounded", phase === 1 ? "skeleton" : "bg-white/5")} />
                </div>
              ) : (
                <div className="rise flex gap-3" style={{ animationDelay: `${position * 120}ms` }}>
                  {network === "Instagram" ? (
                    <div
                      className="flex size-16 shrink-0 items-end rounded-lg p-1.5 text-[9px] leading-tight font-semibold text-void"
                      style={{ background: `linear-gradient(135deg, ${scenario.visual.from}, ${scenario.visual.to})` }}
                    >
                      {scenario.visual.title}
                    </div>
                  ) : null}
                  <p className="text-[13px] leading-snug text-fg/90">{scenario.posts[network]}</p>
                </div>
              )}
            </article>
          ))}
        </section>

        {/* 3. La semaine */}
        <section className="hidden space-y-3 bg-deep p-5 lg:block" aria-label="Programmation">
          <p className="font-mono text-[11px] tracking-wide text-fg-dim uppercase">3 · Programmées</p>
          {scenario.slots.map((slot, position) => (
            <div
              key={`${slot.day}-${slot.network}`}
              className={cn(
                "rounded-xl border p-3 transition-all duration-500",
                phase >= 3 ? "border-line-strong bg-panel" : "border-dashed border-line bg-transparent",
              )}
            >
              <div className="flex items-center justify-between font-mono text-[11px] text-fg-dim">
                <span>{slot.day}</span>
                <span>{slot.time}</span>
              </div>
              {phase >= 3 ? (
                <div className="rise mt-2 flex items-center justify-between gap-2" style={{ animationDelay: `${position * 150}ms` }}>
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className={cn("size-1.5 rounded-full", DOT[slot.network])} />
                    {slot.network}
                  </span>
                  {phase >= 4 ? (
                    <span className="rise inline-flex items-center gap-1 text-[11px] text-ok" style={{ animationDelay: `${position * 250}ms` }}>
                      <span className="pulse-dot size-1.5 rounded-full bg-ok" /> Publiée
                    </span>
                  ) : (
                    <span className="text-[11px] text-fg-muted">Programmée</span>
                  )}
                </div>
              ) : (
                <div className="mt-2 h-4" />
              )}
            </div>
          ))}
          <p className="pt-1 text-xs leading-relaxed text-fg-dim">Envoi automatique à l&apos;heure prévue, sur le bon compte.</p>
        </section>
      </div>

      {/* Sélecteur de scénario */}
      <div className="flex items-center justify-center gap-2 border-t border-line py-3">
        {SCENARIOS.map((item, position) => (
          <button
            key={item.brand}
            type="button"
            onClick={() => setIndex(position)}
            aria-label={`Voir l'exemple : ${item.kind}`}
            aria-pressed={position === index}
            className={cn("rounded-full px-3 py-1 text-xs transition", position === index ? "bg-white/10 text-fg" : "text-fg-dim hover:text-fg-muted")}
          >
            {item.kind}
          </button>
        ))}
      </div>
    </div>
  );
}
