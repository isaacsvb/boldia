/**
 * Centralised runtime config. Reads Azure credentials from public env vars
 * (prefixed EXPO_PUBLIC_ so they are inlined by Expo at build time).
 *
 * For a shipped app you would proxy Azure through a tiny serverless function
 * so the key never lives on-device, but for the $0 Free-Tier dev build the
 * REST key approach keeps everything client-side.
 */

export const Env = {
  azureSpeechKey: process.env.EXPO_PUBLIC_AZURE_SPEECH_KEY ?? '',
  azureSpeechRegion: process.env.EXPO_PUBLIC_AZURE_SPEECH_REGION ?? 'westeurope',
};

export function assertAzureConfigured(): boolean {
  return Boolean(Env.azureSpeechKey && Env.azureSpeechRegion);
}

export type LanguageCode = 'en-US' | 'fr-FR';

export const LANGUAGES: { code: LanguageCode; label: string; flag: string; ttsVoice: string }[] = [
  { code: 'en-US', label: 'English', flag: '🇺🇸', ttsVoice: 'en-US-AvaMultilingualNeural' },
  { code: 'fr-FR', label: 'Français', flag: '🇫🇷', ttsVoice: 'fr-FR-VivienneMultilingualNeural' },
];
