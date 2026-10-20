import type { ReactNode } from "react";
import { BRAND_TONE_LABELS, IMAGE_FORMAT_IDS, IMAGE_FORMATS } from "@smia/shared";
import { cn } from "@/lib/cn";

function Cell({ title, text, children, className }: { title: string; text: string; children: ReactNode; className?: string }) {
  return (
    <article className={cn("glass group flex flex-col overflow-hidden rounded-2xl", className)}>
      <div className="relative flex-1 p-5 sm:p-6" aria-hidden="true">
        {children}
      </div>
      <div className="border-t border-line p-5 sm:p-6">
        <h3 className="font-medium tracking-tight">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{text}</p>
      </div>
    </article>
  );
}

const Dot = ({ className }: { className: string }) => <span className={cn("inline-block size-1.5 rounded-full", className)} />;

/** Grille des fonctionnalités, chacune illustrée par une mini-interface fidèle au studio. */
export function FeatureBento() {
  const tones = Object.values(BRAND_TONE_LABELS);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Cell
        className="lg:col-span-2"
        title="Une fiche qui vous ressemble"
        text="Ce que vous faites, pour qui, votre ton, vos couleurs, les mots à éviter. Le studio n'écrit qu'à partir de ces informations."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-void/50 p-3">
            <p className="font-mono text-[10px] tracking-wide text-fg-dim uppercase">Activité</p>
            <p className="mt-1 text-sm">Studio de yoga, cours collectifs et particuliers</p>
          </div>
          <div className="rounded-xl border border-line bg-void/50 p-3">
            <p className="font-mono text-[10px] tracking-wide text-fg-dim uppercase">Public</p>
            <p className="mt-1 text-sm">Actifs de 25 à 50 ans, débutants bienvenus</p>
          </div>
          <div className="rounded-xl border border-line bg-void/50 p-3 sm:col-span-2">
            <p className="font-mono text-[10px] tracking-wide text-fg-dim uppercase">Ton</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tones.map((tone) => (
                <span
                  key={tone}
                  className={cn("rounded-full px-2.5 py-1 text-xs", tone === "Chaleureux" ? "bg-fg text-void" : "border border-line text-fg-muted")}
                >
                  {tone}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Cell>

      <Cell title="Une version par réseau" text="Longueur, ton et mots-dièse adaptés à chaque réseau. Jusqu'à trois variantes pour choisir.">
        <div className="space-y-2.5">
          {[
            { name: "Instagram", used: 186, max: 2200, dot: "bg-[#ff4f9a]" },
            { name: "LinkedIn", used: 642, max: 3000, dot: "bg-[#4aa3ff]" },
            { name: "X", used: 241, max: 280, dot: "bg-fg" },
          ].map((row) => (
            <div key={row.name} className="rounded-xl border border-line bg-void/50 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <Dot className={row.dot} /> {row.name}
                </span>
                <span className="font-mono text-[10px] text-fg-dim">
                  {row.used} / {row.max.toLocaleString("fr-FR")}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className={cn("h-full rounded-full", row.used / row.max > 0.8 ? "bg-gold" : "bg-solar")}
                  style={{ width: `${Math.max(6, (row.used / row.max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Cell>

      <Cell title="Des visuels à vos couleurs" text="Des modèles prêts à l'emploi, votre logo et vos couleurs ajoutés automatiquement, dans tous les formats.">
        <div className="flex h-full items-end justify-center gap-2">
          {IMAGE_FORMAT_IDS.map((id, index) => {
            const format = IMAGE_FORMATS[id];
            // Hauteur commune, largeur plafonnée : les quatre formats tiennent dans la cellule.
            const height = 76;
            const maxWidth = 100;
            const width = Math.round((height * format.width) / format.height);
            return (
              <div key={id} className="flex flex-col items-center gap-2">
                <div
                  className="flex shrink-0 items-end rounded-lg border border-white/10 p-1 text-[7px] leading-tight font-semibold text-void"
                  style={{
                    width: Math.min(width, maxWidth),
                    height: Math.min(height, Math.round((maxWidth * format.height) / format.width)),
                    background: ["linear-gradient(140deg,#ffc56b,#ff7a45)", "linear-gradient(140deg,#ff7a45,#ff4f6d)", "linear-gradient(160deg,#ff4f6d,#7c5cff)", "linear-gradient(140deg,#3ddc97,#4aa3ff)"][index % 4],
                  }}
                >
                  Studio Ananda
                </div>
                <span className="font-mono text-[10px] text-fg-dim">{format.label.match(/\((.*)\)/)?.[1] ?? format.label}</span>
              </div>
            );
          })}
        </div>
      </Cell>

      <Cell
        className="lg:col-span-2"
        title="Des campagnes planifiées"
        text="Un assistant vous pose les bonnes questions, propose un plan sur plusieurs semaines, puis écrit toutes les publications. Vous validez avant."
      >
        <div className="space-y-2">
          <div className="grid grid-cols-[5rem_repeat(4,1fr)] gap-2 font-mono text-[10px] text-fg-dim">
            <span />
            {["Sem. 1", "Sem. 2", "Sem. 3", "Sem. 4"].map((week) => (
              <span key={week}>{week}</span>
            ))}
          </div>
          {[
            { name: "Instagram", dot: "bg-[#ff4f9a]", bars: [[0, 2], [2, 3.4]] },
            { name: "LinkedIn", dot: "bg-[#4aa3ff]", bars: [[0.5, 1.6], [3, 4]] },
            { name: "Facebook", dot: "bg-[#7c8bff]", bars: [[1, 2.8]] },
          ].map((row) => (
            <div key={row.name} className="grid grid-cols-[5rem_1fr] items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                <Dot className={row.dot} /> {row.name}
              </span>
              <div className="relative h-7 rounded-lg bg-white/[0.03]">
                {row.bars.map(([start, end]) => (
                  <span
                    key={`${start}`}
                    className="absolute inset-y-1 rounded-md bg-gradient-to-r from-solar/80 to-ember/70"
                    style={{ left: `${((start ?? 0) / 4) * 100}%`, width: `${(((end ?? 0) - (start ?? 0)) / 4) * 100}%` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Cell>

      <Cell title="Un calendrier clair" text="Mois, semaine ou liste : ce qui part, quand et où. Les changements d'heure sont gérés.">
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 28 }, (_, day) => (
            <div key={day} className={cn("flex aspect-square flex-col justify-between rounded-md border p-1", day === 9 ? "border-solar/60 bg-solar/10" : "border-line bg-void/40")}>
              <span className="font-mono text-[9px] text-fg-dim">{day + 1}</span>
              <span className="flex gap-0.5">
                {day % 3 === 0 ? <Dot className="bg-[#ff4f9a]" /> : null}
                {day % 4 === 1 ? <Dot className="bg-[#4aa3ff]" /> : null}
                {day % 5 === 2 ? <Dot className="bg-[#7c8bff]" /> : null}
              </span>
            </div>
          ))}
        </div>
      </Cell>

      <Cell
        className="lg:col-span-2"
        title="Un envoi fiable, sans surveillance"
        text="Vos publications partent à l'heure. Si un réseau ne répond pas, le studio réessaie sans jamais publier deux fois, et vous prévient si quelque chose bloque."
      >
        <ul className="space-y-2 font-mono text-[12px]">
          {[
            { time: "09:00", text: "Instagram · publiée", tone: "text-ok", mark: "✓" },
            { time: "12:15", text: "Facebook · réseau indisponible, nouvel essai à 12:20", tone: "text-gold", mark: "↻" },
            { time: "12:20", text: "Facebook · publiée", tone: "text-ok", mark: "✓" },
            { time: "18:00", text: "LinkedIn · autorisation à renouveler : alerte envoyée par e-mail", tone: "text-ember", mark: "!" },
          ].map((line) => (
            <li key={line.time + line.text} className="flex items-center gap-3 rounded-lg border border-line bg-void/50 px-3 py-2">
              <span className="text-fg-dim">{line.time}</span>
              <span className={cn("w-3 text-center", line.tone)}>{line.mark}</span>
              <span className="truncate text-fg-muted">{line.text}</span>
            </li>
          ))}
        </ul>
      </Cell>
    </div>
  );
}
