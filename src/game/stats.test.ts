import { describe, expect, it } from 'vitest';
import { GRAVITY } from './constants';
import { BASE_STATS, chargeTime, jumpVelocity, maxShotSpeed, runSpeed, staminaDrain, staminaRegen, touchPush, turnRisk } from './stats';

describe('stats', () => {
  it('stat curves hit their level 1 and 10 targets', () => {
    expect(runSpeed(BASE_STATS)).toBe(95);
    expect(runSpeed({ ...BASE_STATS, speed: 10 })).toBe(135);
    expect(maxShotSpeed(BASE_STATS)).toBe(430);
    expect(maxShotSpeed({ ...BASE_STATS, power: 10 })).toBe(640);
    expect(chargeTime(BASE_STATS)).toBe(0.9);
    expect(chargeTime({ ...BASE_STATS, power: 10 })).toBeCloseTo(0.6);
    expect(touchPush(BASE_STATS)).toBe(60);
    expect(touchPush({ ...BASE_STATS, control: 10 })).toBe(25);
  });

  it('turnRisk: a hard cut at a run gives the ball away a quarter of the time at Control 1, 6% at 10, linear between', () => {
    expect(turnRisk(BASE_STATS)).toBeCloseTo(0.25, 9);
    expect(turnRisk({ ...BASE_STATS, control: 10 })).toBeCloseTo(0.06, 9);
    expect(turnRisk({ ...BASE_STATS, control: 5.5 })).toBeCloseTo(0.155, 9);
  });

  it('a max-stat jump clears about 1.2× his height', () => {
    const v = jumpVelocity({ ...BASE_STATS, jump: 10 });
    expect((v * v) / (2 * GRAVITY)).toBeCloseTo(48, 0);
  });

  it('a level 1 jump peaks at 32 px', () => {
    const v = jumpVelocity(BASE_STATS);
    expect((v * v) / (2 * GRAVITY)).toBeCloseTo(32, 5);
  });

  it('curves are linear and clamp levels to 1..10', () => {
    expect(runSpeed({ ...BASE_STATS, speed: 5.5 })).toBeCloseTo(115);
    expect(runSpeed({ ...BASE_STATS, speed: 0 })).toBe(95);
    expect(runSpeed({ ...BASE_STATS, speed: 99 })).toBe(135);
  });

  it('every base stat is level 1', () => {
    expect(BASE_STATS).toEqual({ speed: 1, power: 1, jump: 1, control: 1, stamina: 1 });
  });

  it("Stamina 1 is today's sprint exactly", () => {
    expect(staminaDrain(BASE_STATS)).toBe(0.5);
    expect(staminaRegen(BASE_STATS)).toBe(0.3);
  });

  it('Stamina 10 halves the drain and regens half as fast again', () => {
    expect(staminaDrain({ ...BASE_STATS, stamina: 10 })).toBeCloseTo(0.25);
    expect(staminaRegen({ ...BASE_STATS, stamina: 10 })).toBeCloseTo(0.45);
  });
});
