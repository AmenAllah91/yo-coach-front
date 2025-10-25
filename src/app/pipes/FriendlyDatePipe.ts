import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'friendlyDate', standalone: true })
export class FriendlyDatePipe implements PipeTransform {

  transform(value: string | Date | null | undefined): string {
    if (!value) {
      return '';
    }

    // --- Parse -------------------------------------------------------------
    const date =
      value instanceof Date ? value : new Date(value.toString());

    if (isNaN(date.getTime())) {
      // valeur invalide : on renvoie tel quel
      return value.toString();
    }

    // --- Format ------------------------------------------------------------
    const yyyy = date.getFullYear();
    const mm   = String(date.getMonth() + 1).padStart(2, '0');
    const dd   = String(date.getDate()).padStart(2, '0');
    const hh   = String(date.getHours()).padStart(2, '0');
    const min  = String(date.getMinutes()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}   ${hh}:${min}`;
  }
}
