"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IMAGE_FORMATS,
  MAX_VIDEO_SECONDS,
  MAX_VIDEO_SLIDES,
  VIDEO_FORMAT_IDS,
  VIDEO_SLIDE_SECONDS,
  VIDEO_TRANSITION_LABELS,
  VIDEO_TRANSITIONS,
  type ImageFormatId,
  type VideoTransition,
} from "@smia/shared";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { canExportMp4, encodeProject } from "@/lib/video/encode";
import { drawFrame, projectDuration, type VideoProject } from "@/lib/video/render";
import { prepareUploadAction, registerVideoAction } from "@/server/actions/media";

export interface EditorBrand {
  id: string;
  name: string;
  colors: string[];
  logoMediaId: string | null;
  callToAction: string;
}

export interface EditorImage {
  id: string;
  name: string;
}

interface SlideState {
  key: string;
  imageId: string | null;
  text: string;
  seconds: number;
}

const FORMAT_HINTS: Partial<Record<ImageFormatId, string>> = {
  story: "Reels, TikTok, Shorts",
  portrait: "Fil Instagram et Facebook",
  square: "Tous réseaux",
  landscape: "YouTube, LinkedIn",
};

const control =
  "w-full rounded-xl border border-border bg-black/30 px-3.5 py-2.5 text-sm text-foreground transition hover:border-border-strong focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15";

const fileUrl = (id: string) => `/api/medias/${id}/fichier`;

/** Charge une image de la médiathèque (même origine : le canvas n'est jamais « contaminé »). */
function useImages(ids: string[]) {
  const [loaded, setLoaded] = useState<Record<string, HTMLImageElement>>({});
  useEffect(() => {
    for (const id of ids) {
      if (loaded[id]) continue;
      const image = new Image();
      image.src = fileUrl(id);
      image
        .decode()
        .then(() => setLoaded((current) => ({ ...current, [id]: image })))
        .catch(() => undefined);
    }
  }, [ids, loaded]);
  return loaded;
}

let slideCounter = 0;
const newSlide = (imageId: string | null = null, text = ""): SlideState => ({
  key: `s${(slideCounter += 1)}`,
  imageId,
  text,
  seconds: VIDEO_SLIDE_SECONDS.default,
});

export function VideoEditor({ brands, images, access }: { brands: EditorBrand[]; images: EditorImage[]; access: "private" | "public" }) {
  const router = useRouter();
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const brand = brands.find((item) => item.id === brandId) ?? brands[0];
  const [format, setFormat] = useState<ImageFormatId>("story");
  const [transition, setTransition] = useState<VideoTransition>("fondu");
  const [motion, setMotion] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [slides, setSlides] = useState<SlideState[]>(() => [newSlide(images[0]?.id ?? null), newSlide(images[1]?.id ?? null)]);
  const [outroOn, setOutroOn] = useState(true);
  const [outroTitle, setOutroTitle] = useState(brand?.name ?? "");
  const [outroSubtitle, setOutroSubtitle] = useState(brand?.callToAction ?? "");
  const [name, setName] = useState("Ma vidéo");
  const [picker, setPicker] = useState<string | null>(null);

  const [supported, setSupported] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<"idle" | "encoding" | "uploading">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  const dims = IMAGE_FORMATS[format];
  useEffect(() => {
    void canExportMp4(dims.width, dims.height).then(setSupported);
  }, [dims.width, dims.height]);

  const neededIds = useMemo(
    () => [...new Set([...slides.flatMap((slide) => (slide.imageId ? [slide.imageId] : [])), ...(showLogo && brand?.logoMediaId ? [brand.logoMediaId] : [])])],
    [slides, showLogo, brand?.logoMediaId],
  );
  const loaded = useImages(neededIds);
  const fontFamily = useMemo(() => (typeof window === "undefined" ? "sans-serif" : getComputedStyle(document.body).fontFamily), []);

  const project: VideoProject = useMemo(() => {
    const logo = showLogo && brand?.logoMediaId ? loaded[brand.logoMediaId] : undefined;
    return {
      width: dims.width,
      height: dims.height,
      transition,
      motion,
      fontFamily,
      colors: { primary: brand?.colors[0] ?? "#ff7a45", secondary: brand?.colors[1] ?? "#17140f" },
      logo: logo ? { image: logo, width: logo.naturalWidth, height: logo.naturalHeight } : null,
      slides: slides.map((slide) => {
        const image = slide.imageId ? loaded[slide.imageId] : undefined;
        return { image: image ?? null, imageWidth: image?.naturalWidth ?? 1, imageHeight: image?.naturalHeight ?? 1, text: slide.text, seconds: slide.seconds };
      }),
      outro: outroOn && outroTitle.trim() ? { title: outroTitle, subtitle: outroSubtitle, seconds: 3 } : null,
    };
  }, [dims, transition, motion, fontFamily, brand, showLogo, loaded, slides, outroOn, outroTitle, outroSubtitle]);

  const duration = projectDuration(project);
  const tooLong = duration > MAX_VIDEO_SECONDS;

  // ---------- Aperçu ----------
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0.8);
  const draw = useCallback(
    (t: number) => {
      const ctx = canvas.current?.getContext("2d");
      if (ctx) drawFrame(ctx, project, Math.min(t, Math.max(0, duration - 0.01)));
    },
    [project, duration],
  );
  useEffect(() => {
    if (!playing) {
      draw(time);
      return;
    }
    let frame = 0;
    const start = performance.now() - time * 1000;
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      if (t >= duration) {
        setPlaying(false);
        setTime(0);
        return;
      }
      draw(t);
      setTime(t);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // L'aperçu redémarre quand le projet change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, draw, duration]);

  const update = (key: string, patch: Partial<SlideState>) => setSlides((current) => current.map((slide) => (slide.key === key ? { ...slide, ...patch } : slide)));
  const move = (index: number, delta: number) =>
    setSlides((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (item) next.splice(index + delta, 0, item);
      return next;
    });

  async function exportVideo() {
    setError(null);
    if (!brand) return;
    if (slides.some((slide) => slide.imageId && !loaded[slide.imageId])) {
      setError("Les images sont encore en cours de chargement. Réessayez dans un instant.");
      return;
    }
    cancelled.current = false;
    setPlaying(false);
    setPhase("encoding");
    setProgress(0);
    try {
      const result = await encodeProject(project, setProgress, () => cancelled.current);
      if (!result) {
        setPhase("idle");
        return;
      }
      setPhase("uploading");
      const [videoKey, posterKey] = await Promise.all([prepareUploadAction("video.mp4"), prepareUploadAction("apercu.jpg")]);
      if (!videoKey.ok || !posterKey.ok) throw new Error(!videoKey.ok ? videoKey.error : !posterKey.ok ? posterKey.error : "");
      await Promise.all([
        upload(videoKey.data.storageKey, result.video, { access, handleUploadUrl: "/api/medias/upload", contentType: "video/mp4" }),
        upload(posterKey.data.storageKey, result.poster, { access, handleUploadUrl: "/api/medias/upload", contentType: "image/jpeg" }),
      ]);
      const registered = await registerVideoAction({ storageKey: videoKey.data.storageKey, posterKey: posterKey.data.storageKey, name, brandId: brand.id });
      if (!registered.ok) throw new Error(registered.error);
      router.push("/medias?video=1");
      router.refresh();
    } catch (exception) {
      setPhase("idle");
      setError(exception instanceof Error && exception.message ? exception.message : "La création de la vidéo a échoué. Réessayez.");
    }
  }

  const busy = phase !== "idle";
  const scale = Math.min(1, 360 / dims.width, 560 / dims.height);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
      <div className="space-y-6">
        {supported === false ? (
          <Alert tone="error">
            Ce navigateur ne sait pas encore créer de vidéo MP4. Utilisez une version récente de Chrome, Edge ou Safari.
          </Alert>
        ) : null}

        <Card className="space-y-4">
          <h2 className="font-semibold">Réglages</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {brands.length > 1 ? (
              <label className="space-y-1.5 text-sm font-medium">
                <span className="block">Marque</span>
                <select className={control} value={brandId} onChange={(event) => setBrandId(event.target.value)}>
                  {brands.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="space-y-1.5 text-sm font-medium">
              <span className="block">Nom de la vidéo</span>
              <input className={control} value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
            </label>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Format</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {VIDEO_FORMAT_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFormat(id)}
                  aria-pressed={format === id}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm transition",
                    format === id ? "border-primary/70 bg-primary/10" : "border-border hover:border-border-strong",
                  )}
                >
                  <span className="block font-medium">{IMAGE_FORMATS[id].label}</span>
                  <span className="block text-xs text-muted">{FORMAT_HINTS[id]}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1.5 text-sm font-medium">
              <span className="block">Transition</span>
              <select className={control} value={transition} onChange={(event) => setTransition(event.target.value as VideoTransition)}>
                {VIDEO_TRANSITIONS.map((id) => (
                  <option key={id} value={id}>
                    {VIDEO_TRANSITION_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm">
              <input type="checkbox" checked={motion} onChange={(event) => setMotion(event.target.checked)} className="size-4 accent-[var(--primary)]" />
              Mouvement des images
            </label>
            <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm">
              <input
                type="checkbox"
                checked={showLogo && Boolean(brand?.logoMediaId)}
                disabled={!brand?.logoMediaId}
                onChange={(event) => setShowLogo(event.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              {brand?.logoMediaId ? "Afficher le logo" : "Logo (aucun défini)"}
            </label>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Diapositives</h2>
            <p className="text-xs text-muted">
              {slides.length} / {MAX_VIDEO_SLIDES}
            </p>
          </div>
          <ol className="space-y-3">
            {slides.map((slide, index) => (
              <li key={slide.key} className="rounded-xl border border-border bg-white/[0.02] p-3">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPicker(picker === slide.key ? null : slide.key)}
                    className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-black/30 text-xs text-muted"
                    aria-label="Choisir l'image de fond"
                  >
                    {slide.imageId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl(slide.imageId)} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="size-full" style={{ background: `linear-gradient(135deg, ${brand?.colors[0] ?? "#ff7a45"}, ${brand?.colors[1] ?? "#17140f"})` }} />
                    )}
                  </button>
                  <div className="min-w-0 flex-1 space-y-2">
                    <textarea
                      className={control}
                      rows={2}
                      maxLength={120}
                      placeholder="Texte affiché (facultatif)"
                      value={slide.text}
                      onChange={(event) => update(slide.key, { text: event.target.value })}
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <label className="flex items-center gap-1.5">
                        Durée
                        <select
                          className="rounded-lg border border-border bg-black/30 px-2 py-1 text-foreground"
                          value={slide.seconds}
                          onChange={(event) => update(slide.key, { seconds: Number(event.target.value) })}
                        >
                          {Array.from({ length: VIDEO_SLIDE_SECONDS.max - VIDEO_SLIDE_SECONDS.min + 1 }, (_, i) => VIDEO_SLIDE_SECONDS.min + i).map((s) => (
                            <option key={s} value={s}>
                              {s} s
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="flex-1" />
                      <button type="button" className="rounded-lg px-2 py-1 hover:bg-white/5 disabled:opacity-30" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Monter">
                        ↑
                      </button>
                      <button
                        type="button"
                        className="rounded-lg px-2 py-1 hover:bg-white/5 disabled:opacity-30"
                        disabled={index === slides.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label="Descendre"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="rounded-lg px-2 py-1 text-danger hover:bg-danger/10 disabled:opacity-30"
                        disabled={slides.length === 1}
                        onClick={() => setSlides((current) => current.filter((item) => item.key !== slide.key))}
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                </div>
                {picker === slide.key ? (
                  <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                    <button
                      type="button"
                      onClick={() => {
                        update(slide.key, { imageId: null });
                        setPicker(null);
                      }}
                      className="aspect-square rounded-lg border border-border text-[10px] text-muted"
                      style={{ background: `linear-gradient(135deg, ${brand?.colors[0] ?? "#ff7a45"}, ${brand?.colors[1] ?? "#17140f"})` }}
                    >
                      Couleurs
                    </button>
                    {images.map((image) => (
                      <button
                        key={image.id}
                        type="button"
                        title={image.name}
                        onClick={() => {
                          update(slide.key, { imageId: image.id });
                          setPicker(null);
                        }}
                        className={cn("aspect-square overflow-hidden rounded-lg border", slide.imageId === image.id ? "border-primary" : "border-border")}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fileUrl(image.id)} alt={image.name} loading="lazy" className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          <Button variant="secondary" disabled={slides.length >= MAX_VIDEO_SLIDES} onClick={() => setSlides((current) => [...current, newSlide()])}>
            Ajouter une diapositive
          </Button>
          {images.length === 0 ? <p className="text-xs text-muted">Ajoutez des photos à la médiathèque pour les utiliser en fond.</p> : null}
        </Card>

        <Card className="space-y-3">
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <input type="checkbox" checked={outroOn} onChange={(event) => setOutroOn(event.target.checked)} className="size-4 accent-[var(--primary)]" />
            Carte de fin (3 s)
          </label>
          {outroOn ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={control} value={outroTitle} maxLength={80} placeholder="Titre (ex. le nom de votre activité)" onChange={(event) => setOutroTitle(event.target.value)} />
              <input className={control} value={outroSubtitle} maxLength={120} placeholder="Appel à l'action (facultatif)" onChange={(event) => setOutroSubtitle(event.target.value)} />
            </div>
          ) : null}
        </Card>
      </div>

      <div className="lg:sticky lg:top-8 lg:self-start">
        <Card className="space-y-3">
          <div className="mx-auto overflow-hidden rounded-xl border border-border bg-black" style={{ width: dims.width * scale, maxWidth: "100%" }}>
            <canvas ref={canvas} width={dims.width} height={dims.height} className="block h-auto w-full" aria-label="Aperçu de la vidéo" />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => setPlaying((value) => !value)} disabled={busy}>
              {playing ? "Pause" : "Lire l'aperçu"}
            </Button>
            <p className={cn("font-mono text-xs", tooLong ? "text-danger" : "text-muted")}>
              {time.toFixed(1)} / {duration.toFixed(1)} s{tooLong ? ` · ${MAX_VIDEO_SECONDS} s maximum` : ""}
            </p>
          </div>
          <p className="text-xs text-muted">Vidéo sans son pour l&apos;instant. La musique et la voix off arrivent ensuite.</p>
          {error ? <Alert tone="error">{error}</Alert> : null}
          {busy ? (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round((phase === "uploading" ? 1 : progress) * 100)}%` }} />
              </div>
              <p className="text-xs text-muted">
                {phase === "encoding" ? `Montage de la vidéo… ${Math.round(progress * 100)} % (gardez cet onglet ouvert)` : "Envoi vers la médiathèque…"}
              </p>
              {phase === "encoding" ? (
                <Button variant="ghost" onClick={() => (cancelled.current = true)}>
                  Annuler
                </Button>
              ) : null}
            </div>
          ) : (
            <Button className="w-full" disabled={!supported || tooLong || !brand || !name.trim()} onClick={() => void exportVideo()}>
              Créer la vidéo
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
