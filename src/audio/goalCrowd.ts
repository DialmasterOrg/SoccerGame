import type { VenueId } from '../meta/career';
import type { Cue } from './cues';
import type { CrowdLevel } from './synth';

/** How a venue's crowd greets Harrison's goal: the cue, and the level the crowd swells to. The School's bleachers cheer; everywhere else roars as before. */
export function goalCrowd(venue: VenueId): { cue: Cue; level: CrowdLevel } {
  return venue === 'school' ? { cue: 'cheer', level: 'cheer' } : { cue: 'roar', level: 'roar' };
}
