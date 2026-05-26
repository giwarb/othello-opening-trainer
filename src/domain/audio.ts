type GainNodePair = {
  input: GainNode;
  output: GainNode;
};

export class AudioEngine {
  private context: AudioContext | null = null;
  private se: GainNodePair | null = null;
  private music: GainNodePair | null = null;
  private musicNodes: AudioNode[] = [];
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

  private startMusic() {
    if (!this.musicEnabled || this.musicNodes.length > 0) return;
    const context = this.getContext();
    const music = this.music;
    if (!music) return;

    const now = context.currentTime;
    const compressor = context.createDynamicsCompressor();
    const filter = context.createBiquadFilter();
    const delay = context.createDelay();
    const delayGain = context.createGain();
    const dryGain = context.createGain();
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();

    filter.type = "lowpass";
    filter.frequency.value = 980;
    filter.Q.value = 0.7;
    delay.delayTime.value = 0.42;
    delayGain.gain.value = 0.16;
    dryGain.gain.value = 0.55;
    lfo.type = "sine";
    lfo.frequency.value = 0.045;
    lfoGain.gain.value = 130;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    filter.connect(dryGain);
    filter.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(delay);
    dryGain.connect(compressor);
    delayGain.connect(compressor);
    compressor.connect(music.input);

    const notes = [196, 246.94, 293.66, 369.99, 440];
    const nodes: AudioNode[] = [
      compressor,
      filter,
      delay,
      delayGain,
      dryGain,
      lfo,
      lfoGain,
    ];

    for (const [index, frequency] of notes.entries()) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      const pan = context.createStereoPanner();
      osc.type = index % 2 === 0 ? "sine" : "triangle";
      osc.frequency.value = frequency;
      osc.detune.value = (index - 2) * 3;
      gain.gain.value = 0.045;
      pan.pan.value = (index - 2) * 0.18;
      osc.connect(gain);
      gain.connect(pan);
      pan.connect(filter);
      osc.start(now + index * 0.03);
      nodes.push(osc, gain, pan);
    }

    music.output.gain.cancelScheduledValues(now);
    music.output.gain.setValueAtTime(0.0001, now);
    music.output.gain.exponentialRampToValueAtTime(0.34, now + 1.5);
    lfo.start(now);
    this.musicNodes = nodes;
  }

  private stopMusic() {
    const context = this.context;
    const music = this.music;
    if (!context || !music) return;
    const now = context.currentTime;
    music.output.gain.cancelScheduledValues(now);
    music.output.gain.setTargetAtTime(0.0001, now, 0.4);
    for (const node of this.musicNodes) {
      if ("stop" in node) {
        window.setTimeout(() => {
          try {
            (node as OscillatorNode | AudioBufferSourceNode).stop();
          } catch {
            // Already stopped.
          }
        }, 700);
      }
    }
    this.musicNodes = [];
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
