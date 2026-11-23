/**
 * Garde le jour ouvert visible dans « Structure du programme » (liste de gauche des éditeurs de séances et de
 * nutrition). Quand on ouvre un jour depuis le calendrier, les flèches ou au chargement, la liste défile jusqu'à lui,
 * seulement s'il est caché, et sans faire bouger la page. À appeler dans ngAfterViewChecked.
 *
 *   private readonly rail = new ActiveDayRail(() => this.host.nativeElement);
 *   ngAfterViewChecked(): void { this.rail.follow(this.selectedDay, this.mobileStructureOpen); }
 */
export class ActiveDayRail {
  /** Jour déjà amené à l'écran (on ne défile qu'au changement de jour). */
  private shownKey: unknown = undefined;
  private listWasOpen = false;

  constructor(private readonly host: () => HTMLElement) {}

  /** `key` : ce qui identifie le jour ouvert. `mobileListOpen` : la liste de téléphone vient de s'ouvrir → on y défile. */
  follow(key: unknown, mobileListOpen = false): void {
    if (mobileListOpen && !this.listWasOpen) this.shownKey = undefined;
    this.listWasOpen = mobileListOpen;
    if (key === this.shownKey) return;
    const item = this.host().querySelector<HTMLElement>('.np-aside .np-day.is-active');
    if (!item) return;
    this.shownKey = key;
    scrollIntoBox(item);
  }
}

/** Fait défiler la boîte qui contient `item` (pas la page) pour qu'il soit visible, avec un peu de marge. */
function scrollIntoBox(item: HTMLElement, margin = 48): void {
  let box = item.parentElement;
  while (box && !(box.scrollHeight > box.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) {
    box = box.parentElement;
  }
  if (!box || box === document.body || box === document.documentElement) return;
  const boxRect = box.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  if (itemRect.top < boxRect.top + margin) {
    box.scrollTop -= boxRect.top + margin - itemRect.top;
  } else if (itemRect.bottom > boxRect.bottom - margin) {
    box.scrollTop += itemRect.bottom - (boxRect.bottom - margin);
  }
}
