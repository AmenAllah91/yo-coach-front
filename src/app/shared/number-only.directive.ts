import { Directive, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';

/**
 * Ne garde que ce qui fait un nombre. Entier : 4 chiffres au plus. Décimal : 4 chiffres, puis une virgule ou un point,
 * puis 2 chiffres au plus (mêmes règles que les champs de l'appli mobile).
 */
export function cleanNumberText(text: string, decimal: boolean): string {
  const raw = String(text ?? '');
  if (!decimal) return raw.replace(/\D/g, '').slice(0, 4);
  const kept = raw.replace(/[^\d.,]/g, '');
  const at = kept.search(/[.,]/);
  if (at < 0) return kept.slice(0, 4);
  return kept.slice(0, at).slice(0, 4) + kept[at] + kept.slice(at + 1).replace(/[.,]/g, '').slice(0, 2);
}

/**
 * Champ de nombre : les lettres et les signes ne s'écrivent pas (frappe, collage, glisser-déposer).
 * `appNumberOnly="decimal"` accepte une virgule ou un point.
 */
@Directive({ selector: 'input[appNumberOnly]', standalone: true })
export class NumberOnlyDirective implements OnInit, OnDestroy {
  @Input() appNumberOnly: '' | 'int' | 'decimal' = 'int';

  constructor(private host: ElementRef<HTMLInputElement>) {}

  /** En phase de capture : le champ est nettoyé avant que ngModel ou `(input)` ne lise sa valeur. */
  private readonly onInput = (): void => {
    const input = this.host.nativeElement;
    const decimal = this.appNumberOnly === 'decimal';
    const clean = cleanNumberText(input.value, decimal);
    if (clean === input.value) return;
    const caret = cleanNumberText(input.value.slice(0, input.selectionStart ?? input.value.length), decimal).length;
    input.value = clean;
    try { input.setSelectionRange(caret, caret); } catch { /* champ sans curseur */ }
  };

  ngOnInit(): void { this.host.nativeElement.addEventListener('input', this.onInput, true); }
  ngOnDestroy(): void { this.host.nativeElement.removeEventListener('input', this.onInput, true); }
}
