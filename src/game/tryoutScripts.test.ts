import { describe, expect, it } from 'vitest';
import { NO_INTENT } from './player';
import { keeperWorld, setBall } from './testKeepers';
import { schoolHarrisonIntent, schoolScriptMemo, tryoutMatch } from './tryoutScripts';
import { stepWorld, type World } from './world';

const STEP = 1 / 60;

/** Harrison on the ball 150 px out from the right goal, facing it, with their keeper held at z 44. */
function onBall150(): World {
  const w = keeperWorld();
  const lineX = w.field.goals[1]!.lineX;
  Object.assign(w.home, { x: lineX - 158, z: 64, facing: 1 });
  setBall(w, { x: lineX - 150, z: 64 });
  w.keepers!.away.body.z = 44;
  return w;
}

describe("the School's scripted Harrison", () => {
  it('on the release tick his aim is the open corner', () => {
    const w = onBall150();
    const memo = schoolScriptMemo(7);
    let [held, t] = [false, 0];
    for (let i = 0; i < 600; i++, t += STEP) {
      w.keepers!.away.body.z = 44;
      const intent = schoolHarrisonIntent(w, t, STEP, memo);
      if (held && !intent.shootHeld) {
        expect(intent.aim).toBe('far');
        return;
      }
      held = intent.shootHeld;
      stepWorld(w, intent, NO_INTENT, STEP);
    }
    throw new Error('he never let a shot go');
  });

  it("follows up their keeper's push at once, but not 2 s after it", () => {
    for (const [sincePushS, follows] of [[0.5, true], [2.5, false]] as const) {
      const w = onBall150();
      const memo = schoolScriptMemo(7);
      memo.brain.nextDecisionS = 0.3;
      memo.sincePushS = sincePushS;
      expect(schoolHarrisonIntent(w, 0, STEP, memo).shootHeld, `${sincePushS}`).toBe(follows);
    }
  });

  it('recording a tryout draws no random number: one seed plays the same twice', () => {
    expect(tryoutMatch('max', 'normal', 101)).toEqual(tryoutMatch('max', 'normal', 101));
  });
});
