import { describe, expect, it } from 'vitest';
import { SCHOOL_STAGE, SMALL_STAGE, stageFor } from './stage';

describe('stageFor', () => {
  it('the Backyard and Park keep the small stage; the School and later get the big one', () => {
    expect(stageFor('backyard')).toBe(SMALL_STAGE);
    expect(stageFor('park')).toBe(SMALL_STAGE);
    expect(stageFor('school')).toBe(SCHOOL_STAGE);
    expect(stageFor('worldCup')).toBe(SCHOOL_STAGE);
  });
});
