import type { Aim } from './kick';
import type { Player } from './player';
import { attackDir } from './styles';
import type { World } from './world';

/** The aim at the side of the goal `attacker` faces that's further from that goal's keeper ('far' on a tie, and with no keepers). */
export function openCorner(w: World, attacker: Player): Aim {
  const g = w.field.goals.find(goal => goal.side === (attackDir(attacker) > 0 ? 'right' : 'left'))!;
  const k = w.keepers?.[attacker.team === 'home' ? 'away' : 'home'];
  if (!k) return 'far';
  return Math.abs(k.body.z - g.z0) > Math.abs(k.body.z - g.z1) ? 'near' : 'far';
}
