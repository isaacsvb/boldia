/**
 * BOLD AI — Azure Text-to-Speech (REST). Generates the reference voice for
 * Document Shadowing. Free Tier F0 allows 0.5M neural chars/month.
 *
 * Caches synthesized audio to disk keyed by (text+voice) so repeated shadow
 * reps cost nothing and play instantly.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import { Env, assertAzureConfigured, LanguageCode, LANGUAGES } from '../config/env';
import { AzureConfigError, AzureRequestError } from './azurePronunciation';

const CACHE_DIR = `${FileSystem.cacheDirectory}tts/`;

async function ensureCacheDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
}

function voiceFor(language: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === language)?.ttsVoice ?? 'en-US-AvaMultilingualNeural';
}

function cacheKey(text: string, voice: string): string {
  // Simple stable hash for a filename.
  let h = 0;
  const s = `${voice}:${text}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `${CACHE_DIR}tts_${(h >>> 0).toString(36)}.mp3`;
}

function buildSsml(text: string, voice: string, language: LanguageCode, rate = '0%'): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<speak version="1.0" xml:lang="${language}">
    <voice name="${voice}">
      <prosody rate="${rate}">${escaped}</prosody>
    </voice>
  </speak>`;
}

/** Synthesize `text` to a local mp3 file and return its URI (cached). */
export async function synthesizeToFile(
  text: string,
  language: LanguageCode,
  rate = '0%'
): Promise<string> {
  if (!assertAzureConfigured()) {
    throw new AzureConfigError('Azure Speech key/region not set.');
  }
  await ensureCacheDir();
  const voice = voiceFor(language);
  const path = cacheKey(text, voice + rate);

  const existing = await FileSystem.getInfoAsync(path);
  if (existing.exists) return path;

  const endpoint = `https://${Env.azureSpeechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': Env.azureSpeechKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'bold-ai',
    },
    body: buildSsml(text, voice, language, rate),
  });

  if (!response.ok) {
    const t = await response.text().catch(() => '');
    throw new AzureRequestError(`TTS failed (${response.status}): ${t}`, response.status);
  }

  const bytes = await response.arrayBuffer();
  const b64 = arrayBufferToBase64(bytes);
  await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
  return path;
}

/** Convenience: synth + play. Returns the Sound so the caller can stop it. */
export async function speak(
  text: string,
  language: LanguageCode,
  rate = '0%'
): Promise<Audio.Sound> {
  const uri = await synthesizeToFile(text, language, rate);
  const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
  return sound;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : NaN;
    const c = i + 2 < bytes.length ? bytes[i + 2] : NaN;
    out += chars[a >> 2];
    out += chars[((a & 3) << 4) | (isNaN(b) ? 0 : b >> 4)];
    out += isNaN(b) ? '=' : chars[((b & 15) << 2) | (isNaN(c) ? 0 : c >> 6)];
    out += isNaN(c) ? '=' : chars[c & 63];
  }
  return out;
}
