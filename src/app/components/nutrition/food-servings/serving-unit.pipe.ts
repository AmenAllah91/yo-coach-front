import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { editableUnit } from './food-serving-rules';

@Pipe({ name: 'servingUnit', standalone: true, pure: false })
export class ServingUnitPipe implements PipeTransform {
  constructor(private translate: TranslateService) {}

  transform(unit: unknown): string {
    return editableUnit(unit, this.translate.instant('FOOD_UNIT_PIECE'));
  }
}
