type GainNodePair = {
  input: GainNode;
  output: GainNode;
};

export type MusicPresetId = "calm" | "rainy" | "woodland";
export type SoundEffectPresetId = "soft" | "woodClick";

export type AudioPreset<T extends string> = {
  id: T;
  label: string;
};

export const MUSIC_PRESETS: AudioPreset<MusicPresetId>[] = [
  { id: "calm", label: "静かな思考" },
  { id: "rainy", label: "雨の日の盤面" },
  { id: "woodland", label: "木漏れ日の研究" },
];

export const SOUND_EFFECT_PRESETS: AudioPreset<SoundEffectPresetId>[] = [
  { id: "woodClick", label: "木駒パチッ" },
  { id: "soft", label: "やわらかめ" },
];

const musicFiles: Record<MusicPresetId, string> = {
  calm: "./audio/calm-joseki-loop.wav",
  rainy: "./audio/rainy-board-loop.wav",
  woodland: "./audio/woodland-study-loop.wav",
};

const sampleEffectFiles = {
  place: "./audio/se-place-wood-click.wav",
  flip: "./audio/se-flip-wood-click.wav",
} as const;

export class AudioEngine {
  private context: AudioContext | null = null;
  private se: GainNodePair | null = null;
  private music: GainNodePair | null = null;
  private musicBuffers = new Map<MusicPresetId, AudioBuffer>();
  private musicSource: AudioBufferSourceNode | null = null;
  private musicLoading = new Map<MusicPresetId, Promise<AudioBuffer>>();
  private effectBuffers = new Map<string, AudioBuffer>();
  private effectLoading = new Map<string, Promise<AudioBuffer>>();
  private musicEnabled = false;
  private seEnabled = true;
  private musicPreset: MusicPresetId = "calm";
  private soundEffectPreset: SoundEffectPresetId = "woodClick";

  setSoundEffectsEnabled(enabled: boolean) {
    this.seEnabled = enabled;
    if (this.se) {
      this.se.output.gain.setTargetAtTime(
        enabled ? 0.72 : 0,
        this.now(),
        0.025,
      );
    }
  }

  setSoundEffectPreset(preset: SoundEffectPresetId) {
    this.soundEffectPreset = preset;
  }

  setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
      return;
    }
    void this.ensureStarted().then(() => this.startMusic());
  }

  setMusicPreset(preset: MusicPresetId) {
    if (this.musicPreset === preset) return;
    this.musicPreset = preset;
    if (!this.musicEnabled) return;
    this.stopMusic();
    void this.ensureStarted().then(() => this.startMusic());
  }

  async playPlace() {
    if (!this.seEnabled) return;
    await this.ensureStarted();
    const context = this.context;
    const se = this.se;
    if (!context || !se) return;

    if (this.soundEffectPreset === "woodClick") {
      await this.playSampleEffect("place", 0.72, 0);
      return;
    }

    const now = context.currentTime;
    const thump = context.createOscillator();
    const tone = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    thump.type = "sine";
    tone.type = "triangle";
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(760, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.11);
    thump.frequency.setValueAtTime(180, now);
    thump.frequency.exponentialRampToValueAtTime(58, now + 0.12);
    tone.frequency.setValueAtTime(520, now);
    tone.frequency.exponentialRampToValueAtTime(210, now + 0.07);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.54, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    thump.connect(filter);
    tone.connect(filter);
    filter.connect(gain);
    gain.connect(se.input);
    thump.start(now);
    tone.start(now + 0.005);
    thump.stop(now + 0.18);
    tone.stop(now + 0.12);
  }

  async playFlip(count: number) {
    if (!this.seEnabled) return;
    await this.ensureStarted();
    const context = this.context;
    const se = this.se;
    if (!context || !se) return;

    const flips = Math.max(1, Math.min(count, 8));
    if (this.soundEffectPreset === "woodClick") {
      for (let index = 0; index < flips; index += 1) {
        await this.playSampleEffect(
          "flip",
          Math.max(0.24, 0.5 - index * 0.026),
          index * 0.035,
          index % 2 === 0 ? -0.16 : 0.16,
        );
      }
      return;
    }

    for (let index = 0; index < flips; index += 1) {
      const start = context.currentTime + index * 0.035;
      const osc = context.createOscillator();
      const noise = this.createNoiseBurst();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      const pan = context.createStereoPanner();

      osc.type = "square";
      osc.frequency.setValueAtTime(320 + index * 24, start);
      osc.frequency.exponentialRampToValueAtTime(138, start + 0.09);
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1550, start);
      filter.Q.setValueAtTime(5, start);
      pan.pan.setValueAtTime(index % 2 === 0 ? -0.18 : 0.18, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);

      noise.connect(filter);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(pan);
      pan.connect(se.input);
      noise.start(start);
      osc.start(start);
      noise.stop(start + 0.11);
      osc.stop(start + 0.12);
    }
  }

  async ensureStarted() {
    const context = this.getContext();
    if (context.state !== "running") {
      await context.resume();
    }
  }

  private getContext() {
    if (this.context) return this.context;

    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = 0.82;
    master.connect(context.destination);

    const seInput = context.createGain();
    const seOutput = context.createGain();
    seOutput.gain.value = this.seEnabled ? 0.72 : 0;
    seInput.connect(seOutput);
    seOutput.connect(master);

    const musicInput = context.createGain();
    const musicOutput = context.createGain();
    musicOutput.gain.value = 0;
    musicInput.connect(musicOutput);
    musicOutput.connect(master);

    this.context = context;
    this.se = { input: seInput, output: seOutput };
    this.music = { input: musicInput, output: musicOutput };
    return context;
  }

  private async startMusic() {
    if (!this.musicEnabled || this.musicSource) return;
    const context = this.getContext();
    const music = this.music;
    if (!music) return;

    const buffer = await this.loadMusicBuffer(this.musicPreset);
    if (!this.musicEnabled || this.musicSource) return;

    const now = context.currentTime;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const compressor = context.createDynamicsCompressor();
    source.buffer = buffer;
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = 4200;
    filter.Q.value = 0.45;
    source.connect(filter);
    filter.connect(compressor);
    compressor.connect(music.input);
    music.output.gain.cancelScheduledValues(now);
    music.output.gain.setValueAtTime(0.0001, now);
    music.output.gain.exponentialRampToValueAtTime(0.42, now + 1.2);
    source.start(now);
    this.musicSource = source;
  }

  private stopMusic() {
    const context = this.context;
    const music = this.music;
    if (!context || !music) return;
    const now = context.currentTime;
    music.output.gain.cancelScheduledValues(now);
    music.output.gain.setTargetAtTime(0.0001, now, 0.4);
    const source = this.musicSource;
    this.musicSource = null;
    if (source) {
      window.setTimeout(() => {
        try {
          source.stop();
        } catch {
          // Already stopped.
        }
      }, 700);
    }
  }

  private async loadMusicBuffer(preset: MusicPresetId) {
    const loaded = this.musicBuffers.get(preset);
    if (loaded) return loaded;
    const loading = this.musicLoading.get(preset);
    if (loading) return loading;
    const context = this.getContext();
    const promise = fetch(musicFiles[preset])
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load BGM: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((buffer) => context.decodeAudioData(buffer))
      .then((buffer) => {
        this.musicBuffers.set(preset, buffer);
        return buffer;
      });
    this.musicLoading.set(preset, promise);
    return promise;
  }

  private async playSampleEffect(
    kind: keyof typeof sampleEffectFiles,
    volume: number,
    delay: number,
    panValue = 0,
  ) {
    const context = this.getContext();
    const se = this.se;
    if (!se) return;
    const buffer = await this.loadEffectBuffer(kind);
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const pan = context.createStereoPanner();

    source.buffer = buffer;
    source.connect(gain);
    gain.connect(pan);
    pan.connect(se.input);
    gain.gain.setValueAtTime(volume, start);
    pan.pan.setValueAtTime(panValue, start);
    source.start(start);
  }

  private async loadEffectBuffer(kind: keyof typeof sampleEffectFiles) {
    const loaded = this.effectBuffers.get(kind);
    if (loaded) return loaded;
    const loading = this.effectLoading.get(kind);
    if (loading) return loading;
    const context = this.getContext();
    const promise = fetch(sampleEffectFiles[kind])
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load SE: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((buffer) => context.decodeAudioData(buffer))
      .then((buffer) => {
        this.effectBuffers.set(kind, buffer);
        return buffer;
      });
    this.effectLoading.set(kind, promise);
    return promise;
  }

  private createNoiseBurst() {
    const context = this.getContext();
    const sampleRate = context.sampleRate;
    const buffer = context.createBuffer(
      1,
      Math.floor(sampleRate * 0.12),
      sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      const fade = 1 - index / data.length;
      data[index] = (Math.random() * 2 - 1) * fade * fade;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  private now() {
    return this.context?.currentTime ?? 0;
  }
}
