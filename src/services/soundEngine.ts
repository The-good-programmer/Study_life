// Web Audio API Focus Soundscape & Binaural Beats Synthesizer

export type SoundType = 'off' | 'binaural-40hz' | 'brown-noise' | 'rain' | 'ambient-drone';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private currentSound: SoundType = 'off';
  private masterGain: GainNode | null = null;
  private volume: number = 0.4;
  private activeNodes: { stop?: () => void; disconnect?: () => void }[] = [];

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
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

    switch (type) {
      case 'binaural-40hz':
        this.playBinauralBeats(200, 40); // 200Hz base + 40Hz gamma entrainment
        break;
      case 'brown-noise':
        this.playBrownNoise();
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

    // Right ear oscillator (carrier + 40Hz)
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

    // 5 seconds looping brownian noise buffer
    const bufferSize = this.ctx.sampleRate * 5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // Gain compensation
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    // Gentle low-pass warm filter
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

  private playRainNoise() {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    
    // Pinkish/rain noise in stereo
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

    // Warm peaceful drone (F, C, A, E - rich meditative chord)
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

  // Play peaceful completion bell sound when student finishes a phase
  public playCompletionChime() {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const chimeGain = this.ctx.createGain();
    chimeGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 3.0);

    const chimeFreqs = [528, 792, 1056]; // Solfeggio 528Hz resonance + harmonics
    chimeFreqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.connect(chimeGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 3.2 + (idx * 0.1));
    });

    chimeGain.connect(this.masterGain);
  }
}

export const soundEngine = new SoundEngine();
