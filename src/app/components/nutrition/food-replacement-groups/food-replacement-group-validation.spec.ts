import {
  hasUniqueReplacementGroupFoods,
  isReplacementGroupFoodValid,
  isReplacementGroupGuidanceValid,
  isReplacementGroupNameValid,
  isReplacementGroupValid,
} from './food-replacement-group-validation';

describe('food replacement group validation', () => {
  const food = (foodRefId: string, quantity = 100, unit = 'g') => ({
    foodRefId,
    quantity,
    unit,
  });

  it('trims and limits the group name to 100 characters', () => {
    expect(isReplacementGroupNameValid('  Protein  ')).toBeTrue();
    expect(isReplacementGroupNameValid('   ')).toBeFalse();
    expect(isReplacementGroupNameValid('x'.repeat(101))).toBeFalse();
  });

  it('limits optional client guidance to 500 characters', () => {
    expect(isReplacementGroupGuidanceValid('')).toBeTrue();
    expect(isReplacementGroupGuidanceValid('x'.repeat(500))).toBeTrue();
    expect(isReplacementGroupGuidanceValid('x'.repeat(501))).toBeFalse();
  });

  it('requires a food id, a positive quantity, and a unit', () => {
    expect(isReplacementGroupFoodValid(food('food-1'))).toBeTrue();
    expect(isReplacementGroupFoodValid(food('', 100, 'g'))).toBeFalse();
    expect(isReplacementGroupFoodValid(food('food-1', 0, 'g'))).toBeFalse();
    expect(isReplacementGroupFoodValid(food('food-1', -1, 'g'))).toBeFalse();
    expect(isReplacementGroupFoodValid(food('food-1', 100, ''))).toBeFalse();
  });

  it('rejects duplicates and groups with fewer than two valid foods', () => {
    expect(hasUniqueReplacementGroupFoods([food('food-1'), food('food-1')])).toBeFalse();
    expect(isReplacementGroupValid('Group', '', [food('food-1')])).toBeFalse();
    expect(isReplacementGroupValid('Group', '', [food('food-1'), food('food-2')])).toBeTrue();
  });
});
