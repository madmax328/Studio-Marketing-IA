import { ALL_FORMATS, BufferSource, Input } from "mediabunny";
import { MAX_VIDEO_SECONDS } from "@smia/shared";

export interface VideoInfo {
  container: string;
  codec: string | null;
  /** Codec du son, null pour une vidéo muette. */
  audioCodec: string | null;
  width: number;
  height: number;
  durationSeconds: number;
}

/** Lit le conteneur d'une vidéo (sans la décoder) : format, codec, dimensions, durée. Null si illisible. */
export async function inspectVideo(bytes: Buffer): Promise<VideoInfo | null> {
  try {
    const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
    const format = await input.getFormat();
    const track = await input.getPrimaryVideoTrack();
    if (!track) return null;
    const audio = await input.getPrimaryAudioTrack();
    return {
      container: format.name,
      codec: track.codec,
      audioCodec: audio ? audio.codec : null,
      width: track.displayWidth,
      height: track.displayHeight,
      durationSeconds: await input.computeDuration(),
    };
  } catch {
    return null;
  }
}

/**
 * Raisons de refuser une vidéo (liste vide = acceptée). Les réseaux sociaux exigent du H.264 dans un MP4.
 */
export function videoProblems(info: VideoInfo | null): string[] {
  if (!info) return ["Ce fichier n'est pas une vidéo lisible."];
  const problems: string[] = [];
  if (info.container !== "MP4") problems.push("La vidéo doit être au format MP4.");
  if (info.codec !== "avc") problems.push("La vidéo doit être encodée en H.264 (format accepté par tous les réseaux).");
  if (info.audioCodec !== null && info.audioCodec !== "aac") problems.push("Le son de la vidéo doit être en AAC (format accepté par tous les réseaux).");
  if (info.durationSeconds <= 0 || info.durationSeconds > MAX_VIDEO_SECONDS + 0.5) {
    problems.push(`La vidéo doit durer ${MAX_VIDEO_SECONDS} secondes au plus.`);
  }
  if (info.width < 240 || info.height < 240 || info.width > 1920 || info.height > 1920) {
    problems.push("Dimensions de vidéo non prises en charge.");
  }
  return problems;
}
