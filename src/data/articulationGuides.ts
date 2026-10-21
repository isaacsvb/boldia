/**
 * Static articulation guidance for commonly-failed EN/FR phonemes. Each entry
 * describes tongue / teeth / lip placement in plain language plus an SVG-ready
 * mouth-diagram hint the Articulation Guide screen renders.
 *
 * This keeps the "visual articulation guide" feature fully offline ($0).
 */
import type { LanguageCode } from '../config/env';

export interface ArticulationGuide {
  phoneme: string;
  language: LanguageCode;
  name: string;
  tongue: string;
  teeth: string;
  lips: string;
  tip: string;
  /** which mouth diagram asset/preset to show */
  diagram: 'th-dental' | 'r-retroflex' | 'r-uvular' | 'u-rounded' | 'vowel-front' | 'nasal';
}

export const ARTICULATION_GUIDES: ArticulationGuide[] = [
  {
    phoneme: 'th',
    language: 'en-US',
    name: 'Voiceless TH (think)',
    tongue: 'Place the tongue tip lightly between your top and bottom front teeth.',
    teeth: 'Teeth are slightly apart; the tongue peeks through.',
    lips: 'Relaxed and open.',
    tip: 'Push air gently over the tongue — it should tickle. Don’t turn it into an “s” or “f”.',
    diagram: 'th-dental',
  },
  {
    phoneme: 'r',
    language: 'en-US',
    name: 'American R (red)',
    tongue: 'Curl the tongue tip up and back without touching the roof of the mouth.',
    teeth: 'Not involved.',
    lips: 'Round them slightly forward.',
    tip: 'Think “grrr”. The sides of the tongue touch the upper back teeth.',
    diagram: 'r-retroflex',
  },
  {
    phoneme: 'ʁ',
    language: 'fr-FR',
    name: 'French R (rue)',
    tongue: 'Back of the tongue rises toward the uvula (the dangly bit at the back).',
    teeth: 'Not involved.',
    lips: 'Neutral.',
    tip: 'It’s a soft gargle at the back of the throat — not the English tip-curl R.',
    diagram: 'r-uvular',
  },
  {
    phoneme: 'y',
    language: 'fr-FR',
    name: 'French U (tu)',
    tongue: 'Tongue high and forward as if saying “ee”.',
    teeth: 'Close together.',
    lips: 'Round them tightly as if saying “oo”, while keeping the “ee” tongue.',
    tip: 'Say “ee”, then round your lips without moving your tongue.',
    diagram: 'u-rounded',
  },
  {
    phoneme: 'ɛ̃',
    language: 'fr-FR',
    name: 'French nasal IN (vin)',
    tongue: 'Low-front, like “eh”.',
    teeth: 'Apart.',
    lips: 'Slightly spread.',
    tip: 'Let air flow through the nose — don’t pronounce a hard “n”.',
    diagram: 'nasal',
  },
];

export function guideForPhoneme(phoneme: string, language: LanguageCode): ArticulationGuide | null {
  return (
    ARTICULATION_GUIDES.find(
      (g) => g.language === language && g.phoneme.toLowerCase() === phoneme.toLowerCase()
    ) ?? null
  );
}
