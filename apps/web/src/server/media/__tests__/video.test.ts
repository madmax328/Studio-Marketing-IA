import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectVideo, videoProblems } from "../video";

// Petite vidéo réelle (VP9 dans un MP4, 360 × 640, 2 s), produite par Chromium avec WebCodecs.
const fixture = readFileSync(join(__dirname, "fixtures/vp9-360x640-2s.mp4"));
// Même chose avec du son Opus (voix off et musique mixées dans le navigateur), 4 s.
const withSound = readFileSync(join(__dirname, "fixtures/vp9-opus-360x640-4s.mp4"));
// Vidéo telle que l'acceptent les réseaux : H.264 et son AAC (produite avec ffmpeg).
const publishable = readFileSync(join(__dirname, "fixtures/h264-aac-360x640-2s.mp4"));

describe("vidéos", () => {
  it("lit le conteneur, le codec, les dimensions et la durée sans décoder", async () => {
    expect(await inspectVideo(fixture)).toEqual({ container: "MP4", codec: "vp9", audioCodec: null, width: 360, height: 640, durationSeconds: 2 });
  });

  it("accepte une vidéo H.264 avec son AAC", async () => {
    const info = await inspectVideo(publishable);
    expect(info).toMatchObject({ container: "MP4", codec: "avc", audioCodec: "aac", width: 360, height: 640 });
    expect(videoProblems(info)).toEqual([]);
  });

  it("lit le codec du son", async () => {
    const info = await inspectVideo(withSound);
    expect(info).toMatchObject({ codec: "vp9", audioCodec: "opus", width: 360, height: 640 });
    expect(videoProblems(info)).toContain("Le son de la vidéo doit être en AAC (format accepté par tous les réseaux).");
  });

  it("refuse ce qui n'est pas une vidéo, et les vidéos que les réseaux n'acceptent pas", async () => {
    expect(await inspectVideo(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    expect(videoProblems(null)).toHaveLength(1);
    expect(videoProblems(await inspectVideo(fixture))).toEqual(["La vidéo doit être encodée en H.264 (format accepté par tous les réseaux)."]);
    expect(videoProblems({ container: "MP4", codec: "avc", audioCodec: null, width: 1080, height: 1920, durationSeconds: 75 })).toEqual([
      "La vidéo doit durer 60 secondes au plus.",
    ]);
    expect(videoProblems({ container: "MP4", codec: "avc", audioCodec: "opus", width: 1080, height: 1920, durationSeconds: 30 })).toEqual([
      "Le son de la vidéo doit être en AAC (format accepté par tous les réseaux).",
    ]);
    expect(videoProblems({ container: "MP4", codec: "avc", audioCodec: null, width: 1080, height: 1920, durationSeconds: 30 })).toEqual([]);
    expect(videoProblems({ container: "MP4", codec: "avc", audioCodec: "aac", width: 1080, height: 1920, durationSeconds: 30 })).toEqual([]);
  });
});
