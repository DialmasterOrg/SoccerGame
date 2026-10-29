import { BALL_R } from '../art/ball';
import { stepBall } from './ball';
import { aimLine, chip, type Aim } from './kick';
import type { Player } from './player';
import { attackDir } from './styles';
import type { World } from './world';
import { ballIn, footZone } from './zones';

const STEP = 1 / 60;

/** The aim at the side of the goal `attacker` faces that's further from that goal's keeper ('far' on a tie, and with no keepers). */
export function openCorner(w: World, attacker: Player): Aim {
  const g = w.field.goals.find(goal => goal.side === (attackDir(attacker) > 0 ? 'right' : 'left'))!;
  const k = w.keepers?.[attacker.team === 'home' ? 'away' : 'home'];
  if (!k) return 'far';
  return Math.abs(k.body.z - g.z0) > Math.abs(k.body.z - g.z1) ? 'near' : 'far';
}

/** The charge whose chip by `p` along `aim`, from where the ball is, crosses the goal it faces `lineY` px up, found by flying it as the real chip goes. */
export function judgedChip(w: World, p: Player, lineY: number, aim: Aim = 'straight'): number {
  const dir = attackDir(p);
  const g = w.field.goals.find(goal => goal.side === (dir > 0 ? 'right' : 'left'))!;
  const yAtLine = (charge: number): number => {
    const k = chip(p.stats, charge, aimLine(w.ball, dir, aim, w.field));
    const b = { ...w.ball, vx: k.vx, vy: k.vy, vz: k.vz, spin: k.spin };
    // Measured as its front edge meets the line; one that comes back off the bar is too high.
    const at = g.lineX - dir * (BALL_R + 1);
    for (let i = 0; i < 240 && (at - b.x) * dir > 0 && b.vx * dir > 0; i++) {
      stepBall(b, STEP, w.field);
      // The swing meets it again while it's still at the foot, as the real chip does.
      if (ballIn(footZone(p), b, BALL_R)) Object.assign(b, { vx: k.vx, vy: k.vy, vz: k.vz });
    }
    return b.vx * dir <= 0 ? Infinity : (b.x - at) * dir >= 0 ? b.y : -1;
  };
  let [lo, hi] = [0.2, 1];
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (yAtLine(mid) < lineY) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
