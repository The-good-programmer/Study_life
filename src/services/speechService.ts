// Browser-native Socratic Voice Tutor (Zero Latency & 100% Private Speech Synthesis)

type SpeechListener = (isSpeaking: boolean) => void;

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private listeners: Set<SpeechListener> = new Set();
  private speakingState: boolean = false;
  private speechRate: number = 1.0;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => {
          this.initVoices();
        };
      }
    }
  }

  private initVoices() {
    if (!this.synth) return;
    try {
      const v = this.synth.getVoices();
      if (v && v.length > 0) {
        this.cachedVoices = v;
      }
    } catch {
      // ignore
    }
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.cachedVoices.length === 0 && this.synth) {
      this.initVoices();
    }
    return this.cachedVoices;
  }

  public subscribe(listener: SpeechListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setSpeaking(state: boolean) {
    this.speakingState = state;
    this.listeners.forEach(fn => fn(state));
  }

  public isSpeaking(): boolean {
    return this.speakingState || (this.synth?.speaking ?? false);
  }

  public getCurrentUtterance(): SpeechSynthesisUtterance | null {
    return this.currentUtterance;
  }

  public setRate(rate: number) {
    this.speechRate = Math.max(0.75, Math.min(2.0, rate));
  }

  public getRate(): number {
    return this.speechRate;
  }

  public pause() {
    if (this.synth && this.synth.speaking) {
      this.synth.pause();
      this.setSpeaking(false);
    }
  }

  public resume() {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
      this.setSpeaking(true);
    }
  }

  private clearKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  public stop() {
    this.clearKeepAlive();
    if (!this.synth) return;
    try {
      this.synth.cancel();
    } catch {
      // ignore
    }
    this.setSpeaking(false);
    this.currentUtterance = null;
  }

  public speak(text: string, onDone?: () => void) {
    if (!this.synth) return;
    this.stop();

    const cleanText = text
      .replace(/\$[^$]+\$/g, 'formula') // replace LaTeX formulas for natural reading
      .replace(/[*_#`]/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = this.speechRate;
    utterance.pitch = 1.0;

    // Pick the best natural English voice from cached or fresh voices
    const voices = this.getVoices();
    const naturalVoice = voices.find(v => 
      v.lang.startsWith('en') && 
      (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Karen'))
    ) || voices.find(v => v.lang.startsWith('en'));

    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onstart = () => {
      this.setSpeaking(true);
      // Chromium bugfix: speech synthesis can stall after ~14 seconds unless briefly poked
      this.clearKeepAlive();
      this.keepAliveTimer = setInterval(() => {
        if (this.synth && this.synth.speaking && !this.synth.paused) {
          this.synth.pause();
          this.synth.resume();
        }
      }, 10000);
    };

    utterance.onend = () => {
      this.clearKeepAlive();
      this.setSpeaking(false);
      this.currentUtterance = null;
      if (onDone) onDone();
    };

    utterance.onerror = () => {
      this.clearKeepAlive();
      this.setSpeaking(false);
      this.currentUtterance = null;
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }
}

export const speechService = new SpeechService();
