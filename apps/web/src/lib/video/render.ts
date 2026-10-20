/**
 * Rendu des vidéos du studio, image par image, sur un canvas (navigateur).
 * Le même rendu sert à l'aperçu en direct et à l'encodage : ce que l'on voit est ce qui est exporté.
 */
import type { VideoTransition } from "@smia/shared";

export interface VideoSlide {
  /** Image de fond (déjà chargée), ou null pour un fond aux couleurs de la marque. */
  image: CanvasImageSource | null;
  imageWidth: number;
  imageHeight: number;
  text: string;
  seconds: number;
  /** Sous-titres de la voix off, en secondes depuis le début de la diapositive. */
  captions: Caption[];
}

export interface Caption {
  text: string;
  start: number;
  end: number;
}

export interface VideoProject {
  width: number;
  height: number;
  slides: VideoSlide[];
  transition: VideoTransition;
  /** Léger zoom continu sur les images (effet « Ken Burns »). */
  motion: boolean;
  colors: { primary: string; secondary: string };
  fontFamily: string;
  logo: { image: CanvasImageSource; width: number; height: number } | null;
  outro: { title: string; subtitle: string; seconds: number } | null;
}

export const TRANSITION_SECONDS = 0.5;
const CAPTION_CHARS = 42;

/**
 * Découpe le texte lu en sous-titres courts (une ou deux lignes), répartis sur la durée de la voix
 * au prorata de leur longueur : la parole suit à peu près le nombre de caractères.
 */
export function captionChunks(text: string, start: number, seconds: number): Caption[] {
  const chunks: string[] = [];
  for (const sentence of text.trim().split(/(?<=[.!?…;:])\s+/)) {
    let line = "";
    for (const word of sentence.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length <= CAPTION_CHARS || !line) line = candidate;
      else {
        chunks.push(line);
        line = word;
      }
    }
    if (line) chunks.push(line);
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (total === 0 || seconds <= 0) return [];
  const captions: Caption[] = [];
  let cursor = start;
  for (const chunk of chunks) {
    const length = (seconds * chunk.length) / total;
    captions.push({ text: chunk, start: cursor, end: cursor + length });
    cursor += length;
  }
  return captions;
}

/** Durée totale (secondes). Les transitions se chevauchent avec la fin de la diapositive précédente. */
export function projectDuration(project: VideoProject): number {
  const slides = project.slides.reduce((sum, slide) => sum + slide.seconds, 0);
  return slides + (project.outro ? project.outro.seconds : 0);
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

function drawCover(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, image: CanvasImageSource, iw: number, ih: number, w: number, h: number, zoom: number) {
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Coupe un texte en lignes qui tiennent dans la largeur donnée. */
export function wrapText(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawSlide(ctx: Ctx, project: VideoProject, slide: VideoSlide, local: number) {
  const { width: w, height: h } = project;
  const unit = Math.min(w, h);
  if (slide.image) {
    const zoom = project.motion ? 1 + 0.08 * clamp(local / slide.seconds) : 1;
    drawCover(ctx, slide.image, slide.imageWidth, slide.imageHeight, w, h, zoom);
    // Dégradé sombre en bas : le texte reste lisible quelle que soit la photo.
    const shade = ctx.createLinearGradient(0, h * 0.35, 0, h);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);
  } else {
    const background = ctx.createLinearGradient(0, 0, w, h);
    background.addColorStop(0, project.colors.primary);
    background.addColorStop(1, project.colors.secondary);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }

  if (slide.text.trim()) {
    // Opacité de base (fondu en cours) multipliée par l'apparition du texte.
    const base = ctx.globalAlpha;
    const appear = easeOut(clamp((local - 0.15) / 0.45));
    const size = Math.round(unit * (slide.image ? 0.068 : 0.085));
    ctx.font = `800 ${size}px ${project.fontFamily}`;
    ctx.textAlign = slide.image ? "left" : "center";
    ctx.textBaseline = "alphabetic";
    const margin = unit * 0.08;
    const lines = wrapText(ctx, slide.text, w - margin * 2);
    const lineHeight = size * 1.15;
    const block = lines.length * lineHeight;
    // Avec des sous-titres, le texte remonte pour leur laisser le bas de l'image.
    const bottom = slide.captions.length > 0 ? unit * 0.24 : 0;
    const baseY = slide.image ? h - margin - bottom - block + size * 0.85 : (h - block) / 2 - bottom / 2 + size * 0.85;
    ctx.globalAlpha = base * appear;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = slide.image ? size * 0.3 : 0;
    lines.forEach((line, index) => {
      ctx.fillText(line, slide.image ? margin : w / 2, baseY + index * lineHeight + (1 - appear) * size * 0.6);
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = base;
  }
  drawCaption(ctx, project, slide, local);
  drawLogo(ctx, project, false);
}

function drawCaption(ctx: Ctx, project: VideoProject, slide: VideoSlide, local: number) {
  const caption = slide.captions.find((item) => local >= item.start && local < item.end);
  if (!caption) return;
  const { width: w, height: h } = project;
  const unit = Math.min(w, h);
  const size = Math.round(unit * 0.046);
  ctx.font = `700 ${size}px ${project.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const lines = wrapText(ctx, caption.text, w * 0.8).slice(0, 2);
  const lineHeight = size * 1.25;
  const padX = size * 0.6;
  const padY = size * 0.35;
  const boxW = Math.max(...lines.map((line) => ctx.measureText(line).width)) + padX * 2;
  const boxH = lines.length * lineHeight + padY * 2;
  const y = h - unit * 0.08 - boxH;
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.beginPath();
  ctx.roundRect((w - boxW) / 2, y, boxW, boxH, size * 0.35);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  lines.forEach((line, index) => ctx.fillText(line, w / 2, y + padY + size + index * lineHeight));
}

function drawLogo(ctx: Ctx, project: VideoProject, large: boolean) {
  if (!project.logo) return;
  const { width: w, height: h } = project;
  const unit = Math.min(w, h);
  const boxH = unit * (large ? 0.16 : 0.075);
  const ratio = project.logo.width / project.logo.height;
  const boxW = Math.min(boxH * ratio, unit * (large ? 0.5 : 0.25));
  const logoH = boxW / ratio;
  const pad = unit * 0.02;
  const x = large ? (w - boxW) / 2 : w - unit * 0.06 - boxW;
  const y = large ? h * 0.22 : unit * 0.06;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.roundRect(x - pad, y - pad, boxW + pad * 2, logoH + pad * 2, pad * 1.5);
  ctx.fill();
  ctx.drawImage(project.logo.image, x, y, boxW, logoH);
}

function drawOutro(ctx: Ctx, project: VideoProject, local: number) {
  if (!project.outro) return;
  const { width: w, height: h } = project;
  const unit = Math.min(w, h);
  ctx.fillStyle = project.colors.primary;
  ctx.fillRect(0, 0, w, h);
  drawLogo(ctx, project, true);
  const base = ctx.globalAlpha;
  const appear = easeOut(clamp(local / 0.5));
  ctx.globalAlpha = base * appear;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  const titleSize = Math.round(unit * 0.08);
  ctx.font = `800 ${titleSize}px ${project.fontFamily}`;
  const titleLines = wrapText(ctx, project.outro.title, w * 0.84);
  let y = h * 0.52;
  for (const line of titleLines) {
    ctx.fillText(line, w / 2, y);
    y += titleSize * 1.15;
  }
  if (project.outro.subtitle.trim()) {
    const subSize = Math.round(unit * 0.042);
    ctx.font = `500 ${subSize}px ${project.fontFamily}`;
    ctx.globalAlpha = base * appear * 0.9;
    for (const line of wrapText(ctx, project.outro.subtitle, w * 0.8)) {
      y += subSize * 0.4;
      ctx.fillText(line, w / 2, y + subSize);
      y += subSize * 1.2;
    }
  }
  ctx.globalAlpha = base;
}

/** Dessine l'image de la vidéo à l'instant `t` (secondes). */
export function drawFrame(ctx: Ctx, project: VideoProject, t: number): void {
  const { width: w, height: h } = project;
  ctx.clearRect(0, 0, w, h);

  // Repère de chaque segment (diapositives puis carte de fin).
  const segments: { start: number; seconds: number; draw: (local: number) => void }[] = [];
  let cursor = 0;
  for (const slide of project.slides) {
    segments.push({ start: cursor, seconds: slide.seconds, draw: (local) => drawSlide(ctx, project, slide, local) });
    cursor += slide.seconds;
  }
  if (project.outro) segments.push({ start: cursor, seconds: project.outro.seconds, draw: (local) => drawOutro(ctx, project, local) });
  if (segments.length === 0) return;

  const found = segments.findIndex((segment) => t < segment.start + segment.seconds);
  const index = found === -1 ? segments.length - 1 : found;
  const current = segments[index];
  if (!current) return;
  const local = t - current.start;
  const previous = index > 0 ? segments[index - 1] : undefined;

  // Transition : les TRANSITION_SECONDS premières secondes d'un segment mélangent avec le précédent.
  const progress = clamp(local / TRANSITION_SECONDS);
  if (!previous || project.transition === "coupe" || progress >= 1) {
    current.draw(local);
    return;
  }
  const eased = easeOut(progress);
  if (project.transition === "fondu") {
    previous.draw(previous.seconds);
    ctx.globalAlpha = eased;
    current.draw(local);
    ctx.globalAlpha = 1;
    return;
  }
  // Glissement : la nouvelle diapositive pousse l'ancienne vers la gauche.
  ctx.save();
  ctx.translate(-w * eased, 0);
  previous.draw(previous.seconds);
  ctx.restore();
  ctx.save();
  ctx.translate(w * (1 - eased), 0);
  current.draw(local);
  ctx.restore();
}
