import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_TONE_LABELS, CAMPAIGN_OBJECTIVES, IMAGE_FORMAT_IDS, IMAGE_FORMATS, TEMPLATE_IDS, TEMPLATE_LABELS } from "@smia/shared";
import { BoardingPass, PassField } from "@/components/site/boarding-pass";
import { SectionTitle } from "@/components/site/section-title";

export const metadata: Metadata = {
  title: "Fonctionnalités",
  description: "Mémoire de marque, rédaction par IA, visuels, campagnes, calendrier et publication automatique : le détail du studio.",
};

interface Cabin {
  gate: string;
  flight: string;
  title: string;
  pitch: string;
  points: string[];
  status: "En service" | "Bientôt";
}

const CABINS: Cabin[] = [
  {
    gate: "A1",
    flight: "MRQ",
    title: "Ma marque",
    pitch: "Tout ce que l'IA doit savoir sur vous, rangé une fois pour toutes.",
    points: [
      "Activité, produits et services, prix et offres, promotions en cours, points forts.",
      "Public visé, zone géographique, langues, fuseau horaire.",
      `Ton au choix (${Object.values(BRAND_TONE_LABELS).join(", ").toLowerCase()}), style d'écriture, mots à utiliser ou à éviter.`,
      "Couleurs, logo, coordonnées publiques et appel à l'action préféré.",
    ],
    status: "En service",
  },
  {
    gate: "A2",
    flight: "CRE",
    title: "Studio de rédaction",
    pitch: "Une idée en une phrase, une publication prête pour chaque réseau.",
    points: [
      "Jusqu'à 3 variantes par réseau, chacune dans la longueur et les usages du réseau.",
      "L'IA explique le rôle de chaque publication et signale l'information qui manque, au lieu de l'inventer.",
      "Éditeur avec compteur de caractères, duplication, brouillons.",
      "Vos données de marque ne partent chez le fournisseur d'IA qu'après votre accord.",
    ],
    status: "En service",
  },
  {
    gate: "A3",
    flight: "VIS",
    title: "Visuels",
    pitch: "Des images à vos couleurs, sans logiciel de graphisme.",
    points: [
      `${TEMPLATE_IDS.length} gabarits : ${TEMPLATE_IDS.map((id) => TEMPLATE_LABELS[id].label.toLowerCase()).join(", ")}.`,
      `${IMAGE_FORMAT_IDS.length} formats : ${IMAGE_FORMAT_IDS.map((id) => IMAGE_FORMATS[id].label.toLowerCase()).join(", ")}.`,
      "Votre logo et vos couleurs incrustés automatiquement ; vos propres photos dans la médiathèque.",
      "Génération d'images par IA : prévue, en complément des gabarits.",
    ],
    status: "En service",
  },
  {
    gate: "B1",
    flight: "CMP",
    title: "Campagnes",
    pitch: "Un mois de publications, pensé comme un plan et pas au jour le jour.",
    points: [
      `Un assistant en 9 étapes, ${CAMPAIGN_OBJECTIVES.length} objectifs possibles (faire connaître, promotion, événement, fidélisation…).`,
      "L'IA propose une stratégie : messages clés, rythme, répartition par réseau. Vous la modifiez avant tout.",
      "Rédaction de tout le plan, puis programmation en une fois ; chaque publication reste modifiable.",
    ],
    status: "En service",
  },
  {
    gate: "B2",
    flight: "CAL",
    title: "Calendrier",
    pitch: "La tour de contrôle : ce qui part, quand, et où.",
    points: [
      "Vues mois, semaine et liste, filtres par réseau et par statut.",
      "Heures affichées dans votre fuseau ; changements d'heure gérés (une heure qui n'existe pas est refusée).",
      "Décaler, annuler ou reprogrammer une publication jusqu'à son départ.",
    ],
    status: "En service",
  },
  {
    gate: "B3",
    flight: "PUB",
    title: "Publication automatique",
    pitch: "La publication part seule, à l'heure, sur le bon compte.",
    points: [
      "Connexion par la page officielle de chaque réseau : jamais de mot de passe demandé.",
      "Nouvel essai automatique si le réseau est momentanément indisponible ; jamais deux fois la même publication.",
      "Alerte dans l'application et par e-mail si une publication est bloquée ou si un compte doit être reconnecté.",
      "Réseau par réseau, l'état réel de chaque connexion est affiché sur la page d'accueil.",
    ],
    status: "En service",
  },
  {
    gate: "C1",
    flight: "ANA",
    title: "Analyse et amélioration",
    pitch: "Comprendre ce qui fonctionne, et s'en servir pour la suite.",
    points: [
      "Statistiques réelles de chaque publication, telles que les réseaux les fournissent.",
      "Premières recommandations à partir de vos propres résultats.",
    ],
    status: "Bientôt",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="tarmac text-paper">
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-16 sm:px-6 sm:pt-24">
          <SectionTitle tone="dark" code="Plan de l'appareil" title={<>Visite de l&apos;appareil,<br />cabine par cabine.</>}>
            Chaque fonction a sa porte. Celles marquées « bientôt » sont annoncées comme telles : rien n&apos;est présenté ici
            avant d&apos;exister.
          </SectionTitle>
        </div>
        <div className="hazard h-3" aria-hidden="true" />
      </section>

      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-5xl space-y-8 px-4 sm:px-6">
          {CABINS.map((cabin) => (
            <BoardingPass
              key={cabin.gate}
              className={cabin.status === "Bientôt" ? "opacity-80" : undefined}
              stub={
                <>
                  <div className="grid grid-cols-3 gap-3 md:grid-cols-1">
                    <PassField label="Porte" value={cabin.gate} />
                    <PassField label="Vol" value={cabin.flight} />
                    <PassField
                      label="Statut"
                      value={<span className={cabin.status === "Bientôt" ? "text-ink-soft" : "text-[#138a4b]"}>{cabin.status}</span>}
                    />
                  </div>
                  {/* Code-barres décoratif du billet. */}
                  <div aria-hidden="true" className="flex h-10 items-stretch gap-[2px]">
                    {Array.from(`${cabin.gate}${cabin.flight}${cabin.title}${cabin.pitch}`.slice(0, 44)).map((char, index) => (
                      <span key={index} className="bg-ink" style={{ width: `${(char.charCodeAt(0) % 4) + 1}px` }} />
                    ))}
                  </div>
                </>
              }
            >
              <p className="font-board text-[10px] tracking-[0.2em] text-ink-soft uppercase">Cabine</p>
              <h2 className="font-display text-5xl leading-none font-black uppercase">{cabin.title}</h2>
              <p className="mt-3 text-lg">{cabin.pitch}</p>
              <ul className="mt-5 space-y-2 text-ink-soft">
                {cabin.points.map((point) => (
                  <li key={point} className="flex gap-3">
                    <span aria-hidden="true" className="mt-2 size-2 shrink-0 rotate-45 bg-signal" />
                    {point}
                  </li>
                ))}
              </ul>
            </BoardingPass>
          ))}
        </div>
      </section>

      <section className="bg-paper-2 py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p className="font-display text-4xl leading-none font-black uppercase">Tout est à bord. Il ne manque que vous.</p>
          <div className="flex gap-3">
            <Link href="/inscription" className="rounded-full bg-ink px-6 py-3 font-semibold text-paper hover:bg-night-3">
              Embarquer gratuitement
            </Link>
            <Link href="/tarifs" className="rounded-full border-2 border-ink px-6 py-3 font-semibold hover:bg-signal">
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
