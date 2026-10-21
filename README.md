# BOLD AI 🎙️

Pronunciation coaching that fuses **BoldVoice-style granular phonetic feedback** with an
**Anki-style Spaced Repetition System** — driven entirely by **Azure Pronunciation Assessment**
and running at **$0/month** on fully on-device storage.

Built with **React Native + Expo (SDK 54)**, `react-native-reanimated` for 60fps animation, and
SQLite for local persistence. English (`en-US`) and French (`fr-FR`) supported.

---

## ✨ Features

| # | Feature | Where |
|---|---------|-------|
| A | **Granular phonetic analysis** — Accuracy / Fluency / Completeness / Pronunciation, color-coded by word & phoneme | `src/services/azurePronunciation.ts`, `src/components/PhoneticText.tsx` |
| B | **Visual articulation guides** — tongue/teeth/lip placement for failed phonemes | `src/data/articulationGuides.ts` |
| C | **Automated SRS** — spacing dictated purely by the Azure score (no self-grading) | `src/srs/srsEngine.ts`, `src/db/cardsRepo.ts` |
| D | **Document shadowing** — local PDF/ePub text extraction → sentence cards, Azure TTS reference voice | `src/services/documentParser.ts`, `src/services/azureTts.ts` |
| E | **Multi-language toggle** — EN ⇄ FR, persisted | `src/state/LanguageContext.tsx` |
| — | **Retention loop** — daily streak, daily goal, haptics, waveform/score animations | `src/db/streaksRepo.ts`, `src/components/*` |

## 🗂️ Project structure

```
app/                      # expo-router screens
  _layout.tsx             # root: DB init, providers, nav stack
  index.tsx               # Dashboard (streak + goal + due cards + weak phonemes)
  shadowing.tsx           # Shadowing Studio (listen → hold-to-record → score)
  import.tsx              # PDF/ePub import → SRS cards
src/
  config/env.ts           # Azure creds + language table
  theme/theme.ts          # design system (colors, spacing, scoreColor())
  db/
    schema.ts             # SQLite DDL (cards, reviews, phoneme_scores, docs, streaks)
    database.ts           # open + migrate singleton
    cardsRepo.ts          # cards + reviews + weak-phoneme queries
    streaksRepo.ts        # streak & daily-goal logic
  srs/
    srsEngine.ts          # pure SM-2 engine driven by Azure score
    srsEngine.test.ts     # node:test unit tests
  services/
    azurePronunciation.ts # REST pronunciation assessment (Expo Go compatible)
    azureTts.ts           # REST TTS reference voice (cached to disk)
    recorder.ts           # expo-av WAV recorder @16kHz for Azure
    documentParser.ts     # pure-JS PDF + ePub extraction
  components/             # ScoreRing, PhoneticText, WaveformLoader, HoldToRecordButton, StreakCard, LanguageToggle
  state/                  # LanguageContext
  data/                   # articulationGuides
  utils/                  # haptics
```

## 🚀 Setup

```bash
npm install
cp .env.example .env     # add your Azure Speech key + region
npx expo start
```

### Azure (Free Tier F0 — $0/month)
1. Create a **Speech** resource in the Azure portal, pricing tier **F0 (Free)**.
2. Copy the **Key** and **Region** into `.env`:
   ```
   EXPO_PUBLIC_AZURE_SPEECH_KEY=xxxxxxxx
   EXPO_PUBLIC_AZURE_SPEECH_REGION=westeurope
   ```
   F0 includes ~5 audio hours/month of Pronunciation Assessment + 0.5M neural TTS chars/month.

## ⚠️ Expo Go vs. dev build

This app uses the Azure **REST** API and **pure-JS** document parsing specifically so the full
flow runs inside the standard **Expo Go** app — no custom native modules required. Microphone
recording works in Expo Go via `expo-av`.

> If you later want the native Azure Speech SDK (streaming/real-time) or OCR for scanned PDFs,
> switch to a **custom dev client** (`npx expo run:ios` / EAS dev build) — still free, still
> on-device, just not the vanilla Expo Go sandbox.

## 🧠 How the SRS is driven by pronunciation

The learner never grades themselves. The Azure pronunciation score maps to an SM-2 quality:

| Azure score | Grade | Effect |
|-------------|-------|--------|
| `< 70` | fail | due again **today**, lapse++ |
| `70–84` | hard | short interval |
| `85–94` | good | standard interval (≥7 days once learned) |
| `≥ 95` | easy | long interval |

See `src/srs/srsEngine.ts`. Pure & unit-tested: `npm run typecheck` then
`npx tsx --test src/srs/srsEngine.test.ts`.

## 🔐 Security note
For production, proxy Azure calls through a tiny serverless function so the subscription key
never ships inside the app bundle. The `EXPO_PUBLIC_` key approach here keeps the free dev build
fully client-side.
