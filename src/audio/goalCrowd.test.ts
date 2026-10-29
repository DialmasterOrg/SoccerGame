import { describe, expect, it } from 'vitest';
import { goalCrowd } from './goalCrowd';

describe('goalCrowd', () => {
  it("the School's bleachers cheer Harrison's goal; everywhere else roars as before", () => {
    expect(goalCrowd('school')).toEqual({ cue: 'cheer', level: 'cheer' });
    expect(goalCrowd('backyard')).toEqual({ cue: 'roar', level: 'roar' });
    expect(goalCrowd('park')).toEqual({ cue: 'roar', level: 'roar' });
  });
});
