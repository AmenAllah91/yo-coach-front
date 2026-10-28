import {
  AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CelebrationIcon, CelebrationView, celebrationHash } from './celebration';

/** Lucide paths of the summary icons (24 × 24, stroked), the same icons as the mobile app. */
const ICONS: Record<CelebrationIcon, string[]> = {
  timer: ['M10 2h4', 'M12 14l3-3', 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z'],
  'list-checks': ['m3 17 2 2 4-4', 'm3 7 2 2 4-4', 'M13 6h8', 'M13 12h8', 'M13 18h8'],
  dumbbell: [
    'M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z',
    'm2.5 21.5 1.4-1.4', 'm20.1 3.9 1.4-1.4',
    'M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z',
    'm9.6 14.4 4.8-4.8',
  ],
  flame: ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'],
  drumstick: ['M15.4 15.63a7.875 6 135 1 1 6.23-6.23 4.3 3.43 135 0 0-6.23 6.23', 'm8.29 12.71-2.6 2.6a2.5 2.5 0 1 0-1.65 4.65A2.5 2.5 0 1 0 8.7 18.3l2.59-2.59'],
  'circle-check': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'm9 12 2 2 4-4'],
  utensils: ['m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8', 'M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7', 'm2.1 21.8 6.4-6.3', 'm19 5-7 7'],
};

const CONFETTI = {
  workout: ['#44B4DF', '#0C86C8', '#8ED6F1', '#22C55E', '#F5B83D', '#0F1B2D'],
  nutrition: ['#22B573', '#84CC16', '#4ADE80', '#F97316', '#EF4444', '#FACC15'],
};

/** Medallion geometry (viewBox 168): the disc is 116 wide, the ring of meals 16 further out. */
const RING_RADIUS = 74;
const RING_STROKE = 7;

interface Particle { angle: number; speed: number; spin: number; size: number; delay: number; color: string; shape: 'strip' | 'dot' | 'leaf'; }
interface Arc { color: string; length: number; rotate: number; delay: number; duration: number; }

/** Same pseudo-random sequence for the same seed (the same burst each time the day is celebrated). */
function seeded(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Full-screen « Workout complete! » / « Day complete! » (mobile CompletionCelebrationScreen): a check drawn in a disc,
 * a short burst of confetti, a motivating message and what was done. Shown once, right after the server kept the day;
 * « Done » or Escape closes it. With « reduce motion » everything is shown at once, without confetti.
 */
@Component({
  selector: 'app-completion-celebration',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cc" [class.cc--nutrition]="view.kind === 'nutrition'" [style.--intro]="introMs + 'ms'"
         role="dialog" aria-modal="true" aria-labelledby="cc-title" aria-describedby="cc-message">
      <canvas #confetti class="cc__confetti" aria-hidden="true"></canvas>
      <div class="cc__scroll">
        <div class="cc__content">
          <div #medallion class="cc__medallion" aria-hidden="true">
            <span *ngIf="!arcs.length" class="cc__pulse"></span>
            <svg *ngIf="arcs.length" class="cc__ring" viewBox="0 0 168 168">
              <circle cx="84" cy="84" [attr.r]="ringRadius" class="cc__track"></circle>
              <circle *ngFor="let arc of arcs" cx="84" cy="84" [attr.r]="ringRadius" class="cc__arc"
                      [attr.stroke]="arc.color" [attr.stroke-dasharray]="arc.length + ' 1000'"
                      [attr.transform]="'rotate(' + arc.rotate + ' 84 84)'" [style.--arc]="arc.length + 'px'"
                      [style.animation-delay]="arc.delay + 'ms'" [style.animation-duration]="arc.duration + 'ms'"></circle>
            </svg>
            <span class="cc__disc">
              <svg viewBox="0 0 100 100"><path class="cc__check" pathLength="1" d="M29 52 L44 66 L72 37"></path></svg>
            </span>
          </div>
          <h2 id="cc-title" class="cc__title cc__reveal" style="--at: 0.32">{{ view.title }}</h2>
          <div id="cc-message">
            <p class="cc__headline cc__reveal" style="--at: 0.42">{{ view.message.headline }}</p>
            <p class="cc__body cc__reveal" style="--at: 0.5">{{ view.message.body }}</p>
          </div>
          <section class="cc__card cc__reveal" style="--at: 0.6">
            <div class="cc__card-head">
              <span class="cc__tile"><svg viewBox="0 0 24 24"><path *ngFor="let d of icon(view.summaryIcon)" [attr.d]="d"></path></svg></span>
              <span class="cc__card-copy">
                <strong>{{ view.summaryTitle }}</strong>
                <small *ngIf="view.summarySubtitle">{{ view.summarySubtitle }}</small>
              </span>
            </div>
            <div *ngIf="view.stats.length" class="cc__stats">
              <div *ngFor="let stat of view.stats" class="cc__stat">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path *ngFor="let d of icon(stat.icon)" [attr.d]="d"></path></svg>
                <strong>{{ stat.value }}</strong>
                <small>{{ stat.label }}</small>
              </div>
            </div>
            <div *ngIf="view.legend.length" class="cc__legend">
              <span *ngFor="let item of view.legend"><i [style.background]="item.color"></i>{{ item.label }}</span>
            </div>
          </section>
        </div>
      </div>
      <div class="cc__footer cc__reveal" style="--at: 0.7">
        <button #doneButton type="button" class="cc__done" (click)="close()">{{ view.doneLabel }}</button>
      </div>
    </div>
  `,
  styles: [`
    .cc {
      --cc-accent: #44B4DF; --cc-light: #5CC3EA; --cc-deep: #1E95C7; --cc-text: light-dark(#167FAE, #5cb8ea);
      --cc-glow: #E3F4FB; --cc-glow-2: #F6FBFE; --cc-tint: light-dark(#E8F6FC, #1b333c);
      position: fixed; inset: 0; z-index: 3000; display: flex; flex-direction: column;
      background: radial-gradient(ellipse 95% 70% at 50% 22%, var(--cc-glow) 0%, var(--cc-glow-2) 45%, light-dark(#fff, #1d2125) 100%);
      color: var(--yc-text-primary, light-dark(#0f1b2d, #e6ecf5)); font-family: inherit;
      animation: cc-fade 260ms ease-out both;
    }
    .cc--nutrition {
      --cc-accent: #22B573; --cc-light: #5ED69E; --cc-deep: #14955A; --cc-text: light-dark(#12804B, #67c68d);
      --cc-glow: #E2F6EB; --cc-glow-2: #F4FBF7; --cc-tint: light-dark(#E5F6EC, #193628);
    }
    /* Behind the check and the texts, as on mobile. */
    .cc__confetti { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
    .cc__scroll { position: relative; z-index: 1; flex: 1; min-height: 0; overflow-y: auto; }
    .cc__content {
      min-height: 100%; box-sizing: border-box; max-width: 468px; margin: 0 auto; padding: 12px 24px;
      display: flex; flex-direction: column; align-items: center; text-align: center;
    }
    .cc__content::before { content: ''; flex: 2; }
    .cc__content::after { content: ''; flex: 3; }

    .cc__medallion { position: relative; flex: none; width: 168px; height: 168px; display: grid; place-items: center; }
    .cc__disc {
      position: relative; width: 69%; height: 69%; border-radius: 50%; display: grid; place-items: center;
      background: linear-gradient(135deg, var(--cc-light), var(--cc-accent) 50%, var(--cc-deep));
      box-shadow: 0 12px 28px color-mix(in srgb, var(--cc-accent) 38%, transparent);
      animation: cc-pop calc(var(--intro) * 0.32) cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }
    .cc__disc svg { width: 100%; height: 100%; }
    .cc__check {
      fill: none; stroke: #fff; stroke-width: 8.5; stroke-linecap: round; stroke-linejoin: round;
      stroke-dasharray: 1; stroke-dashoffset: 0;
      animation: cc-draw calc(var(--intro) * 0.3) cubic-bezier(0.65, 0, 0.35, 1) calc(var(--intro) * 0.18) both;
    }
    .cc__pulse {
      position: absolute; width: 69%; height: 69%; border-radius: 50%; border: 3px solid var(--cc-accent);
      opacity: 0; animation: cc-pulse calc(var(--intro) * 0.55) ease-out calc(var(--intro) * 0.2) both;
    }
    .cc__ring { position: absolute; inset: 0; width: 100%; height: 100%; }
    .cc__ring circle { fill: none; stroke-width: ${RING_STROKE}; }
    .cc__track { stroke: color-mix(in srgb, var(--cc-accent) 12%, transparent); }
    .cc__arc { stroke-linecap: round; stroke-dashoffset: 0; animation-name: cc-arc; animation-timing-function: ease-in-out; animation-fill-mode: both; }

    .cc__title { margin: 30px 0 0; font-size: 30px; line-height: 1.15; letter-spacing: -0.6px; font-weight: 800; color: var(--yc-text-primary, light-dark(#0f1b2d, #e6ecf5)); }
    .cc__headline { margin: 12px 0 0; font-size: 17px; line-height: 1.35; font-weight: 700; color: var(--cc-text); }
    .cc__body { margin: 8px auto 0; max-width: 340px; font-size: 15px; line-height: 1.5; color: var(--yc-text-secondary, light-dark(#546175, #b5bac3)); }

    .cc__card {
      margin-top: 28px; width: 100%; max-width: 420px; box-sizing: border-box; padding: 14px 16px 16px; text-align: left;
      background: light-dark(#fff, #1d2125); border: 1px solid light-dark(#e6eef4, #32383d); border-radius: 20px; box-shadow: 0 10px 24px rgba(15, 27, 45, 0.06);
    }
    .cc__card-head { display: flex; align-items: center; gap: 10px; }
    .cc__tile { flex: none; width: 34px; height: 34px; border-radius: 10px; background: var(--cc-tint); display: grid; place-items: center; }
    .cc__tile svg, .cc__stat svg {
      width: 17px; height: 17px; fill: none; stroke: var(--cc-deep); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
    }
    .cc__card-copy { min-width: 0; display: flex; flex-direction: column; }
    .cc__card-copy strong {
      font-size: 15px; font-weight: 700; color: var(--yc-text-primary, light-dark(#0f1b2d, #e6ecf5));
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .cc__card-copy small { font-size: 12.5px; color: var(--yc-text-secondary, light-dark(#546175, #b5bac3)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cc__stats { margin-top: 14px; display: flex; gap: 8px; }
    .cc__stat {
      flex: 1 1 0; min-width: 0; padding: 10px 4px; border-radius: 14px; background: light-dark(#f5f8fb, #161a1e);
      display: flex; flex-direction: column; align-items: center; text-align: center; container-type: inline-size;
    }
    .cc__stat svg { width: 16px; height: 16px; }
    .cc__stat strong { margin-top: 6px; font-size: 17px; font-weight: 800; white-space: nowrap; color: var(--yc-text-primary, light-dark(#0f1b2d, #e6ecf5)); }
    /* « Comme prévu » on a 320 px phone: a little smaller rather than cut. */
    .cc__stat small {
      margin-top: 1px; max-width: 100%; font-size: clamp(10px, 15.5cqi, 12px); color: var(--yc-text-secondary, light-dark(#546175, #b5bac3));
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .cc__legend { margin-top: 12px; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 14px; }
    .cc__legend span { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--yc-text-secondary, light-dark(#546175, #b5bac3)); }
    .cc__legend i { width: 8px; height: 8px; border-radius: 50%; }

    .cc__footer { position: relative; z-index: 2; flex: none; padding: 8px 24px calc(16px + env(safe-area-inset-bottom)); display: flex; justify-content: center; }
    .cc__done {
      width: 100%; max-width: 420px; height: 56px; border: 0; border-radius: 18px; cursor: pointer;
      background: linear-gradient(90deg, var(--cc-accent), var(--cc-deep)); color: #fff;
      font: inherit; font-size: 17px; font-weight: 700; letter-spacing: 0.2px;
      box-shadow: 0 8px 18px color-mix(in srgb, var(--cc-accent) 35%, transparent);
      transition: transform 0.15s ease, filter 0.15s ease;
    }
    .cc__done:hover { filter: brightness(1.04); }
    .cc__done:active { transform: scale(0.985); }
    .cc__done:focus-visible { outline: 3px solid color-mix(in srgb, var(--cc-accent) 45%, transparent); outline-offset: 3px; }

    .cc__reveal { animation: cc-reveal calc(var(--intro) * 0.35) cubic-bezier(0.33, 1, 0.68, 1) calc(var(--intro) * var(--at)) both; }

    /* A short screen (small phone, landscape): a smaller check and title, the button stays visible. */
    @media (max-height: 699px) {
      .cc__medallion { width: 136px; height: 136px; }
      .cc__title { margin-top: 18px; font-size: 26px; }
      .cc__card { margin-top: 20px; }
    }

    @keyframes cc-fade { from { opacity: 0; } }
    @keyframes cc-pop { from { transform: scale(0); } }
    @keyframes cc-draw { from { stroke-dashoffset: 1; } }
    @keyframes cc-pulse { 0% { opacity: 0.55; transform: scale(0.85); } 100% { opacity: 0; transform: scale(1.3); } }
    @keyframes cc-arc { 0% { stroke-dashoffset: var(--arc); opacity: 0; } 1% { opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 1; } }
    @keyframes cc-reveal { from { opacity: 0; transform: translateY(14px); } }

    @media (prefers-reduced-motion: reduce) {
      .cc, .cc * { animation: none !important; transition: none !important; }
    }
  `],
})
export class CompletionCelebrationComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) view!: CelebrationView;
  @Output() done = new EventEmitter<void>();

  @ViewChild('confetti') private canvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('medallion') private medallion?: ElementRef<HTMLElement>;
  @ViewChild('doneButton') private doneButton?: ElementRef<HTMLButtonElement>;

  readonly ringRadius = RING_RADIUS;
  arcs: Arc[] = [];
  introMs = 1300;

  private closed = false;
  private frame = 0;
  private startTimer?: ReturnType<typeof setTimeout>;
  private previousOverflow = '';
  private previousFocus: Element | null = null;

  ngOnInit(): void {
    this.introMs = this.view.ring.length ? 1600 : 1300;
    this.arcs = this.buildArcs(this.view.ring);
    this.previousFocus = document.activeElement;
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.doneButton?.nativeElement.focus({ preventScroll: true }));
    if (this.reducedMotion) return;
    try { navigator.vibrate?.(30); } catch { /* not supported */ }
    this.startTimer = setTimeout(() => this.burst(), 220);
  }

  ngOnDestroy(): void {
    if (this.startTimer) clearTimeout(this.startTimer);
    cancelAnimationFrame(this.frame);
    document.body.style.overflow = this.previousOverflow;
    if (this.previousFocus instanceof HTMLElement && document.contains(this.previousFocus)) this.previousFocus.focus({ preventScroll: true });
  }

  /** « Done », Escape: closed once. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.done.emit();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') { event.preventDefault(); this.close(); }
    // The only control of the dialog keeps the focus.
    if (event.key === 'Tab') { event.preventDefault(); this.doneButton?.nativeElement.focus(); }
  }

  icon(name: CelebrationIcon): string[] { return ICONS[name] || []; }

  private get reducedMotion(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** One arc per meal, clockwise from the top, drawn one after the other (between 22 % and 82 % of the intro). */
  private buildArcs(colors: string[]): Arc[] {
    const count = colors.length;
    if (!count) return [];
    // The round caps eat into the gap: it is widened by one stroke.
    const gap = count > 1 ? (RING_STROKE * 1.9) / RING_RADIUS : 0;
    const sweep = (Math.PI * 2) / count - gap;
    const start = this.introMs * 0.22;
    const each = (this.introMs * 0.6) / count;
    return colors.map((color, i) => ({
      color,
      length: Math.max(sweep * RING_RADIUS, 0.01),
      rotate: ((-Math.PI / 2 + gap / 2 + i * (sweep + gap)) * 180) / Math.PI,
      delay: Math.round(start + i * each),
      duration: Math.round(each),
    }));
  }

  /** 42 pieces thrown up and out from behind the check, then falling, turning and fading (1.9 s). */
  private burst(): void {
    const canvas = this.canvas?.nativeElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const width = canvas.clientWidth; const height = canvas.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.scale(ratio, ratio);
    const rect = this.medallion?.nativeElement.getBoundingClientRect();
    const box = canvas.getBoundingClientRect();
    const origin = rect ? { x: rect.left + rect.width / 2 - box.left, y: rect.top + rect.height / 2 - box.top } : { x: width / 2, y: height * 0.3 };
    // Thrown mostly upwards: not much higher than the room above the check, so a short window keeps them in view.
    const reach = Math.min(Math.min(width, height) * 0.6, 380, Math.max(origin.y * 1.6, 200));
    const fall = Math.min(height, 900) * 0.32;
    const particles = this.particles();
    const started = performance.now();
    const draw = (now: number) => {
      const t = Math.min((now - started) / 1900, 1);
      context.clearRect(0, 0, width, height);
      if (t >= 1) return;
      for (const p of particles) {
        const local = Math.min(Math.max((t - p.delay) / (1 - p.delay), 0), 1);
        if (local <= 0) continue;
        const travel = (1 - Math.pow(1 - local, 3)) * p.speed * reach;
        const x = origin.x + Math.cos(p.angle) * travel;
        const y = origin.y + Math.sin(p.angle) * travel + local * local * fall;
        context.globalAlpha = local < 0.7 ? 1 : Math.max(1 - (local - 0.7) / 0.3, 0);
        context.fillStyle = p.color;
        context.save();
        context.translate(x, y);
        context.rotate(p.spin * local);
        context.beginPath();
        if (p.shape === 'dot') {
          context.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
        } else if (p.shape === 'leaf') {
          const half = p.size * 0.65; const belly = p.size * 0.42;
          context.moveTo(-half, 0);
          context.quadraticCurveTo(0, -belly, half, 0);
          context.quadraticCurveTo(0, belly, -half, 0);
        } else if (typeof context.roundRect === 'function') {
          context.roundRect(-p.size / 2, -p.size * 0.225, p.size, p.size * 0.45, 1.5);
        } else {
          context.rect(-p.size / 2, -p.size * 0.225, p.size, p.size * 0.45);
        }
        context.fill();
        context.restore();
      }
      context.globalAlpha = 1;
      this.frame = requestAnimationFrame(draw);
    };
    this.frame = requestAnimationFrame(draw);
  }

  private particles(): Particle[] {
    const random = seeded(celebrationHash(this.view.seed));
    const colors = CONFETTI[this.view.kind];
    const leaves = this.view.kind === 'nutrition';
    return Array.from({ length: 42 }, (_, i) => {
      const angle = -Math.PI / 2 + (random() - 0.5) * Math.PI * 0.85;
      const speed = 0.55 + random() * 0.6;
      const spin = (random() - 0.5) * 10;
      const size = 5 + random() * 5;
      const delay = random() * 0.12;
      const pick = random();
      const shape: Particle['shape'] = pick < 0.35 ? 'dot' : leaves && pick < 0.75 ? 'leaf' : 'strip';
      return { angle, speed, spin, size, delay, color: colors[i % colors.length], shape };
    });
  }
}
