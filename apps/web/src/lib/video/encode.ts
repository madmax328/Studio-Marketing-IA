/**
 * Encodage des vidéos dans le navigateur (WebCodecs) en MP4 H.264, le format accepté par tous les réseaux.
 * Aucun serveur de montage : le calcul se fait sur l'appareil de l'utilisateur.
 */
import { drawFrame, projectDuration, type VideoProject } from "./render";

export const VIDEO_FPS = 30;

/** Le navigateur sait-il produire une vidéo H.264 de ces dimensions ? */
export async function canExportMp4(width: number, height: number): Promise<boolean> {
  if (typeof window === "undefined" || !("VideoEncoder" in window)) return false;
  try {
    const { canEncodeVideo } = await import("mediabunny");
    return await canEncodeVideo("avc", { width, height });
  } catch {
    return false;
  }
}

/** Le navigateur sait-il produire du son AAC (le seul accepté par tous les réseaux) ? */
export async function canExportAudio(): Promise<boolean> {
  if (typeof window === "undefined" || !("AudioEncoder" in window)) return false;
  try {
    const { canEncodeAudio } = await import("mediabunny");
    return await canEncodeAudio("aac", { numberOfChannels: 2, sampleRate: 48_000 });
  } catch {
    return false;
  }
}

export async function encodeProject(
  project: VideoProject,
  onProgress: (ratio: number) => void,
  isCancelled: () => boolean = () => false,
  /** H.264 pour les réseaux ; paramétrable uniquement pour les essais automatiques. */
  codec: "avc" | "vp9" = "avc",
  /** Bande son déjà mixée (voix off, musique), ou null pour une vidéo muette. */
  audio: { buffer: AudioBuffer; codec: "aac" | "opus" } | null = null,
): Promise<{ video: Blob; poster: Blob } | null> {
  const { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH } = await import("mediabunny");
  const canvas = document.createElement("canvas");
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: VIDEO_FPS });
  const audioSource = audio ? new AudioBufferSource({ codec: audio.codec, bitrate: 128_000 }) : null;
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start();
  if (audioSource && audio) {
    await audioSource.add(audio.buffer);
    audioSource.close();
  }

  const duration = projectDuration(project);
  const frames = Math.ceil(duration * VIDEO_FPS);
  for (let frame = 0; frame < frames; frame += 1) {
    if (isCancelled()) {
      await output.cancel();
      return null;
    }
    const t = frame / VIDEO_FPS;
    drawFrame(ctx, project, t);
    await source.add(t, 1 / VIDEO_FPS);
    if (frame % 5 === 0) onProgress(frame / frames);
  }
  await output.finalize();
  onProgress(1);
  const buffer = output.target.buffer;
  if (!buffer) throw new Error("Vidéo vide.");

  // Image d'aperçu : la première diapositive, une fois son texte apparu.
  drawFrame(ctx, project, Math.min(1, duration / 2));
  const poster = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Aperçu impossible."))), "image/jpeg", 0.85),
  );
  return { video: new Blob([buffer], { type: "video/mp4" }), poster };
}
