"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface DemoPost {
  network: "Instagram" | "LinkedIn" | "Facebook" | "Threads";
  when: string;
  text: string;
  hashtags: string;
  /** Visuel façon gabarit (Instagram) : titre incrusté sur la couleur de la marque. */
  visual?: { title: string; background: string; color: string };
}

interface Persona {
  id: string;
  label: string;
  brand: string;
  posts: DemoPost[];
}

/** Exemples rédigés à la main pour illustrer le résultat ; ils sont signalés comme tels dans l'interface. */
const PERSONAS: Persona[] = [
  {
    id: "coach",
    label: "Coach sportive",
    brand: "Bouger au quotidien",
    posts: [
      {
        network: "Instagram",
        when: "Lundi · 07:30",
        text: "Pas le temps d'aller à la salle ? Trois exercices à faire entre deux réunions, sans se changer. Lequel testez-vous en premier ?",
        hashtags: "#sport #bienetre #routine",
        visual: { title: "3 exercices à faire au bureau", background: "#c2ead6", color: "#17140f" },
      },
      {
        network: "Facebook",
        when: "Mercredi · 12:15",
        text: "Petit rappel : la séance de samedi matin se fait en extérieur. Prévoyez une bouteille d'eau et une tenue confortable, je m'occupe du reste !",
        hashtags: "",
      },
      {
        network: "Threads",
        when: "Vendredi · 18:00",
        text: "Question du vendredi : vous êtes plutôt sport le matin ou le soir ? Je lis toutes les réponses.",
        hashtags: "",
      },
    ],
  },
  {
    id: "association",
    label: "Association de quartier",
    brand: "Les Amis du Faubourg",
    posts: [
      {
        network: "Facebook",
        when: "Mardi · 18:30",
        text: "Le vide-grenier revient ! Inscriptions des exposants ouvertes jusqu'à la fin du mois. Une table, des voisins, de bonnes affaires : on vous attend.",
        hashtags: "#viedequartier #videgrenier",
      },
      {
        network: "Instagram",
        when: "Jeudi · 17:00",
        text: "Merci aux 12 bénévoles qui ont repeint la salle commune ce week-end. Voilà ce qu'on peut faire ensemble en un samedi !",
        hashtags: "#benevolat #association #ensemble",
        visual: { title: "Merci aux bénévoles !", background: "#f8e192", color: "#17140f" },
      },
      {
        network: "LinkedIn",
        when: "Lundi · 09:00",
        text: "Nous cherchons une entreprise partenaire pour l'atelier numérique des seniors. Une heure par mois suffit pour changer beaucoup de choses.",
        hashtags: "#solidarite #mecenat",
      },
    ],
  },
  {
    id: "photographe",
    label: "Photographe",
    brand: "Atelier Lumière",
    posts: [
      {
        network: "Instagram",
        when: "Dimanche · 19:00",
        text: "Une lumière de fin de journée, un couple qui oublie l'objectif. C'est pour ces secondes-là que je fais ce métier.",
        hashtags: "#photographe #portrait #mariage",
        visual: { title: "Les coulisses d'une séance", background: "#d2c9ff", color: "#17140f" },
      },
      {
        network: "Facebook",
        when: "Mardi · 12:30",
        text: "Vous préparez votre mariage ? Je vous explique en 3 étapes comment se déroule une séance avec moi, du premier appel à la remise des photos.",
        hashtags: "",
      },
      {
        network: "Threads",
        when: "Jeudi · 21:00",
        text: "Le conseil que je donne à tout le monde avant une séance : ne regardez pas l'objectif. Regardez la personne à côté de vous.",
        hashtags: "",
      },
    ],
  },
  {
    id: "restaurant",
    label: "Restaurant",
    brand: "La Table d'Anna",
    posts: [
      {
        network: "Instagram",
        when: "Vendredi · 11:00",
        text: "Cette semaine, la cheffe a ressorti la recette de sa grand-mère. Il y en aura pour tout le monde… jusqu'à 14 h !",
        hashtags: "#faitmaison #cuisine #restaurant",
        visual: { title: "Le plat de la semaine", background: "#f9c9d5", color: "#17140f" },
      },
      {
        network: "Facebook",
        when: "Samedi · 10:00",
        text: "Vous êtes nombreux à nous le demander : oui, on accepte les groupes ! Appelez-nous pour réserver la grande table du fond.",
        hashtags: "",
      },
      {
        network: "Threads",
        when: "Lundi · 16:00",
        text: "Petite question : dessert maison ou café gourmand ? On compte les votes pour la carte de la semaine prochaine.",
        hashtags: "",
      },
    ],
  },
  {
    id: "consultant",
    label: "Consultant B2B",
    brand: "Clair Conseil",
    posts: [
      {
        network: "LinkedIn",
        when: "Mardi · 08:30",
        text: "La plupart des réunions de lancement échouent pour une raison simple : personne n'a écrit ce qui serait un succès. Ma check-list en 5 questions ↓",
        hashtags: "#gestiondeprojet #management",
      },
      {
        network: "LinkedIn",
        when: "Jeudi · 12:00",
        text: "Retour d'expérience : ce que trois mois d'accompagnement ont changé dans l'organisation d'une équipe de 15 personnes.",
        hashtags: "#conseil #organisation",
      },
      {
        network: "Threads",
        when: "Vendredi · 17:30",
        text: "Le meilleur outil de productivité que je connaisse : une réunion annulée parce qu'un e-mail suffisait.",
        hashtags: "",
      },
    ],
  },
  {
    id: "createur",
    label: "Créatrice de bijoux",
    brand: "Fil d'Or",
    posts: [
      {
        network: "Instagram",
        when: "Mercredi · 18:00",
        text: "Chaque pièce de la nouvelle collection est façonnée à la main, dans l'atelier. Voici comment naît une bague, étape par étape.",
        hashtags: "#faitmain #bijoux #createur",
        visual: { title: "Nouvelle collection", background: "#c2def8", color: "#17140f" },
      },
      {
        network: "Facebook",
        when: "Vendredi · 19:00",
        text: "Je serai au marché des créateurs ce dimanche ! Venez découvrir les pièces en vrai et me dire laquelle vous préférez.",
        hashtags: "",
      },
      {
        network: "Threads",
        when: "Lundi · 12:00",
        text: "Avouez : vous aussi, vous portez toujours le même bijou, celui qui a une histoire ?",
        hashtags: "",
      },
    ],
  },
];

const NETWORK_TONE: Record<DemoPost["network"], string> = {
  Instagram: "bg-rose",
  LinkedIn: "bg-sky",
  Facebook: "bg-lilac",
  Threads: "bg-cream-2",
};

function usePrefersReducedMotion() {
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

/** Démonstration : on choisit un profil, les publications « s'écrivent » comme dans le studio. */
export function PersonaDemo() {
  const reduced = usePrefersReducedMotion();
  const [personaId, setPersonaId] = useState(PERSONAS[0]?.id ?? "");
  const persona = PERSONAS.find((item) => item.id === personaId) ?? (PERSONAS[0] as Persona);
  const total = persona.posts.reduce((sum, post) => sum + post.text.length, 0);
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (reduced) {
      setTyped(Number.MAX_SAFE_INTEGER);
      return;
    }
    setTyped(0);
    const timer = window.setInterval(() => {
      setTyped((value) => {
        if (value >= total) {
          window.clearInterval(timer);
          return value;
        }
        return value + 3;
      });
    }, 16);
    return () => window.clearInterval(timer);
  }, [personaId, total, reduced]);

  let offset = 0;
  return (
    <div className="sticker bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Vous êtes…</p>
        <span className="rounded-full border border-ink/20 px-2.5 py-0.5 text-xs text-ink-soft">Exemples de publications</span>
      </div>
      <div role="tablist" aria-label="Choisir un profil" className="mt-3 flex flex-wrap gap-2">
        {PERSONAS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === persona.id}
            onClick={() => setPersonaId(item.id)}
            className={cn(
              "rounded-full border-[1.5px] border-ink px-3 py-1.5 text-sm transition",
              item.id === persona.id ? "bg-ink text-cream" : "bg-white hover:bg-cream-2",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-live="polite" className="mt-5 grid gap-3 md:grid-cols-3">
        {persona.posts.map((post, index) => {
          const start = offset;
          offset += post.text.length;
          const visible = post.text.slice(0, Math.max(0, Math.min(post.text.length, typed - start)));
          const writing = typed > start && typed < start + post.text.length;
          return (
            <article key={`${persona.id}-${index}`} className="sticker-sm flex flex-col overflow-hidden bg-white">
              <header className={cn("flex items-center justify-between gap-2 border-b-[1.5px] border-ink px-3 py-2 text-xs", NETWORK_TONE[post.network])}>
                <span className="font-semibold">{post.network}</span>
                <span className="text-ink-soft">{post.when}</span>
              </header>
              {post.visual ? (
                <div
                  className="grid aspect-[4/3] place-items-center border-b-[1.5px] border-ink p-4 text-center"
                  style={{ background: post.visual.background, color: post.visual.color }}
                >
                  <p className="font-serif text-3xl leading-none">{post.visual.title}</p>
                  <p className="self-end text-[10px] font-semibold tracking-widest uppercase">{persona.brand}</p>
                </div>
              ) : null}
              <div className="flex-1 p-3 text-sm leading-relaxed">
                <p className="sr-only">{post.text}</p>
                <p aria-hidden="true" className={cn("min-h-[5.5em]", writing && "caret")}>
                  {visible}
                </p>
                {post.hashtags && visible.length === post.text.length ? <p className="mt-2 text-xs text-ink-soft">{post.hashtags}</p> : null}
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-ink-soft">
        Dans le studio, ces textes sont écrits à partir de ce que vous dites de votre activité, puis vous les relisez avant
        de les programmer.
      </p>
    </div>
  );
}
