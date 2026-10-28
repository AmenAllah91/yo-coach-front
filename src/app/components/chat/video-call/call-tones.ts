/**
 * Audit chat 2026-10-27, calls. Ringtone (incoming call) and ringback (the caller waits), generated with Web Audio:
 * no sound file to ship. Browsers only play sound once the user has interacted with the page (a click or a key since
 * it was opened); before that the tone stays silent and the call window alone shows the call.
 */
export type CallTonePattern = 'ring' | 'ringback';

export class CallTone {
  private context?: AudioContext;
  private timer?: ReturnType<typeof setInterval>;
  private playing = false;

  start(pattern: CallTonePattern): void {
    if (this.playing) return;
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      this.context = this.context || new AudioContextClass();
      void this.context!.resume?.();
    } catch {
      return;
    }
    this.playing = true;
    const play = () => (pattern === 'ring' ? this.ringOnce() : this.ringbackOnce());
    play();
    this.timer = setInterval(play, pattern === 'ring' ? 2600 : 4000);
  }

  stop(): void {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Releases the audio context (component destroyed). */
  dispose(): void {
    this.stop();
    try {
      void this.context?.close();
    } catch {
      /* ignore */
    }
    this.context = undefined;
  }

  /** Two short bright chimes, like a phone ringing. */
  private ringOnce(): void {
    this.note([784, 988], 0, 0.32, 0.16);
    this.note([784, 988], 0.42, 0.32, 0.16);
  }

  /** One soft long tone, like a line ringing on the other side. */
  private ringbackOnce(): void {
    this.note([440, 480], 0, 1.2, 0.05);
  }

  private note(frequencies: number[], delay: number, duration: number, volume: number): void {
    const context = this.context;
    if (!context || !this.playing) return;
    const start = context.currentTime + delay;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
    gain.gain.setValueAtTime(volume, start + duration - 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(context.destination);
    for (const frequency of frequencies) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.connect(gain);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    }
  }
}
