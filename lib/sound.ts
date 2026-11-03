// lib/sound.ts
// Cross-browser Web Audio API Notification Sound Synthesizer
// Provides zero-dependency, ultra-low latency notification and login sounds.

class SoundService {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("brainzima_sound_muted");
        this.isMuted = saved === "true";
      } catch {
        this.isMuted = false;
      }
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!this.audioCtx || this.audioCtx.state === "closed") {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  public isSoundMuted(): boolean {
    return this.isMuted;
  }

  public setSoundMuted(muted: boolean): void {
    this.isMuted = muted;
    try {
      localStorage.setItem("brainzima_sound_muted", muted ? "true" : "false");
    } catch {
      /* ignore storage error */
    }
  }

  /**
   * Plays a crisp high-fidelity notification chime (E5 -> A5 -> E6).
   */
  public playNotificationChime(): void {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      this.playTone(ctx, 659.25, now, 0.12, 0.14); // E5
      this.playTone(ctx, 880.0, now + 0.07, 0.14, 0.16); // A5
      this.playTone(ctx, 1318.51, now + 0.15, 0.35, 0.18); // E6
    } catch (e) {
      console.warn("[Sound] Notification sound playback notice:", e);
    }
  }

  /**
   * Plays a warm ascending celebration chime on user login (C5 -> E5 -> G5 -> C6).
   */
  public playLoginChime(): void {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      this.playTone(ctx, 523.25, now, 0.15, 0.12); // C5
      this.playTone(ctx, 659.25, now + 0.09, 0.16, 0.14); // E5
      this.playTone(ctx, 783.99, now + 0.18, 0.2, 0.16); // G5
      this.playTone(ctx, 1046.5, now + 0.28, 0.45, 0.2); // C6
    } catch (e) {
      console.warn("[Sound] Login chime playback notice:", e);
    }
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    gainLevel: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainLevel, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}

export const soundManager = new SoundService();
export const playNotificationSound = () => soundManager.playNotificationChime();
export const playLoginSound = () => soundManager.playLoginChime();
