/**
 * BOLD AI — Microphone recorder wrapper (expo-av).
 *
 * Records WAV at 16kHz mono 16-bit PCM, the exact format Azure Pronunciation
 * Assessment expects, so no transcoding is needed before upload.
 */
import { Audio } from 'expo-av';

const AZURE_WAV_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  ios: {
    extension: '.wav',
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
  },
  web: {
    mimeType: 'audio/wav',
    bitsPerSecond: 256000,
  },
};

export class Recorder {
  private recording: Audio.Recording | null = null;

  async requestPermission(): Promise<boolean> {
    const { granted } = await Audio.requestPermissionsAsync();
    return granted;
  }

  async start(onMeter?: (level: number) => void): Promise<void> {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(AZURE_WAV_OPTIONS);
    if (onMeter) {
      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && typeof status.metering === 'number') {
          // metering is dBFS (-160..0); normalise to 0..1 for the waveform UI.
          const normalized = Math.max(0, Math.min(1, (status.metering + 60) / 60));
          onMeter(normalized);
        }
      });
      recording.setProgressUpdateInterval(80);
    }
    await recording.startAsync();
    this.recording = recording;
  }

  /** Stop and return the local file URI of the recorded WAV. */
  async stop(): Promise<string> {
    if (!this.recording) throw new Error('Not recording');
    await this.recording.stopAndUnloadAsync();
    const uri = this.recording.getURI();
    this.recording = null;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    if (!uri) throw new Error('Recording produced no file');
    return uri;
  }

  async cancel(): Promise<void> {
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch {
        /* ignore */
      }
      this.recording = null;
    }
  }

  get isRecording(): boolean {
    return this.recording !== null;
  }
}
