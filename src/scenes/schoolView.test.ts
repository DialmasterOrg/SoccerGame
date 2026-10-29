import { describe, expect, it } from 'vitest';
import { CROWD_AT, FLAG_AT, FLAG_FRAMES, LEAVES } from '../art/venues/schoolLife';
import type { SchoolLifeCanvases } from './art';
import { CROWD_FPS, FLAG_FPS, LEAF_FPS, drawCrowd, drawFlag, drawLeaves, type LayerAt } from './schoolView';

const named = (name: string) => ({ name, width: 4, height: 4 }) as unknown as HTMLCanvasElement;
const life: SchoolLifeCanvases = {
  crowd: { bob: [named('bob0'), named('bob1')], cheer: [named('cheer0'), named('cheer1')] },
  flag: Array.from({ length: FLAG_FRAMES }, (_, i) => named(`flag${i}`)),
  leaves: LEAVES.map((_, i) => [named(`leaf${i}a`), named(`leaf${i}b`)] as const),
};
function recorder() {
  const drawn: { name: string; x: number; y: number }[] = [];
  const g = { drawImage: (img: { name: string }, x: number, y: number) => void drawn.push({ name: img.name, x, y }) } as unknown as CanvasRenderingContext2D;
  return { g, drawn };
}
const AT: LayerAt = { midX: -200, nearX: -320, dy: -120, viewW: 320 };

describe('drawCrowd', () => {
  const crowdAt = (nowS: number, cheer: boolean) => {
    const { g, drawn } = recorder();
    drawCrowd(g, life, AT, nowS, cheer);
    expect(drawn).toHaveLength(1);
    return drawn[0]!;
  };

  it('draws on the bleachers, shifted with the near layer', () => {
    expect(crowdAt(0, false)).toEqual({ name: 'bob0', x: AT.nearX + CROWD_AT.x, y: CROWD_AT.y + AT.dy });
  });

  it('bobs between its two frames at CROWD_FPS.bob', () => {
    expect(CROWD_FPS.bob).toBe(2);
    expect(crowdAt(0, false).name).toBe('bob0');
    expect(crowdAt(1 / CROWD_FPS.bob, false).name).toBe('bob1');
    expect(crowdAt(2 / CROWD_FPS.bob, false).name).toBe('bob0');
  });

  it('cheers only while asked, faster', () => {
    expect(CROWD_FPS.cheer).toBeGreaterThan(CROWD_FPS.bob);
    expect(crowdAt(0, true).name).toBe('cheer0');
    expect(crowdAt(1 / CROWD_FPS.cheer, true).name).toBe('cheer1');
    expect(crowdAt(1 / CROWD_FPS.cheer, false).name).toMatch(/^bob/);
  });
});

describe('drawFlag', () => {
  const flagAt = (nowS: number) => {
    const { g, drawn } = recorder();
    drawFlag(g, life, AT, nowS);
    expect(drawn).toHaveLength(1);
    return drawn[0]!;
  };

  it('flies from the flagpole top, shifted with the mid layer', () => {
    expect(flagAt(0)).toEqual({ name: 'flag0', x: AT.midX + FLAG_AT.x, y: FLAG_AT.y + AT.dy });
  });

  it('ripples through its frames at FLAG_FPS', () => {
    expect(flagAt(1 / FLAG_FPS).name).toBe('flag1');
    expect(flagAt(2 / FLAG_FPS).name).toBe('flag2');
    expect(flagAt(FLAG_FRAMES / FLAG_FPS).name).toBe('flag0');
  });
});

describe('drawLeaves', () => {
  const leavesAt = (nowS: number, at = AT) => {
    const { g, drawn } = recorder();
    drawLeaves(g, life, at, nowS);
    return drawn;
  };

  it('draws each leaf once per call, within the view', () => {
    for (const nowS of [0, 3.7, 40]) {
      const drawn = leavesAt(nowS);
      expect(drawn).toHaveLength(LEAVES.length);
      LEAVES.forEach((_, i) => expect(drawn.filter(d => d.name.startsWith(`leaf${i}`))).toHaveLength(1));
      for (const d of drawn) {
        expect(d.x).toBeGreaterThanOrEqual(0);
        expect(d.x).toBeLessThan(AT.viewW);
      }
    }
  });

  it('drifts across and sways about its row, shifted with the venue', () => {
    const a = leavesAt(0);
    const b = leavesAt(2.5);
    expect(a.map(d => d.x)).not.toEqual(b.map(d => d.x));
    for (const nowS of [0, 0.4, 1.1, 2.5, 7.3]) {
      leavesAt(nowS).forEach((d, i) => {
        const leaf = LEAVES[i]!;
        expect(Math.abs(d.y - (leaf.y + AT.dy))).toBeLessThanOrEqual(leaf.swayPx);
      });
    }
    expect(leavesAt(0, { ...AT, dy: 0 })[0]!.y - a[0]!.y).toBe(120);
  });

  it('tumbles at LEAF_FPS', () => {
    expect(leavesAt(0)[0]!.name).toBe('leaf0a');
    expect(leavesAt(1 / LEAF_FPS)[0]!.name).toBe('leaf0b');
  });
});
