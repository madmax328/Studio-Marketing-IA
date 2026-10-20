/**
 * Son des vidéos du studio (navigateur) : voix off par diapositive et musique de fond, mixées hors temps réel.
 * Le même mixage sert à l'aperçu et à l'export.
 */

export const AUDIO_SAMPLE_RATE = 48_000;
/** La voix commence un peu après le début de la diapositive (pendant la transition, on n'entend rien). */
export const VOICE_DELAY = 0.3;
const VOICE_TAIL = 0.4;
/** Volume de la musique pendant que la voix parle (relatif au volume choisi). */
const DUCKING = 0.3;
const MUSIC_FADE_IN = 0.6;
const MUSIC_FADE_OUT = 1.2;

/** Durée d'une diapositive allongée, si besoin, pour que sa voix off tienne entièrement (pas d'une demi-seconde). */
export function slideSecondsWithVoice(chosen: number, voiceSeconds: number | null): number {
  if (!voiceSeconds) return chosen;
  return Math.max(chosen, Math.ceil((VOICE_DELAY + voiceSeconds + VOICE_TAIL) * 2) / 2);
}

export async function decodeAudio(data: ArrayBuffer): Promise<AudioBuffer> {
  const context = new OfflineAudioContext(2, 1, AUDIO_SAMPLE_RATE);
  return context.decodeAudioData(data);
}

export interface AudioMix {
  duration: number;
  /** Voix off placées dans le temps de la vidéo (secondes). */
  voices: { start: number; buffer: AudioBuffer }[];
  music: { buffer: AudioBuffer; volume: number } | null;
}

/** Mixe la voix off et la musique (en boucle si elle est plus courte), avec atténuation sous la voix. Null si muet. */
export async function renderMix(mix: AudioMix): Promise<AudioBuffer | null> {
  if (mix.duration <= 0 || (mix.voices.length === 0 && !mix.music)) return null;
  const context = new OfflineAudioContext(2, Math.ceil(mix.duration * AUDIO_SAMPLE_RATE), AUDIO_SAMPLE_RATE);

  for (const voice of mix.voices) {
    const source = context.createBufferSource();
    source.buffer = voice.buffer;
    source.connect(context.destination);
    source.start(voice.start);
  }

  if (mix.music && mix.music.volume > 0) {
    const level = mix.music.volume;
    const gain = context.createGain();
    gain.connect(context.destination);
    const curve = gain.gain;
    curve.setValueAtTime(0, 0);
    curve.linearRampToValueAtTime(level, MUSIC_FADE_IN);
    const voices = [...mix.voices].sort((a, b) => a.start - b.start);
    for (const voice of voices) {
      const from = Math.max(MUSIC_FADE_IN, voice.start - 0.25);
      const to = Math.min(mix.duration - MUSIC_FADE_OUT, voice.start + voice.buffer.duration + 0.25);
      if (to <= from) continue;
      curve.setValueAtTime(level, from);
      curve.linearRampToValueAtTime(level * DUCKING, from + 0.2);
      curve.setValueAtTime(level * DUCKING, Math.max(from + 0.2, to - 0.3));
      curve.linearRampToValueAtTime(level, to);
    }
    const fadeStart = Math.max(MUSIC_FADE_IN, mix.duration - MUSIC_FADE_OUT);
    curve.setValueAtTime(level, fadeStart);
    curve.linearRampToValueAtTime(0, mix.duration);

    const source = context.createBufferSource();
    source.buffer = mix.music.buffer;
    source.loop = true;
    source.connect(gain);
    source.start(0);
  }
  return context.startRendering();
}
