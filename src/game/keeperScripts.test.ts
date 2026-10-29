import { describe, expect, it } from 'vitest';
import { drill } from './keeperScripts';

describe('the keeper drills do what they say', () => {
  it('a long drill shoots from outside the box, a corner drill from inside it', () => {
    for (let seed = 1; seed <= 16; seed++) for (const [kind, outside] of [['long', true], ['corner', false]] as const) {
      let struckAt: number | null = null;
      drill(kind, 1, 'normal', seed, 'away', w => {
        struckAt ??= w.keepers!.strike?.x ?? null;
      });
      expect(struckAt, `${kind} ${seed}`).not.toBeNull();
      expect(1240 - struckAt! > 110, `${kind} ${seed}`).toBe(outside);
    }
  });

  it('the one-on-one Harrison goes round him, chips him or steps over, by turns', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 24; seed++)
      drill('oneOnOne', 1, 'normal', seed, 'away', w => {
        if (w.events.trick.started) seen.add('stepover');
        if (w.events.kicks[0]?.kicked === 'chip') seen.add('chip');
        if (w.events.kicks[0]?.kicked === 'shot' && w.keepers!.away.act !== 'set') seen.add('round');
      });
    expect([...seen].sort()).toEqual(['chip', 'round', 'stepover']);
  });
});
