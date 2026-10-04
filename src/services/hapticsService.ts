// Mobile Vibration & Micro-Haptic Feedback Engine for Duolingo-Grade Tactile Physicality

class HapticsService {
  private enabled: boolean = (() => {
    try {
      const stored = localStorage.getItem('axon_haptics_enabled');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  })();

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator;
  }

  public isEnabled(): boolean {
    return this.enabled && this.isSupported();
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    try {
      localStorage.setItem('axon_haptics_enabled', String(val));
    } catch {}
  }

  private vibrate(pattern: number | number[]): void {
    if (!this.isEnabled()) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Safe fallback on unsupported or restricted browsers
    }
  }

  /** Ultra-subtle crisp micro-tick (8ms) for option selection and radio taps */
  public pop() {
    this.vibrate(8);
  }

  /** Subtle tick (10ms) for buttons and navigational clicks */
  public light() {
    this.vibrate(10);
  }

  /** Distinct tactile mechanical pulse (16ms) for card flip or modal open */
  public medium() {
    this.vibrate(16);
  }

  /** Double pleasant bouncy pulse for correct answers and quest progress */
  public success() {
    this.vibrate([12, 35, 18]);
  }

  /** Muffled low double pulse for incorrect answers or "Again" reviews */
  public warning() {
    this.vibrate([18, 40, 22]);
  }

  /** Dynamic combo escalation pulse: intensifies as combo increases */
  public combo(streak: number = 1) {
    if (streak <= 2) {
      this.vibrate([10, 25, 15]);
    } else if (streak <= 5) {
      this.vibrate([12, 20, 15, 25, 20]);
    } else {
      this.vibrate([15, 18, 18, 20, 22, 25, 30]);
    }
  }

  /** Celebratory fanfare rhythm for streak milestones and session completion */
  public celebrate() {
    this.vibrate([15, 35, 20, 40, 30, 60, 45]);
  }

  /** Warm pulse when collecting coins or leveling up */
  public coin() {
    this.vibrate([10, 20, 12]);
  }
}

export const haptics = new HapticsService();
