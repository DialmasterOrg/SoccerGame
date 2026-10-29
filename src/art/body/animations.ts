import { plantLeg, type ArmPose, type HeadFacing, type LegPose, type Pose } from './pose';
import { HARRISON_BODY, standingHipHeight, type BodyProportions } from './proportions';

export type AnimName = 'idle' | 'run' | 'jump' | 'shoot' | 'powerUp' | 'sprint' | 'chip' | 'header' | 'volley' | 'slide' | 'fall' | 'juggle' | 'celebrate' | 'brace' | 'skid' | 'stepover' | 'flick' | 'fooled' | 'stumble';

/** Shoot frame held while a shot charges. */
export const SHOOT_CHARGE_FRAME = 1;
/** Shoot frame where the boot meets the ball. */
export const SHOOT_STRIKE_FRAME = 2;
/** Slide frame held for as long as he slides. */
export const SLIDE_HOLD_FRAME = 2;
/** Skid frame held for as long as he's still braking. */
export const SKID_FRAME_HOLD = 1;
/** Flick frame where the heel lets the ball go: 0.25 s in at 12 fps, the trick's sell. */
export const FLICK_RELEASE_FRAME = 3;

export interface AnimationClip {
  name: AnimName;
  keys: readonly Pose[];
  frameCount: number;
  fps: number;
  loop: boolean;
  /** Keys cover half a cycle; the second half mirrors near and far limbs. */
  mirrorHalf?: boolean;
}

type Leg = LegPose | { plant: number; ankle?: number };

export interface KeySpec {
  x?: number;
  /** Hip height relative to standing (negative crouches); keeps clips valid for any leg length. */
  hip: number;
  torso: number;
  head?: { facing?: HeadFacing; dx?: number; dy?: number };
  near: Leg;
  far: Leg;
  nearArm: [shoulder: number, elbow: number];
  farArm: [shoulder: number, elbow: number];
}

/** Builds a pose; legs given as `{ plant: footX }` are solved so the foot rests on the ground there. */
export function poseKey(body: BodyProportions, s: KeySpec): Pose {
  const x = s.x ?? 0;
  const hipHeight = standingHipHeight(body) + s.hip;
  const leg = (l: Leg): LegPose => ('plant' in l ? plantLeg(body, x, hipHeight, l.plant, l.ankle) : { ...l });
  const arm = ([shoulder, elbow]: [number, number]): ArmPose => ({ shoulder, elbow });
  return {
    x,
    hipHeight,
    torso: s.torso,
    head: { facing: s.head?.facing ?? 'side', dx: s.head?.dx ?? 0, dy: s.head?.dy ?? 0 },
    nearLeg: leg(s.near),
    farLeg: leg(s.far),
    nearArm: arm(s.nearArm),
    farArm: arm(s.farArm),
  };
}

// Run half-cycle: the near leg strikes, takes the weight, passes under and pushes off
// while the far leg recovers and reaches forward. Arms swing opposite the legs.
const RUN_TORSO = 12;
const SPRINT_TORSO = 20;
/** Airborne clips lift the hip like the jump's rise frame. */
const AIR_HIP = 3;

/** Every clip, with planted feet solved for `body`. Hip offsets are relative to standing height. */
export function clipsFor(body: BodyProportions): Record<AnimName, AnimationClip> {
  const k = (s: KeySpec) => poseKey(body, s);
  const idleKey = (hip: number, torso: number, sway: number) =>
    k({ hip, torso, near: { plant: 3 }, far: { plant: -2 }, nearArm: [5 + sway, 15], farArm: [-5 + sway, 15] });
  const powerKey = (x: number, hip: number) =>
    k({ x, hip, torso: -10, head: { dy: -1 }, near: { plant: 8 }, far: { plant: -9 }, nearArm: [-35, 80], farArm: [-30, 85] });

  return {
    idle: {
      name: 'idle',
      frameCount: 4,
      fps: 6,
      loop: true,
      keys: [idleKey(0, 2, 0), idleKey(-1, 4, 2), idleKey(-1, 4, 2), idleKey(0, 3, 1)],
    },
    run: {
      name: 'run',
      frameCount: 8,
      fps: 12,
      loop: true,
      mirrorHalf: true,
      keys: [
        k({ hip: -2, torso: RUN_TORSO, near: { plant: 7, ankle: -10 }, far: { hip: -25, knee: 60, ankle: 30 }, nearArm: [-35, 70], farArm: [40, 80] }),
        k({ hip: -3, torso: RUN_TORSO, near: { plant: 3 }, far: { hip: -5, knee: 90, ankle: 35 }, nearArm: [-20, 70], farArm: [25, 75] }),
        k({ hip: -2, torso: RUN_TORSO, near: { plant: -2 }, far: { hip: 25, knee: 95, ankle: 30 }, nearArm: [0, 70], farArm: [0, 70] }),
        k({ hip: -1, torso: RUN_TORSO, near: { hip: -25, knee: 25, ankle: 25 }, far: { hip: 40, knee: 50, ankle: 0 }, nearArm: [25, 75], farArm: [-20, 70] }),
      ],
    },
    jump: {
      name: 'jump',
      frameCount: 3,
      fps: 10,
      loop: false,
      keys: [
        // Crouch, arms swung back.
        k({ hip: -5, torso: 20, near: { plant: 3 }, far: { plant: -2 }, nearArm: [-50, 30], farArm: [-40, 30] }),
        // Rise: legs extended, toes pointed, arms up. Lifted in-frame so pointed toes clear the frame edge.
        k({ hip: 3, torso: 0, near: { hip: 5, knee: 0, ankle: 40 }, far: { hip: -5, knee: 5, ankle: 40 }, nearArm: [150, 10], farArm: [140, 10] }),
        // Tuck.
        k({ hip: 3, torso: 5, near: { hip: 40, knee: 70, ankle: 20 }, far: { hip: 10, knee: 60, ankle: 30 }, nearArm: [70, 20], farArm: [50, 20] }),
      ],
    },
    shoot: {
      name: 'shoot',
      frameCount: 5,
      fps: 15,
      loop: false,
      keys: [
        // Wind-up and charge-hold: kicking (near) leg drawn back, arms out for balance.
        k({ hip: -1, torso: -5, near: { hip: -40, knee: 90, ankle: 30 }, far: { plant: -1 }, nearArm: [-45, 20], farArm: [60, 20] }),
        k({ hip: -1, torso: -5, near: { hip: -55, knee: 100, ankle: 30 }, far: { plant: -1 }, nearArm: [-55, 20], farArm: [70, 20] }),
        // Strike, follow-through, recover.
        k({ hip: -1, torso: -10, near: { hip: 45, knee: 10, ankle: 20 }, far: { plant: -2 }, nearArm: [-20, 30], farArm: [30, 30] }),
        k({ hip: 0, torso: -15, near: { hip: 75, knee: 5, ankle: 20 }, far: { plant: -3 }, nearArm: [-30, 20], farArm: [120, 20] }),
        k({ hip: -1, torso: 0, near: { hip: 20, knee: 15, ankle: 0 }, far: { plant: -1 }, nearArm: [-10, 20], farArm: [10, 20] }),
      ],
    },
    powerUp: {
      name: 'powerUp',
      frameCount: 4,
      fps: 12,
      loop: true,
      // Wide low stance, chest out, fists at the hips, trembling with power.
      keys: [powerKey(-1, -4), powerKey(1, -5), powerKey(-1, -4), powerKey(1, -5)],
    },
    sprint: {
      name: 'sprint',
      frameCount: 8,
      fps: 16,
      loop: true,
      mirrorHalf: true,
      // The run's half-cycle, leaning in harder with a longer stride and bigger arm pump.
      keys: [
        k({ hip: -2, torso: SPRINT_TORSO, near: { plant: 9, ankle: -10 }, far: { hip: -35, knee: 75, ankle: 30 }, nearArm: [-55, 80], farArm: [60, 90] }),
        k({ hip: -3, torso: SPRINT_TORSO, near: { plant: 3 }, far: { hip: -5, knee: 105, ankle: 35 }, nearArm: [-30, 80], farArm: [35, 85] }),
        k({ hip: -2, torso: SPRINT_TORSO, near: { plant: -6 }, far: { hip: 35, knee: 100, ankle: 30 }, nearArm: [5, 80], farArm: [-5, 80] }),
        k({ hip: -1, torso: SPRINT_TORSO, near: { hip: -35, knee: 35, ankle: 30 }, far: { hip: 50, knee: 55, ankle: 0 }, nearArm: [40, 85], farArm: [-35, 80] }),
      ],
    },
    chip: {
      name: 'chip',
      frameCount: 4,
      fps: 15,
      loop: false,
      // A short scoop: the near foot swings low and through with the toes up, under the ball.
      keys: [
        k({ hip: -1, torso: -10, near: { hip: -30, knee: 60, ankle: 10 }, far: { plant: -1 }, nearArm: [-40, 20], farArm: [50, 20] }),
        k({ hip: -1, torso: -15, near: { hip: 15, knee: 45, ankle: -20 }, far: { plant: -2 }, nearArm: [-30, 25], farArm: [40, 25] }),
        k({ hip: -1, torso: -15, near: { hip: 35, knee: 10, ankle: -20 }, far: { plant: -2 }, nearArm: [-25, 20], farArm: [70, 20] }),
        k({ hip: -1, torso: 0, near: { plant: 3 }, far: { plant: -1 }, nearArm: [-10, 20], farArm: [10, 20] }),
      ],
    },
    header: {
      name: 'header',
      frameCount: 3,
      fps: 12,
      loop: false,
      // Airborne lunge: lean back, snap the head through the ball, follow through. Arms out.
      keys: [
        k({ hip: AIR_HIP, torso: -20, near: { hip: 20, knee: 70, ankle: 30 }, far: { hip: -10, knee: 60, ankle: 30 }, nearArm: [-60, 30], farArm: [-50, 30] }),
        k({ hip: AIR_HIP, torso: 15, head: { dx: 1 }, near: { hip: 5, knee: 40, ankle: 30 }, far: { hip: -15, knee: 50, ankle: 30 }, nearArm: [-80, 20], farArm: [-70, 20] }),
        k({ hip: AIR_HIP, torso: 25, near: { hip: 0, knee: 30, ankle: 30 }, far: { hip: -20, knee: 40, ankle: 30 }, nearArm: [-60, 20], farArm: [-50, 20] }),
      ],
    },
    volley: {
      name: 'volley',
      frameCount: 4,
      fps: 15,
      loop: false,
      // Airborne strike: near leg cocked, whipped through, followed through, tucked to land.
      keys: [
        k({ hip: AIR_HIP, torso: -5, near: { hip: -20, knee: 80, ankle: 30 }, far: { hip: 10, knee: 60, ankle: 30 }, nearArm: [-50, 20], farArm: [60, 20] }),
        k({ hip: AIR_HIP, torso: -15, near: { hip: 70, knee: 5, ankle: 20 }, far: { hip: -10, knee: 50, ankle: 30 }, nearArm: [-40, 20], farArm: [80, 20] }),
        k({ hip: AIR_HIP, torso: -20, near: { hip: 85, knee: 10, ankle: 20 }, far: { hip: -15, knee: 40, ankle: 30 }, nearArm: [-30, 20], farArm: [100, 20] }),
        k({ hip: AIR_HIP, torso: 5, near: { hip: 40, knee: 70, ankle: 20 }, far: { hip: 10, knee: 60, ankle: 30 }, nearArm: [60, 20], farArm: [40, 20] }),
      ],
    },
    slide: {
      name: 'slide',
      frameCount: 4,
      fps: 12,
      loop: false,
      // Drop low and slide, near leg stretched out at the ball, far leg tucked under.
      keys: [
        k({ x: -2, hip: -5, torso: -10, near: { plant: 6 }, far: { plant: -3 }, nearArm: [-40, 30], farArm: [-20, 30] }),
        k({ x: -2, hip: -10, torso: -30, near: { hip: 70, knee: 10, ankle: -20 }, far: { plant: -5 }, nearArm: [-30, 20], farArm: [-20, 20] }),
        k({ x: -2, hip: -12, torso: -40, near: { hip: 80, knee: 0, ankle: -30 }, far: { plant: 0 }, nearArm: [-20, 20], farArm: [-10, 20] }),
        k({ x: -2, hip: -8, torso: -20, near: { plant: 8 }, far: { plant: -4 }, nearArm: [-30, 20], farArm: [-20, 20] }),
      ],
    },
    fall: {
      name: 'fall',
      frameCount: 5,
      fps: 10,
      loop: false,
      // Stumble forward, land flat, push up, kneel, stand.
      keys: [
        k({ hip: -2, torso: 40, near: { plant: 5 }, far: { hip: -40, knee: 50, ankle: 30 }, nearArm: [60, 20], farArm: [40, 20] }),
        k({ x: -1, hip: -13, torso: 80, near: { hip: -80, knee: 5, ankle: 0 }, far: { hip: -88, knee: 0, ankle: 0 }, nearArm: [-50, 70], farArm: [-40, 70] }),
        k({ x: -2, hip: -7, torso: 55, near: { hip: 20, knee: 110, ankle: 170 }, far: { hip: 10, knee: 100, ankle: 170 }, nearArm: [-45, 0], farArm: [-50, 0] }),
        k({ hip: -8, torso: 10, near: { plant: 6 }, far: { hip: 0, knee: 90, ankle: 0 }, nearArm: [10, 30], farArm: [-10, 30] }),
        idleKey(0, 2, 0),
      ],
    },
    juggle: {
      name: 'juggle',
      frameCount: 4,
      fps: 8,
      loop: true,
      // Keepy-uppies on the far foot: the near knee comes up, the foot flicks up under the ball, drops, and sets.
      keys: [
        k({ hip: 0, torso: -3, head: { dx: 1 }, near: { hip: 45, knee: 80, ankle: 10 }, far: { plant: -1 }, nearArm: [-30, 30], farArm: [35, 30] }),
        k({ hip: 0, torso: -5, head: { dx: 1 }, near: { hip: 70, knee: 35, ankle: 0 }, far: { plant: -1 }, nearArm: [-40, 30], farArm: [45, 30] }),
        k({ hip: 0, torso: -3, head: { dx: 1 }, near: { hip: 30, knee: 50, ankle: 15 }, far: { plant: -1 }, nearArm: [-30, 30], farArm: [35, 30] }),
        k({ hip: 0, torso: 0, near: { plant: 3 }, far: { plant: -1 }, nearArm: [-15, 25], farArm: [20, 25] }),
      ],
    },
    celebrate: {
      name: 'celebrate',
      frameCount: 2,
      fps: 6,
      loop: true,
      // Both arms straight up: a little dip, then up tall (the match draws that frame a hop higher).
      keys: [
        k({ hip: -1, torso: 0, head: { dy: -1 }, near: { plant: 3 }, far: { plant: -2 }, nearArm: [140, 15], farArm: [-145, 15] }),
        k({ hip: 0, torso: -3, head: { dy: -1 }, near: { plant: 2 }, far: { plant: -1 }, nearArm: [145, 5], farArm: [-150, 5] }),
      ],
    },
    brace: {
      name: 'brace',
      frameCount: 1,
      fps: 1,
      loop: false,
      // Leaning into a beam: both arms thrust forward, the front foot planted and the back leg driving.
      keys: [k({ hip: -4, torso: 25, near: { plant: 8 }, far: { plant: -10 }, nearArm: [62, 5], farArm: [70, 10] })],
    },
    skid: {
      name: 'skid',
      frameCount: 2,
      fps: 8,
      loop: false,
      // The brakes go on: the front foot reaches out ahead, then he sits back on it, heel dug in, arms flung back.
      keys: [
        k({ x: -1, hip: -2, torso: -5, near: { plant: 7, ankle: -10 }, far: { plant: -4 }, nearArm: [-30, 40], farArm: [-20, 40] }),
        k({ x: -3, hip: -5, torso: -24, head: { dx: -1 }, near: { plant: 9, ankle: -20 }, far: { plant: -3 }, nearArm: [-70, 30], farArm: [-50, 40] }),
      ],
    },
    stepover: {
      name: 'stepover',
      frameCount: 4,
      fps: 10,
      loop: false,
      // The near foot lifts, circles out over the ball and lands beyond it as the body dips that way, then he goes.
      keys: [
        k({ hip: -1, torso: 5, near: { hip: 50, knee: 95, ankle: 10 }, far: { plant: -2 }, nearArm: [-35, 30], farArm: [35, 30] }),
        k({ hip: -2, torso: 8, head: { facing: 'threeQuarter' }, near: { hip: 65, knee: 40, ankle: -15 }, far: { plant: -3 }, nearArm: [-60, 20], farArm: [70, 20] }),
        k({ x: 1, hip: -5, torso: 15, head: { facing: 'threeQuarter', dy: 1 }, near: { plant: 10 }, far: { plant: -4 }, nearArm: [-75, 20], farArm: [85, 30] }),
        k({ hip: -2, torso: RUN_TORSO, near: { plant: 5 }, far: { hip: -20, knee: 60, ankle: 30 }, nearArm: [-25, 60], farArm: [30, 60] }),
      ],
    },
    flick: {
      name: 'flick',
      frameCount: 6,
      fps: 12,
      loop: false,
      // Ball trapped between the feet, rolled up the back of the near leg by the far foot,
      // flicked up and over by the near heel, follow-through, then away after it.
      keys: [
        k({ hip: -2, torso: 8, near: { plant: 6 }, far: { plant: -5 }, nearArm: [-20, 30], farArm: [20, 30] }),
        k({ hip: -2, torso: 12, near: { plant: 2 }, far: { hip: -15, knee: 50, ankle: -20 }, nearArm: [-30, 30], farArm: [35, 30] }),
        k({ hip: -2, torso: 15, near: { hip: -5, knee: 60, ankle: 20 }, far: { plant: -2 }, nearArm: [-45, 30], farArm: [50, 30] }),
        k({ hip: -2, torso: 22, head: { dy: -1 }, near: { hip: -20, knee: 115, ankle: 50 }, far: { plant: 0 }, nearArm: [-60, 20], farArm: [75, 20] }),
        k({ hip: -1, torso: 5, head: { dy: -1 }, near: { hip: -15, knee: 70, ankle: 30 }, far: { plant: 0 }, nearArm: [-40, 30], farArm: [50, 30] }),
        k({ hip: -2, torso: RUN_TORSO, near: { plant: 5 }, far: { hip: -25, knee: 60, ankle: 30 }, nearArm: [-35, 70], farArm: [40, 80] }),
      ],
    },
    fooled: {
      name: 'fooled',
      frameCount: 3,
      fps: 6,
      loop: true,
      // Caught leaning the wrong way: weight back on his heels, arms out, head turning to look.
      keys: [
        k({ x: -1, hip: -2, torso: -12, head: { facing: 'threeQuarter' }, near: { plant: 6 }, far: { plant: -4 }, nearArm: [-55, 30], farArm: [75, 25] }),
        k({ x: -1, hip: -3, torso: -16, head: { facing: 'threeQuarter', dx: -1 }, near: { plant: 6 }, far: { plant: -4 }, nearArm: [-65, 35], farArm: [90, 20] }),
        k({ x: -1, hip: -2, torso: -10, head: { facing: 'threeQuarter' }, near: { plant: 6 }, far: { plant: -4 }, nearArm: [-50, 25], farArm: [70, 30] }),
      ],
    },
    stumble: {
      name: 'stumble',
      frameCount: 4,
      fps: 10,
      loop: false,
      // The lurch forward, arms flailing, a stride to catch himself, then upright again.
      keys: [
        k({ hip: -2, torso: 35, near: { plant: 8 }, far: { hip: -35, knee: 45, ankle: 30 }, nearArm: [100, 30], farArm: [-70, 30] }),
        k({ hip: -5, torso: 45, head: { dy: 1 }, near: { plant: 10 }, far: { hip: -55, knee: 30, ankle: 30 }, nearArm: [-110, 30], farArm: [120, 30] }),
        k({ hip: -4, torso: 25, near: { plant: -6 }, far: { plant: 10 }, nearArm: [70, 30], farArm: [40, 30] }),
        k({ hip: -1, torso: 10, near: { plant: 3 }, far: { plant: -2 }, nearArm: [30, 30], farArm: [-20, 30] }),
      ],
    },
  };
}

export const CLIPS: Record<AnimName, AnimationClip> = clipsFor(HARRISON_BODY);
