"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const ALPHABET = " ABCDEFGHIJKLMNOPQRSTUVWXYZÉÈÀÇ0123456789:'-";

interface Flight {
  time: string;
  destination: string;
  post: string;
}

/** Exemples de programmation d'une boulangerie : illustration, pas des données réelles. */
const EXAMPLES: Flight[] = [
  { time: "07:45", destination: "INSTAGRAM", post: "PAIN AU LEVAIN DU JOUR" },
  { time: "09:30", destination: "FACEBOOK", post: "HORAIRES DU WEEK-END" },
  { time: "11:00", destination: "LINKEDIN", post: "NOUVEL APPRENTI" },
  { time: "12:15", destination: "THREADS", post: "LA QUESTION DU JOUR" },
  { time: "14:00", destination: "INSTAGRAM", post: "RECETTE DE BRIOCHE" },
  { time: "16:30", destination: "FACEBOOK", post: "LE FOURNIL EN COULISSE" },
  { time: "18:00", destination: "INSTAGRAM", post: "GALETTE DES ROIS" },
  { time: "19:45", destination: "THREADS", post: "MERCI POUR LA SEMAINE" },
  { time: "08:15", destination: "LINKEDIN", post: "OUVERT DÈS 7 H DEMAIN" },
]

type Status = "PROGRAMMÉE" | "ENVOI" | "PUBLIÉE";
const STATUS_TONE: Record<Status, string> = { PROGRAMMÉE: "", ENVOI: "flap-signal", PUBLIÉE: "flap-runway" };

const VISIBLE = 5;
const TICK_MS = 2600;

function pad(value: string, width: number) {
  return value.length >= width ? value.slice(0, width) : value + " ".repeat(width - value.length);
}

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

/** Une case à palettes : quand la lettre change, elle fait défiler quelques palettes avant de s'arrêter. */
function Flap({ char, tone, animate }: { char: string; tone?: string; animate: boolean }) {
  const [shown, setShown] = useState(char);
  const [flipping, setFlipping] = useState(false);
  const previous = useRef(char);

  useEffect(() => {
    if (previous.current === char) return;
    previous.current = char;
    if (!animate) {
      setShown(char);
      return;
    }
    let steps = 3 + Math.floor(Math.random() * 6);
    setFlipping(true);
    const timer = window.setInterval(() => {
      steps -= 1;
      if (steps <= 0) {
        setShown(char);
        setFlipping(false);
        window.clearInterval(timer);
        return;
      }
      setShown(ALPHABET[Math.floor(Math.random() * ALPHABET.length)] ?? " ");
    }, 70);
    return () => window.clearInterval(timer);
  }, [char, animate]);

  return (
    <span className={cn("flap", tone)} data-flipping={flipping} aria-hidden="true">
      {shown === " " ? " " : shown}
    </span>
  );
}

function FlapText({ text, width, tone, animate, className }: { text: string; width: number; tone?: string; animate: boolean; className?: string }) {
  const value = pad(text, width);
  return (
    <span className={className ?? "inline-flex"}>
      {Array.from(value).map((char, index) => (
        <Flap key={index} char={char} tone={tone} animate={animate} />
      ))}
    </span>
  );
}

/**
 * Tableau des départs façon aéroport : chaque publication programmée est un « vol » vers un réseau.
 * Purement illustratif (signalé comme exemple), il tourne en boucle.
 */
export function DepartureBoard() {
  const reduced = usePrefersReducedMotion();
  const [offset, setOffset] = useState(0);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => {
      setPhase((current) => {
        if (current === 1) {
          setOffset((value) => (value + 1) % EXAMPLES.length);
          return 0;
        }
        return current + 1;
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [reduced]);

  const rows = Array.from({ length: VISIBLE }, (_, index) => EXAMPLES[(offset + index) % EXAMPLES.length] as Flight);
  const statusFor = (index: number): Status => (index === 0 ? (phase === 0 ? "ENVOI" : "PUBLIÉE") : "PROGRAMMÉE");

  return (
    <figure className="board-scale overflow-hidden rounded-2xl border border-white/10 bg-night-2 p-[1.2em] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)]">
      <figcaption className="mb-[0.9em] flex items-center justify-between font-board text-[0.8em] tracking-[0.2em] text-signal">
        <span>DÉPARTS · AUJOURD&apos;HUI</span>
        <span className="rounded-sm border border-signal/40 px-[0.5em] py-[0.15em] text-[0.85em] text-signal/80">EXEMPLE</span>
      </figcaption>
      <div className="mb-[0.5em] flex gap-[1.17em] font-board text-[0.65em] tracking-[0.18em] text-white/45">
        <span className="w-[calc(5*1.17em/0.65)]">HEURE</span>
        <span className="w-[calc(9*1.17em/0.65)]">DESTINATION</span>
        <span className="hidden w-[calc(22*1.17em/0.65)] md:block">PUBLICATION</span>
        <span>STATUT</span>
      </div>
      <ol className="space-y-[0.35em]">
        {rows.map((row, index) => {
          const status = statusFor(index);
          return (
            <li key={index} className="flex gap-[1.17em]">
              <FlapText text={row.time} width={5} animate={!reduced} />
              <FlapText text={row.destination} width={9} animate={!reduced} tone="flap-signal" />
              <FlapText text={row.post} width={22} animate={!reduced} className="hidden md:inline-flex" />
              <FlapText text={status} width={10} animate={!reduced} tone={STATUS_TONE[status]} />
            </li>
          );
        })}
      </ol>
      <p className="sr-only">
        Exemple de tableau des départs : des publications programmées partent automatiquement vers Instagram, Facebook,
        LinkedIn et les autres réseaux.
      </p>
    </figure>
  );
}
