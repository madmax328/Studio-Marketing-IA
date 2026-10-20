import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_TONE_LABELS, CAMPAIGN_OBJECTIVES, IMAGE_FORMAT_IDS, IMAGE_FORMATS, TEMPLATE_IDS, TEMPLATE_LABELS } from "@smia/shared";
import { FeatureBento } from "@/components/site/feature-bento";
import { imageAiAvailable, voiceAiAvailable } from "@/lib/features";

export const metadata: Metadata = {
  title: "Fonctionnalités",
  description: "Fiche de votre activité, écriture par IA, visuels, campagnes, calendrier et publication automatique : le détail du studio.",
};

interface Feature {
  title: string;
  pitch: string;
  points: string[];
  soon?: boolean;
}

const FEATURES: Feature[] = [
  {
    title: "Votre fiche",
    pitch: "Tout ce que le studio doit savoir sur vous, rangé une fois pour toutes.",
    points: [
      "Votre activité, ce que vous proposez, à qui, où, et ce qui vous distingue.",
      `Votre ton (${Object.values(BRAND_TONE_LABELS).join(", ").toLowerCase()}), votre style, les mots à utiliser ou à éviter.`,
      "Vos couleurs, votre logo, vos coordonnées publiques et ce que vous voulez que les gens fassent.",
      "Plusieurs fiches possibles selon l'offre, par exemple pour plusieurs marques.",
    ],
  },
  {
    title: "L'écriture",
    pitch: "Une idée en une phrase, une publication prête pour chaque réseau.",
    points: [
      "Jusqu'à 3 versions par réseau, chacune dans la longueur et le style du réseau.",
      "Le studio explique à quoi sert chaque publication et vous signale ce qui manque, au lieu de l'inventer.",
      "Vous modifiez le texte comme vous voulez, avec un compteur de caractères.",
      "Vos informations ne sont envoyées au service d'IA qu'après votre accord.",
    ],
  },
  {
    title: "Les visuels",
    pitch: "Des images et des vidéos à vos couleurs, sans logiciel de graphisme.",
    points: [
      `${TEMPLATE_IDS.length} modèles : ${TEMPLATE_IDS.map((id) => TEMPLATE_LABELS[id].label.toLowerCase()).join(", ")}.`,
      `${IMAGE_FORMAT_IDS.length} formats : ${IMAGE_FORMAT_IDS.map((id) => IMAGE_FORMATS[id].label.toLowerCase()).join(", ")}.`,
      "Votre logo et vos couleurs ajoutés automatiquement ; vos propres photos rangées dans votre médiathèque.",
      imageAiAvailable()
        ? "Création d'images par IA à partir d'une simple description, sans texte incrusté : votre titre et votre logo sont ajoutés ensuite par les modèles."
        : "Création d'images par IA : prévue, en complément des modèles.",
      "Courtes vidéos (jusqu'à 60 secondes) montées à partir de vos photos et de vos messages, avec transitions, carte de fin à votre logo et musique de fond, prêtes pour Facebook, Instagram (Reels) et Threads. Le montage se fait dans votre navigateur.",
      ...(voiceAiAvailable() ? ["Voix off par IA avec sous-titres automatiques : vous écrivez le texte, une voix naturelle le lit, la musique baisse pendant qu'elle parle."] : []),
    ],
  },
  {
    title: "Les campagnes",
    pitch: "Plusieurs semaines de publications, pensées comme un tout.",
    points: [
      `Un assistant en 9 étapes et ${CAMPAIGN_OBJECTIVES.length} objectifs au choix : vous faire connaître, annoncer un événement, lancer une nouveauté…`,
      "Le studio propose un plan : messages, rythme, réseaux. Vous le modifiez avant tout.",
      "Il écrit ensuite toutes les publications ; vous les programmez en une fois.",
    ],
  },
  {
    title: "Le calendrier",
    pitch: "Ce qui part, quand, et où.",
    points: [
      "Vue par mois, par semaine ou en liste, avec des filtres.",
      "Heures affichées dans votre fuseau horaire ; changements d'heure été/hiver pris en compte.",
      "Décaler, annuler ou reprogrammer une publication jusqu'à son départ.",
    ],
  },
  {
    title: "La publication automatique",
    pitch: "Vos publications partent seules, à l'heure, sur le bon compte.",
    points: [
      "Vos comptes se connectent par la page officielle de chaque réseau : jamais de mot de passe demandé.",
      "Nouvel essai automatique si le réseau ne répond pas, sans jamais publier deux fois.",
      "Alerte dans le studio et par e-mail si une publication est bloquée ou si un compte doit être reconnecté.",
      "L'état réel de chaque réseau est affiché sur la page d'accueil.",
    ],
  },
  {
    title: "Les résultats",
    pitch: "Savoir ce qui marche, et s'en servir pour la suite.",
    points: [
      "Vues, personnes touchées, j'aime, commentaires, partages, enregistrements : uniquement les chiffres que chaque réseau fournit, jamais d'estimation.",
      "Des conseils tirés de vos propres résultats (réseau, jour, heure, images), donnés seulement quand il y a assez de publications pour être fiables.",
      "Vos publications qui ont le mieux marché servent d'exemple au studio pour écrire les suivantes.",
      "LinkedIn ne transmet pas encore ses chiffres au studio : ces publications sont signalées comme non mesurées.",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="relative overflow-x-clip">
        <div aria-hidden="true" className="halo pointer-events-none absolute inset-x-0 -top-16 h-[30rem]" />
        <div aria-hidden="true" className="grid-fade pointer-events-none absolute inset-x-0 -top-16 h-[30rem]" />
        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-16 sm:px-6 sm:pt-24">
          <p className="font-mono text-xs tracking-[0.14em] text-solar uppercase">Fonctionnalités</p>
          <h1 className="mt-4 max-w-3xl text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.03] font-semibold tracking-[-0.045em] text-balance">
            Tout le studio, <span className="text-sun">en détail.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">
            Ce qui est marqué « bientôt » est annoncé comme tel : rien n&apos;est présenté ici avant d&apos;exister.
          </p>
          <div className="mt-14">
            <FeatureBento />
          </div>
        </div>
      </section>

      <section className="border-t border-line py-24 sm:py-28">
        <div className="mx-auto max-w-6xl divide-y divide-line px-4 sm:px-6">
          {FEATURES.map((feature, index) => (
            <article key={feature.title} className="grid gap-6 py-12 first:pt-0 last:pb-0 md:grid-cols-[1fr_1.4fr]">
              <div>
                <p className="font-mono text-xs text-fg-dim">{String(index + 1).padStart(2, "0")}</p>
                <h2 className="mt-3 flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
                  {feature.title}
                  {feature.soon ? (
                    <span className="rounded-full border border-dashed border-line-strong px-2.5 py-0.5 font-mono text-[11px] font-normal tracking-wide text-fg-muted uppercase">
                      Bientôt
                    </span>
                  ) : null}
                </h2>
                <p className="mt-3 text-fg-muted">{feature.pitch}</p>
              </div>
              <ul className="space-y-3">
                {feature.points.map((point) => (
                  <li key={point} className="flex gap-3 text-[15px] leading-relaxed text-fg/90">
                    <svg viewBox="0 0 16 16" className="mt-1 size-4 shrink-0 text-solar" aria-hidden="true">
                      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6">
        <div className="glass relative mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-16 text-center">
          <div aria-hidden="true" className="halo pointer-events-none absolute inset-0" />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Le plus simple, c&apos;est d&apos;essayer.</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/inscription" className="rounded-full bg-fg px-6 py-3 text-sm font-medium text-void hover:bg-white">
                Créer mon compte gratuit
              </Link>
              <Link href="/tarifs" className="rounded-full border border-line-strong px-6 py-3 text-sm font-medium hover:bg-white/5">
                Voir les tarifs
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
