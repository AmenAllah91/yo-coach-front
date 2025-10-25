import { Directive, ElementRef, AfterViewInit, OnDestroy, Input } from '@angular/core';

@Directive({
  standalone: true,
  selector: '[appTableResize]'
})
export class TableResizeDirective implements AfterViewInit, OnDestroy {
  @Input('appTableResize') table: any;
  private resizeObserver!: ResizeObserver;
  private rafId: number | null = null;
  private lastWidth: number | null = null;
  private lastHeight: number | null = null;
  private pendingResize: { width: number; height: number } | null = null;
  private isScheduled: boolean = false;

  constructor(private el: ElementRef) {}

  ngAfterViewInit() {
    this.el.nativeElement.classList.add('ngx-datatable-container');
    this.resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;

      this.pendingResize = { width, height };

      if (this.isScheduled) {
        return;
      }

      this.isScheduled = true;
      this.rafId = requestAnimationFrame(() => {
        if (this.pendingResize) {
          const { width, height } = this.pendingResize;

          if (
            this.lastWidth === null ||
            this.lastHeight === null ||
            Math.abs(this.lastWidth - width) > 1 ||
            Math.abs(this.lastHeight - height) > 1
          ) {
            this.lastWidth = width;
            this.lastHeight = height;

            if (this.table && typeof this.table.recalculate === 'function') {
              this.el.nativeElement.classList.add('recalculating');
                this.table.recalculate();
            }
          }
          this.pendingResize = null;
        }
        this.isScheduled = false;
        this.rafId = null;
      });
    });

    this.resizeObserver.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }
}
