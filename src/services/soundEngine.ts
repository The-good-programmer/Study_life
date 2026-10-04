// Web Audio API Focus Soundscape & Binaural Beats Synthesizer

export type SoundType = 
  | 'off' 
  | 'binaural-40hz' 
  | 'binaural-alpha-10hz' 
  | 'brown-noise' 
  | 'pink-noise' 
  | 'rain' 
  | 'ambient-drone';

type SoundChangeListener = (sound: SoundType, volume: number) => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private currentSound: SoundType = 'off';
  private masterGain: GainNode | null = null;
  private volume: number = 0.4;
  private activeNodes: { stop?: () => void; disconnect?: () => void }[] = [];
  private listeners: Set<SoundChangeListener> = new Set();
  private sfxEnabled: boolean = (() => {
    try {
      const stored = localStorage.getItem('axon_sfx_enabled');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  })();

  public isSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  public setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
    try {
      localStorage.setItem('axon_sfx_enabled', String(enabled));
    } catch {}
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch((err) => {
        console.debug('[SoundEngine] AudioContext resume deferred until user interaction:', err);
      });
    }
  }

  public subscribe(listener: SoundChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn(this.currentSound, this.volume));
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
    this.notify();
  }

  public getVolume(): number {
    return this.volume;
  }

  public getCurrentSound(): SoundType {
    return this.currentSound;
  }

  public stop() {
    this.activeNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch {
        // ignore already stopped nodes
      }
    });
    this.activeNodes = [];
    this.currentSound = 'off';
    this.notify();
  }

  public play(type: SoundType) {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    if (this.currentSound === type) return;
    this.stop();

    if (type === 'off') {
      return;
    }

    this.currentSound = type;
    this.notify();

    switch (type) {
      case 'binaural-40hz':
        this.playBinauralBeats(200, 40); // 200Hz base + 40Hz gamma focus soundscape
        break;
      case 'binaural-alpha-10hz':
        this.playBinauralBeats(180, 10); // 180Hz base + 10Hz alpha focus soundscape
        break;
      case 'brown-noise':
        this.playBrownNoise();
        break;
      case 'pink-noise':
        this.playPinkNoise();
        break;
      case 'rain':
        this.playRainNoise();
        break;
      case 'ambient-drone':
        this.playAmbientDrone();
        break;
    }
  }

  private playBinauralBeats(carrierFreq: number, beatFreq: number) {
    if (!this.ctx || !this.masterGain) return;

    // Left ear oscillator
    const oscLeft = this.ctx.createOscillator();
    const panLeft = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    oscLeft.type = 'sine';
    oscLeft.frequency.setValueAtTime(carrierFreq, this.ctx.currentTime);

    // Right ear oscillator (carrier + beatFreq)
    const oscRight = this.ctx.createOscillator();
    const panRight = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    oscRight.type = 'sine';
    oscRight.frequency.setValueAtTime(carrierFreq + beatFreq, this.ctx.currentTime);

    const binauralGain = this.ctx.createGain();
    binauralGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

    if (panLeft && panRight) {
      panLeft.pan.setValueAtTime(-1, this.ctx.currentTime);
      panRight.pan.setValueAtTime(1, this.ctx.currentTime);
      oscLeft.connect(panLeft).connect(binauralGain);
      oscRight.connect(panRight).connect(binauralGain);
    } else {
      oscLeft.connect(binauralGain);
      oscRight.connect(binauralGain);
    }

    binauralGain.connect(this.masterGain);

    oscLeft.start();
    oscRight.start();

    this.activeNodes.push(
      { stop: () => { oscLeft.stop(); oscRight.stop(); } },
      { disconnect: () => { binauralGain.disconnect(); } }
    );
  }

  private playBrownNoise() {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

    noiseSource.connect(filter).connect(noiseGain).connect(this.masterGain);
    noiseSource.start();

    this.activeNodes.push(
      { stop: () => noiseSource.stop() },
      { disconnect: () => noiseGain.disconnect() }
    );
  }

  private playPinkNoise() {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);

    // Paul Kellet's filtered pink noise generator
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.09;
        b6 = white * 0.115926;
      }
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const pinkGain = this.ctx.createGain();
    pinkGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

    source.connect(pinkGain).connect(this.masterGain);
    source.start();

    this.activeNodes.push(
      { stop: () => source.stop() },
      { disconnect: () => pinkGain.disconnect() }
    );
  }

  private playRainNoise() {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2) * 0.4;
      }
    }

    const rainSource = this.ctx.createBufferSource();
    rainSource.buffer = buffer;
    rainSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.Q.setValueAtTime(0.7, this.ctx.currentTime);

    const rainGain = this.ctx.createGain();
    rainGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

    rainSource.connect(filter).connect(rainGain).connect(this.masterGain);
    rainSource.start();

    this.activeNodes.push(
      { stop: () => rainSource.stop() },
      { disconnect: () => rainGain.disconnect() }
    );
  }

  private playAmbientDrone() {
    if (!this.ctx || !this.masterGain) return;

    const freqs = [174.61, 261.63, 329.63, 440.00];
    const oscillators: OscillatorNode[] = [];
    const droneGain = this.ctx.createGain();
    droneGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    freqs.forEach(freq => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.connect(droneGain);
      osc.start();
      oscillators.push(osc);
    });

    droneGain.connect(this.masterGain);

    this.activeNodes.push(
      { stop: () => oscillators.forEach(o => o.stop()) },
      { disconnect: () => droneGain.disconnect() }
    );
  }

  private scheduleTransientCleanup(gain: GainNode, oscillators: OscillatorNode[], durationMs: number) {
    oscillators.forEach(osc => {
      osc.onended = () => {
        try {
          osc.disconnect();
        } catch {
          // ignore
        }
      };
    });
    setTimeout(() => {
      try {
        gain.disconnect();
      } catch {
        // ignore
      }
    }, durationMs + 100);
  }

  public playCompletionChime() {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const chimeGain = this.ctx.createGain();
    chimeGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 3.0);

    const chimeFreqs = [528, 792, 1056];
    const oscs: OscillatorNode[] = [];
    chimeFreqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.connect(chimeGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 3.2 + (idx * 0.1));
      oscs.push(osc);
    });

    chimeGain.connect(this.masterGain);
    this.scheduleTransientCleanup(chimeGain, oscs, 3500);
  }

  /**
   * Duolingo-grade crisp bubble pop for option selection and radio taps
   */
  public playTapPop() {
    if (!this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.012);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.038);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.04);
    this.scheduleTransientCleanup(gain, [osc], 60);
  }

  /**
   * Duolingo-grade bright marimba major chord arpeggio for correct recall
   */
  public playCorrectChime() {
    if (!this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.22, now);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    masterGain.connect(this.masterGain);

    // Warm marimba arpeggio: C5 -> E5 -> G5 -> C6 with sparkle overtone
    const notes = [
      { freq: 523.25, time: 0 },
      { freq: 659.25, time: 0.055 },
      { freq: 783.99, time: 0.11 },
      { freq: 1046.50, time: 0.165 },
    ];

    const oscs: OscillatorNode[] = [];
    notes.forEach(({ freq, time }) => {
      if (!this.ctx) return;
      const noteGain = this.ctx.createGain();
      const noteStart = now + time;
      noteGain.gain.setValueAtTime(0.2, noteStart);
      noteGain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.35);

      // Fundamental triangle (marimba resonance)
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteStart);

      // Overtone sine for bell clarity
      const overtone = this.ctx.createOscillator();
      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(freq * 2, noteStart);
      const overtoneGain = this.ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.06, noteStart);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.2);

      osc.connect(noteGain);
      overtone.connect(overtoneGain);
      overtoneGain.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(noteStart);
      overtone.start(noteStart);
      osc.stop(noteStart + 0.38);
      overtone.stop(noteStart + 0.22);
      oscs.push(osc, overtone);
    });

    this.scheduleTransientCleanup(masterGain, oscs, 800);
  }

  public playComboChime(comboCount: number = 1) {
    if (!this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const chimeGain = this.ctx.createGain();
    const gainLevel = Math.min(0.24, 0.16 + (comboCount * 0.01));
    chimeGain.gain.setValueAtTime(gainLevel, this.ctx.currentTime);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.85);

    // Dynamic pitch escalation based on combo streak
    let notes: number[];
    if (comboCount <= 1) {
      notes = [523.25, 659.25]; // C5 -> E5
    } else if (comboCount === 2) {
      notes = [587.33, 739.99]; // D5 -> F#5
    } else if (comboCount === 3) {
      notes = [659.25, 830.61]; // E5 -> G#5
    } else if (comboCount === 4) {
      notes = [783.99, 987.77]; // G5 -> B5
    } else if (comboCount < 8) {
      notes = [523.25, 659.25, 783.99, 1046.50]; // C5 -> E5 -> G5 -> C6 full arpeggio
    } else {
      notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // High pentatonic sparkle cascade
    }

    const oscs: OscillatorNode[] = [];
    const interval = comboCount >= 5 ? 0.055 : 0.07;
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = comboCount >= 5 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + (idx * interval));
      osc.connect(chimeGain);
      osc.start(this.ctx.currentTime + (idx * interval));
      osc.stop(this.ctx.currentTime + 0.8);
      oscs.push(osc);
    });

    chimeGain.connect(this.masterGain);
    this.scheduleTransientCleanup(chimeGain, oscs, 900);
  }

  /**
   * Duolingo-grade muted wooden double thud for incorrect answers
   * Soft, instructive, and encouraging
   */
  public playIncorrectChime() {
    if (!this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    // Muffled wooden tap: Eb3 (155 Hz) -> C3 (130 Hz)
    [0, 0.11].forEach((delay, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const hitStart = now + delay;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, hitStart);
      gain.gain.exponentialRampToValueAtTime(0.001, hitStart + 0.18);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, hitStart);

      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 155.56 : 130.81, hitStart);
      osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 120 : 95, hitStart + 0.16);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(hitStart);
      osc.stop(hitStart + 0.19);
      this.scheduleTransientCleanup(gain, [osc], 350);
    });
  }

  /**
   * Rapid coin clinking cascade for XP collection and rewards
   */
  public playCoinCascade() {
    if (!this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.18, now);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    masterGain.connect(this.masterGain);

    const coinPitches = [1318.51, 1567.98, 1975.53, 2637.02]; // E6, G6, B6, E7
    const oscs: OscillatorNode[] = [];
    coinPitches.forEach((freq, idx) => {
      if (!this.ctx) return;
      const coinStart = now + (idx * 0.05);
      const noteGain = this.ctx.createGain();
      noteGain.gain.setValueAtTime(0.18, coinStart);
      noteGain.gain.exponentialRampToValueAtTime(0.001, coinStart + 0.2);

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, coinStart);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(coinStart);
      osc.stop(coinStart + 0.22);
      oscs.push(osc);
    });

    this.scheduleTransientCleanup(masterGain, oscs, 600);
  }

  public playSocraticChallengeChime() {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const chimeGain = this.ctx.createGain();
    chimeGain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.8);

    const oscs: OscillatorNode[] = [];
    // Warm resonant dual tone (A4 + E5 harmonic resonance)
    [440, 659.25, 880].forEach((freq) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.connect(chimeGain);
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 1.85);
      oscs.push(osc);
    });

    chimeGain.connect(this.masterGain);
    this.scheduleTransientCleanup(chimeGain, oscs, 2000);
  }

  public playVerdictGavel() {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    // Resonant wooden gavel double strike
    [0, 0.18].forEach(offset => {
      if (!this.ctx || !this.masterGain) return;
      const hitGain = this.ctx.createGain();
      hitGain.gain.setValueAtTime(0.35, this.ctx.currentTime + offset);
      hitGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + offset + 0.15);

      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime + offset);
      osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + offset + 0.14);
      osc.connect(hitGain);
      hitGain.connect(this.masterGain);

      osc.start(this.ctx.currentTime + offset);
      osc.stop(this.ctx.currentTime + offset + 0.16);

      this.scheduleTransientCleanup(hitGain, [osc], (offset + 0.2) * 1000);
    });
  }

  public playContextShiftSound() {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const shiftGain = this.ctx.createGain();
    shiftGain.gain.setValueAtTime(0.16, this.ctx.currentTime);
    shiftGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.5);

    const oscs: OscillatorNode[] = [];
    // Fast ascending triad arpeggio (C5 -> E5 -> G5 -> C6)
    const pitches = [523.25, 659.25, 783.99, 1046.50];
    pitches.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + (idx * 0.04));
      osc.connect(shiftGain);
      osc.start(this.ctx.currentTime + (idx * 0.04));
      osc.stop(this.ctx.currentTime + 0.5);
      oscs.push(osc);
    });

    shiftGain.connect(this.masterGain);
    this.scheduleTransientCleanup(shiftGain, oscs, 600);
  }

  public playSuccess() {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.6);

    const oscs: OscillatorNode[] = [];
    // Uplifting major chord (E5 -> G#5 -> B5)
    [659.25, 830.61, 987.77].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.05);
      osc.connect(gain);
      osc.start(this.ctx.currentTime + idx * 0.05);
      osc.stop(this.ctx.currentTime + 0.6);
      oscs.push(osc);
    });

    gain.connect(this.masterGain);
    this.scheduleTransientCleanup(gain, oscs, 700);
  }

  public playStart() {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.5);

    const oscs: OscillatorNode[] = [];
    // Warm ascending initiation tone (C4 -> G4)
    [261.63, 392.00].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);
      osc.connect(gain);
      osc.start(this.ctx.currentTime + idx * 0.08);
      osc.stop(this.ctx.currentTime + 0.5);
      oscs.push(osc);
    });

    gain.connect(this.masterGain);
    this.scheduleTransientCleanup(gain, oscs, 600);
  }

  public playAxolotlBubble() {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.18);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    // Frequency sweeps up then down like a real bubble pop
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(780, this.ctx.currentTime + 0.07);
    osc.frequency.exponentialRampToValueAtTime(420, this.ctx.currentTime + 0.17);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.18);

    this.scheduleTransientCleanup(gain, [osc], 250);
  }

  public playAxolotlChirp() {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.35);

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'triangle';

    // Playful ascending squeak / chirp
    osc1.frequency.setValueAtTime(740, this.ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(1480, this.ctx.currentTime + 0.18);
    osc1.frequency.exponentialRampToValueAtTime(1100, this.ctx.currentTime + 0.32);

    osc2.frequency.setValueAtTime(1100, this.ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(2200, this.ctx.currentTime + 0.18);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(this.ctx.currentTime);
    osc2.start(this.ctx.currentTime);
    osc1.stop(this.ctx.currentTime + 0.35);
    osc2.stop(this.ctx.currentTime + 0.25);

    this.scheduleTransientCleanup(gain, [osc1, osc2], 400);
  }

  public playAxolotlChomp() {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    // Two small aquatic nibbles
    [0, 0.12].forEach((offset, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + offset + 0.09);

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 440 : 550, this.ctx.currentTime + offset);
      osc.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + offset + 0.08);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(this.ctx.currentTime + offset);
      osc.stop(this.ctx.currentTime + offset + 0.09);

      this.scheduleTransientCleanup(gain, [osc], (offset + 0.15) * 1000);
    });
  }

  public playAxolotlPurr() {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);

    // AM modulation for purr flutter
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(18, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(30, this.ctx.currentTime);
    lfo.connect(osc.frequency);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(this.ctx.currentTime);
    lfo.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.8);
    lfo.stop(this.ctx.currentTime + 0.8);

    this.scheduleTransientCleanup(gain, [osc, lfo], 900);
  }
}

export const soundEngine = new SoundEngine();
