import { ElementRef } from '@angular/core';
import { TableResizeDirective } from './table-resize.directive';

describe('TableResizeDirective', () => {
  it('should create an instance', () => {
    const directive = new TableResizeDirective(new ElementRef(document.createElement('table')));
    expect(directive).toBeTruthy();
  });
});
