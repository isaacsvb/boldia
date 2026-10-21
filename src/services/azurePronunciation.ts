/**
 * BOLD AI — Azure Pronunciation Assessment (REST, Free-Tier friendly).
 *
 * Works inside Expo Go: we POST the recorded WAV to the Speech-to-Text
 * "short audio" endpoint with a base64-encoded `Pronunciation-Assessment`
 * header. No native SDK required. Audio must be <= 30s, 16kHz/16-bit PCM WAV.
 *
 * Returns the four headline scores plus a word/phoneme breakdown that the UI
 * uses for color-coding and the Articulation Guide.
 *
 * Docs: https://learn.microsoft.com/azure/ai-services/speech-service/how-to-pronunciation-assessment
 */
import * as FileSystem from 'expo-file-system/legacy';
import { Env, assertAzureConfigured, LanguageCode } from '../config/env';

export interface PhonemeScore {
  phoneme: string;
  accuracyScore: number;
}

export interface WordScore {
  word: string;
  accuracyScore: number;
  errorType: string; // 'None' | 'Omission' | 'Insertion' | 'Mispronunciation'
  phonemes: PhonemeScore[];
}

export interface PronunciationResult {
  recognizedText: string;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  pronunciationScore: number;
  words: WordScore[];
  phonemes: PhonemeScore[]; // flattened, for aggregate phoneme stats
}

export class AzureConfigError extends Error {}
export class AzureRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

/** Base64-encode a compact JSON config for the Pronunciation-Assessment header. */
function buildAssessmentHeader(referenceText: string): string {
  const config = {
    ReferenceText: referenceText,
    GradingSystem: 'HundredMark',
    Granularity: 'Phoneme',
    Dimension: 'Comprehensive',
    EnableMiscue: true,
  };
  // btoa isn't always present in RN; encode via a tiny helper.
  return base64Encode(JSON.stringify(config));
}

function base64Encode(str: string): string {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
  // Fallback for environments without btoa
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p) =>
    String.fromCharCode(parseInt(p, 16))
  );
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes.charCodeAt(i);
    const b = i + 1 < bytes.length ? bytes.charCodeAt(i + 1) : NaN;
    const c = i + 2 < bytes.length ? bytes.charCodeAt(i + 2) : NaN;
    out += chars[a >> 2];
    out += chars[((a & 3) << 4) | (isNaN(b) ? 0 : b >> 4)];
    out += isNaN(b) ? '=' : chars[((b & 15) << 2) | (isNaN(c) ? 0 : c >> 6)];
    out += isNaN(c) ? '=' : chars[c & 63];
  }
  return out;
}

/**
 * Assess a recorded audio file against a reference sentence.
 * @param audioUri  local file:// URI of a 16kHz mono 16-bit PCM WAV recording
 * @param referenceText  the sentence the learner was asked to say
 * @param language  'en-US' | 'fr-FR'
 */
export async function assessPronunciation(
  audioUri: string,
  referenceText: string,
  language: LanguageCode
): Promise<PronunciationResult> {
  if (!assertAzureConfigured()) {
    throw new AzureConfigError(
      'Azure Speech key/region not set. Add EXPO_PUBLIC_AZURE_SPEECH_KEY and EXPO_PUBLIC_AZURE_SPEECH_REGION to your .env.'
    );
  }

  const endpoint =
    `https://${Env.azureSpeechRegion}.stt.speech.microsoft.com` +
    `/speech/recognition/conversation/cognitiveservices/v1` +
    `?language=${language}&format=detailed`;

  const audioBytes = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const audioBuffer = decodeBase64ToBytes(audioBytes);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': Env.azureSpeechKey,
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      'Pronunciation-Assessment': buildAssessmentHeader(referenceText),
      Accept: 'application/json',
    },
    body: audioBuffer as unknown as BodyInit,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new AzureRequestError(`Azure assessment failed (${response.status}): ${text}`, response.status);
  }

  const json = await response.json();
  return parseAzureResponse(json);
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const clean = b64.replace(/=+$/, '');
  const bytes = new Uint8Array((clean.length * 3) / 4);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = lookup[clean.charCodeAt(i)];
    const e2 = lookup[clean.charCodeAt(i + 1)];
    const e3 = lookup[clean.charCodeAt(i + 2)];
    const e4 = lookup[clean.charCodeAt(i + 3)];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (i + 2 < clean.length) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (i + 3 < clean.length) bytes[p++] = ((e3 & 3) << 6) | e4;
  }
  return bytes;
}

/** Normalise Azure's detailed NBest[0] shape into our flat result. */
function parseAzureResponse(json: any): PronunciationResult {
  const nbest = json?.NBest?.[0];
  if (!nbest) {
    throw new AzureRequestError('Azure returned no recognition result (NBest empty).');
  }
  const pa = nbest.PronunciationAssessment ?? {};

  const words: WordScore[] = (nbest.Words ?? []).map((w: any) => ({
    word: w.Word,
    accuracyScore: w.PronunciationAssessment?.AccuracyScore ?? 0,
    errorType: w.PronunciationAssessment?.ErrorType ?? 'None',
    phonemes: (w.Phonemes ?? []).map((p: any) => ({
      phoneme: p.Phoneme,
      accuracyScore: p.PronunciationAssessment?.AccuracyScore ?? 0,
    })),
  }));

  const phonemes: PhonemeScore[] = words.flatMap((w) => w.phonemes);

  return {
    recognizedText: nbest.Display ?? json.DisplayText ?? '',
    accuracyScore: pa.AccuracyScore ?? 0,
    fluencyScore: pa.FluencyScore ?? 0,
    completenessScore: pa.CompletenessScore ?? 0,
    pronunciationScore: pa.PronScore ?? pa.PronunciationScore ?? 0,
    words,
    phonemes,
  };
}
