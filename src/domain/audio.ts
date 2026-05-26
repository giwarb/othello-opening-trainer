type GainNodePair = {
  input: GainNode;
  output: GainNode;
};

export class AudioEngine {
  private context: AudioContext | null = null;
  private se: GainNodePair | null = null;
  private music: GainNodePair | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicLoading: Promise<AudioBuffer> | null = null;
  private musicEnabled = false;
  private seEnabled = true;

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

  setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
      return;
    }
    void this.ensureStarted().then(() => this.startMusic());
  }

  async playPlace() {
    if (!this.seEnabled) return;
    await this.ensureStarted();
    const context = this.context;
    const se = this.se;
    if (!context || !se) return;

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

    const buffer = await this.loadMusicBuffer();
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

  private async loadMusicBuffer() {
    if (this.musicBuffer) return this.musicBuffer;
    if (this.musicLoading) return this.musicLoading;
    const context = this.getContext();
    this.musicLoading = fetch("./audio/calm-joseki-loop.wav")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load BGM: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((buffer) => context.decodeAudioData(buffer))
      .then((buffer) => {
        this.musicBuffer = buffer;
        return buffer;
      });
    return this.musicLoading;
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
