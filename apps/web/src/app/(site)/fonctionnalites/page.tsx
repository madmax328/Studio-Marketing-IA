import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_TONE_LABELS, CAMPAIGN_OBJECTIVES, IMAGE_FORMAT_IDS, IMAGE_FORMATS, TEMPLATE_IDS, TEMPLATE_LABELS } from "@smia/shared";
import { SectionHeading } from "@/components/site/section-heading";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Fonctionnalités",
  description: "Fiche de votre activité, écriture par IA, visuels, campagnes, calendrier et publication automatique : le détail du studio.",
};

interface Feature {
  title: string;
  pitch: string;
  points: string[];
  tone: string;
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
    tone: "bg-mint",
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
    tone: "bg-butter",
  },
  {
    title: "Les visuels",
    pitch: "Des images à vos couleurs, sans logiciel de graphisme.",
    points: [
      `${TEMPLATE_IDS.length} modèles : ${TEMPLATE_IDS.map((id) => TEMPLATE_LABELS[id].label.toLowerCase()).join(", ")}.`,
      `${IMAGE_FORMAT_IDS.length} formats : ${IMAGE_FORMAT_IDS.map((id) => IMAGE_FORMATS[id].label.toLowerCase()).join(", ")}.`,
      "Votre logo et vos couleurs ajoutés automatiquement ; vos propres photos rangées dans votre médiathèque.",
      "Création d'images par IA : prévue, en complément des modèles.",
    ],
    tone: "bg-rose",
  },
  {
    title: "Les campagnes",
    pitch: "Plusieurs semaines de publications, pensées comme un tout.",
    points: [
      `Un assistant en 9 étapes et ${CAMPAIGN_OBJECTIVES.length} objectifs au choix : vous faire connaître, annoncer un événement, lancer une nouveauté…`,
      "Le studio propose un plan : messages, rythme, réseaux. Vous le modifiez avant tout.",
      "Il écrit ensuite toutes les publications ; vous les programmez en une fois.",
    ],
    tone: "bg-lilac",
  },
  {
    title: "Le calendrier",
    pitch: "Ce qui part, quand, et où.",
    points: [
      "Vue par mois, par semaine ou en liste, avec des filtres.",
      "Heures affichées dans votre fuseau horaire ; changements d'heure été/hiver pris en compte.",
      "Décaler, annuler ou reprogrammer une publication jusqu'à son départ.",
    ],
    tone: "bg-sky",
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
    tone: "bg-tomato",
  },
  {
    title: "Les résultats",
    pitch: "Savoir ce qui marche, et s'en servir pour la suite.",
    points: ["Les chiffres réels de chaque publication, tels que les réseaux les donnent.", "Des conseils tirés de vos propres résultats."],
    tone: "bg-cream-2",
    soon: true,
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
        <SectionHeading kicker="Fonctionnalités" title={<>Ce que fait le studio, <em>en détail.</em></>}>
          Ce qui est marqué « bientôt » est annoncé comme tel : rien n&apos;est présenté ici avant d&apos;exister.
        </SectionHeading>
      </section>

      <section className="pb-20 sm:pb-28">
        <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
          {FEATURES.map((feature, index) => (
            <article
              key={feature.title}
              className={cn("sticker grid overflow-hidden bg-white md:grid-cols-[0.9fr_1.4fr]", feature.soon && "border-dashed shadow-none")}
            >
              <div className={cn("flex flex-col justify-between gap-6 border-b-[1.5px] border-ink p-7 md:border-r-[1.5px] md:border-b-0", feature.tone)}>
                <p className="font-serif text-6xl leading-none italic">{String(index + 1).padStart(2, "0")}</p>
                <div>
                  {feature.soon ? (
                    <span className="mb-3 inline-block rounded-full border-[1.5px] border-dashed border-ink bg-white px-3 py-0.5 text-xs font-semibold">
                      Bientôt
                    </span>
                  ) : null}
                  <h2 className="font-serif text-5xl leading-none">{feature.title}</h2>
                </div>
              </div>
              <div className="p-7">
                <p className="text-xl font-semibold">{feature.pitch}</p>
                <ul className="mt-5 space-y-3 text-ink-soft">
                  {feature.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span aria-hidden="true" className="text-tomato">✓</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6">
        <div className="sticker mx-auto flex max-w-6xl flex-col items-start gap-6 bg-butter p-8 md:flex-row md:items-center md:justify-between">
          <p className="font-serif text-4xl leading-none">
            Le plus simple, <em>c&apos;est d&apos;essayer.</em>
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/inscription" className="rounded-full border-[1.5px] border-ink bg-ink px-6 py-3 font-semibold text-cream hover:bg-white hover:text-ink">
              Créer mon compte gratuit
            </Link>
            <Link href="/tarifs" className="rounded-full border-[1.5px] border-ink bg-white px-6 py-3 font-semibold hover:bg-cream-2">
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
