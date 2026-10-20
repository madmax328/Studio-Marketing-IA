import { describe, expect, it } from "vitest";
import { slideSecondsWithVoice, VOICE_DELAY } from "../audio";
import { captionChunks } from "../render";

describe("sous-titres", () => {
  it("découpe en morceaux courts qui couvrent exactement la durée de la voix", () => {
    const text = "Nouveau : la terrasse est ouverte. Venez profiter du soleil avec un café offert pour toute commande avant midi !";
    const captions = captionChunks(text, VOICE_DELAY, 6);
    expect(captions.length).toBeGreaterThan(2);
    for (const caption of captions) expect(caption.text.length).toBeLessThanOrEqual(42);
    expect(captions.map((caption) => caption.text).join(" ")).toBe(text);
    expect(captions[0]?.start).toBe(VOICE_DELAY);
    expect(captions.at(-1)?.end).toBeCloseTo(VOICE_DELAY + 6);
    // Bout à bout, sans trou.
    captions.slice(1).forEach((caption, index) => expect(caption.start).toBeCloseTo(captions[index]?.end ?? 0));
  });

  it("ne coupe jamais au milieu d'un mot, même très long", () => {
    expect(captionChunks("anticonstitutionnellement-et-bien-plus-encore-que-cela-encore", 0, 2)).toHaveLength(1);
    expect(captionChunks("   ", 0, 2)).toEqual([]);
  });
});

describe("durée des diapositives avec voix off", () => {
  it("allonge la diapositive pour que la voix tienne, par demi-seconde", () => {
    expect(slideSecondsWithVoice(3, null)).toBe(3);
    expect(slideSecondsWithVoice(5, 2)).toBe(5);
    expect(slideSecondsWithVoice(3, 4.2)).toBe(5);
  });
});
