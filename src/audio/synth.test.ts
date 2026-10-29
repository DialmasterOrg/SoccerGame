import { describe, expect, it } from 'vitest';
import { CUES } from './cues';
import { CROWD_GAIN, createAudio, volumeGain } from './synth';

/** Just enough of an AudioParam to read back the last value set. */
class FakeParam {
  value = 0;
  /** Every scheduled value, as [value, time]. */
  events: [number, number][] = [];
  setValueAtTime(v: number, t = 0) {
    this.value = v;
    this.events.push([v, t]);
    return this;
  }
  linearRampToValueAtTime(v: number, t = 0) {
    return this.setValueAtTime(v, t);
  }
  exponentialRampToValueAtTime(v: number, t = 0) {
    return this.setValueAtTime(v, t);
  }
  setTargetAtTime(v: number) {
    return this.setValueAtTime(v);
  }
  cancelScheduledValues() {
    return this;
  }
}

const node = () => ({ connect: (n: unknown) => n, disconnect: () => {} });

/** A hand-written stand-in for AudioContext that counts what it makes. */
function fakeContext(opts: { rejectResume?: boolean } = {}) {
  const made = { gains: [] as { gain: FakeParam }[], sources: 0, oscillators: 0 };
  const ctx = {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    createGain() {
      const g = { ...node(), gain: new FakeParam() };
      made.gains.push(g);
      return g;
    },
    createOscillator() {
      made.oscillators++;
      return { ...node(), type: 'sine', frequency: new FakeParam(), start() {}, stop() {} };
    },
    createBufferSource() {
      made.sources++;
      return { ...node(), buffer: null, loop: false, start() {}, stop() {} };
    },
    createBuffer(_channels: number, length: number) {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    },
    createBiquadFilter() {
      return { ...node(), type: 'lowpass', frequency: new FakeParam(), Q: new FakeParam() };
    },
    resume() {
      if (opts.rejectResume) return Promise.reject(new Error('not allowed'));
      ctx.state = 'running';
      return Promise.resolve();
    },
    suspend() {
      ctx.state = 'suspended';
      return Promise.resolve();
    },
  };
  return { ctx, made, make: () => ctx as unknown as AudioContext };
}

const settle = () => new Promise(r => setTimeout(r, 0));

describe('crowd levels', () => {
  it('a bleacher cheer sits between the match murmur and a stadium roar', () => {
    expect(CROWD_GAIN.match).toBeLessThan(CROWD_GAIN.cheer);
    expect(CROWD_GAIN.cheer).toBeLessThan(CROWD_GAIN.roar);
  });
});

describe('createAudio', () => {
  it('createAudio(null) is unavailable and every call is a no-op', () => {
    const a = createAudio(null);
    expect(a.available).toBe(false);
    expect(() => {
      a.unlock();
      a.setVolumes(5, 5);
      a.play('kickHard');
      a.setCrowd('match');
      a.suspend();
      a.resume();
    }).not.toThrow();
    expect(a.unlocked).toBe(false);
  });

  it('a context that cannot be made leaves it unavailable, without throwing', () => {
    const a = createAudio(() => {
      throw new Error('no audio');
    });
    expect(() => a.unlock()).not.toThrow();
    expect(a.unlocked).toBe(false);
    expect(a.available).toBe(false);
  });

  it('nothing plays before unlock', () => {
    const f = fakeContext();
    const a = createAudio(f.make);
    expect(a.available).toBe(true);
    a.play('kickHard');
    a.setCrowd('match');
    expect(f.made.oscillators + f.made.sources).toBe(0);
    expect(a.unlocked).toBe(false);
  });

  it('unlock with a rejecting resume stays locked and does not throw', async () => {
    const f = fakeContext({ rejectResume: true });
    const a = createAudio(f.make);
    expect(() => a.unlock()).not.toThrow();
    await settle();
    expect(a.unlocked).toBe(false);
    const before = f.made.oscillators;
    a.play('kickHard');
    expect(f.made.oscillators).toBe(before);
  });

  it('setCrowd twice makes one crowd source', async () => {
    const f = fakeContext();
    const a = createAudio(f.make);
    a.unlock();
    await settle();
    a.setCrowd('match');
    a.setCrowd('low');
    a.setCrowd('match');
    expect(f.made.sources).toBe(1);
  });

  it('a crowd level set while locked starts on unlock', async () => {
    const f = fakeContext();
    const a = createAudio(f.make);
    a.setCrowd('match');
    a.unlock();
    await settle();
    expect(a.unlocked).toBe(true);
    expect(f.made.gains.map(g => g.gain.value)).toContain(CROWD_GAIN.match);
  });

  it('the same cue inside minGapS plays once', async () => {
    const f = fakeContext();
    const a = createAudio(f.make);
    a.unlock();
    await settle();
    const count = () => f.made.oscillators + f.made.sources;
    const start = count();
    a.play('tap');
    const once = count();
    expect(once).toBeGreaterThan(start);
    a.play('tap');
    expect(count()).toBe(once);
    f.ctx.currentTime = 1;
    a.play('tap');
    expect(count()).toBeGreaterThan(once);
  });

  it('volumeGain(0) is 0 and volumeGain(10) is 1', () => {
    expect(volumeGain(0)).toBe(0);
    expect(volumeGain(10)).toBe(1);
    expect(volumeGain(5)).toBeCloseTo(0.25);
    expect(volumeGain(99)).toBe(1);
  });

  it("playMusic('title') twice schedules one loop", async () => {
    const f = fakeContext();
    const a = createAudio(f.make);
    a.unlock();
    await settle();
    a.playMusic('title');
    const once = f.made.oscillators;
    expect(once).toBeGreaterThan(0);
    a.playMusic('title');
    expect(f.made.oscillators).toBe(once);
    a.playMusic(null);
  });

  it('a track asked for while locked starts on unlock', async () => {
    const f = fakeContext();
    const a = createAudio(f.make);
    a.playMusic('title');
    expect(f.made.oscillators).toBe(0);
    a.unlock();
    await settle();
    expect(f.made.oscillators).toBeGreaterThan(0);
    a.playMusic(null);
  });

  it('a held voice stays at its peak until its hold ends, then decays', async () => {
    const f = fakeContext();
    const a = createAudio(f.make);
    a.unlock();
    await settle();
    a.play('whistleShort');
    const v = CUES.whistleShort.voices[0]!;
    const env = f.made.gains.find(g => g.gain.events.some(([value]) => value === v.gain))!;
    const holdEnd = (v.attack ?? 0) + (v.hold ?? 0);
    expect(env.gain.events).toContainEqual([v.gain, expect.closeTo(holdEnd, 6)]);
  });

  describe('suspend and resume', () => {
    /** buildGraph makes master, music, sfx, then the crowd. */
    const crowdGain = (f: ReturnType<typeof fakeContext>) => f.made.gains[3]!.gain;

    it('suspend then resume restarts the crowd and music', async () => {
      const f = fakeContext();
      const a = createAudio(f.make);
      a.unlock();
      await settle();
      a.setCrowd('match');
      a.playMusic('title');
      a.suspend();
      await settle();
      // While hidden the match pauses and the crowd drops; nothing plays until the tab is back.
      a.setCrowd('low');
      a.playMusic(null);
      a.playMusic('title');
      const notes = f.made.oscillators;
      expect(crowdGain(f).value).toBe(CROWD_GAIN.match);
      a.resume();
      await settle();
      expect(f.ctx.state).toBe('running');
      expect(crowdGain(f).value).toBe(CROWD_GAIN.low);
      expect(f.made.oscillators).toBeGreaterThan(notes);
      a.playMusic(null);
    });

    it('resume without a suspend does nothing', async () => {
      const f = fakeContext();
      const a = createAudio(f.make);
      a.unlock();
      await settle();
      let resumes = 0;
      const resume = f.ctx.resume;
      f.ctx.resume = () => {
        resumes++;
        return resume();
      };
      a.resume();
      await settle();
      expect(resumes).toBe(0);
    });

    it('suspending while locked does not unlock on resume', async () => {
      const f = fakeContext();
      const a = createAudio(f.make);
      a.suspend();
      a.resume();
      await settle();
      expect(a.unlocked).toBe(false);
    });
  });
});
