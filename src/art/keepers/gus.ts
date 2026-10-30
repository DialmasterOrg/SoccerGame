import { NO_BODY_EXTRAS, type BodyExtras } from '../body/drawFigure';
import type { HeadSprite } from '../body/head';
import type { HeadFacing } from '../body/pose';
import type { BodyProportions, FrameSpec } from '../body/proportions';
import { ART_LEGEND } from '../colors';
import { parseGrid } from '../indexedImage';
import type { Point } from '../raster';

/** Goalie Gus's frame: bigger than everyone's, odd in width so flipX keeps the anchor. */
export const GUS_FRAME: FrameSpec = { w: 63, h: 72, anchor: { x: 31, y: 69 } };

/** A big, friendly giant: about a third taller and broader than Harrison, about 54 px standing with his head. */
export const GUS_BODY: BodyProportions = {
  thigh: 12,
  shin: 12,
  foot: 5,
  ankleHeight: 1,
  torso: 16,
  upperArm: 9,
  forearm: 8,
  thighWidth: 6,
  shinWidth: 4,
  upperArmWidth: 4,
  forearmWidth: 3,
  torsoWidth: 9,
  frame: GUS_FRAME,
};

function head(rows: readonly string[], neck: Point): HeadSprite {
  return { image: parseGrid(rows, ART_LEGEND), neck };
}

/**
 * His heads: a ginger crop, freckles and a wide grin. Legend: H/h/L hair
 * shadow/base/light, k/s skin/shadow (the freckles too), o eye and grin.
 */
export const GUS_HEADS: Readonly<Record<HeadFacing, HeadSprite>> = {
  side: head(
    [
      '...HhhhhH...',
      '..HhLLLhhH..',
      '.HhhhhhhhhH.',
      '.Hhhhhhhhhh.',
      '.HhHskkkkkk.',
      '.Hhskkkkkok.',
      '.Hskkskskkkk',
      '.sskkkkkkkk.',
      '.sskkkkkkko.',
      '..sskkkoook.',
      '...skkkkkk..',
      '....skkkk...',
      '....skkkk...',
    ],
    { x: 5, y: 12 },
  ),
  threeQuarter: head(
    [
      '...HhhhhhH..',
      '..HhLLLhhhH.',
      '.HhhhhhhhhhH',
      '.Hhhhhhhhhhh',
      '.Hhskkkkkkkh',
      '.Hskokkkkok.',
      '.skkskskskk.',
      '.skkkkkkkkk.',
      '.sskokkkkok.',
      '..skkooooks.',
      '...skkkkk...',
      '....kkkk....',
      '....kkkk....',
    ],
    { x: 5, y: 12 },
  ),
  front: head(
    [
      '..HhhhhhH..',
      '.HhLLLhhhH.',
      'HhhhhhhhhhH',
      'Hhhkkkkkhhh',
      'skkkkkkkkks',
      'skokkkkkoks',
      'sksksksksks',
      'skkkkskkkks',
      'skokkkkkoks',
      '.skoooooks.',
      '..skkkkks..',
      '...kkkkk...',
      '...kkkkk...',
    ],
    { x: 5, y: 12 },
  ),
};

/** A keeper's gloves, bigger, and the captain's armband. */
export const GUS_EXTRAS: BodyExtras = { ...NO_BODY_EXTRAS, gloves: true, armband: true, gloveSize: 5 };

/** Where a held ball's centre sits in his hold frames, from his anchor: x ahead, y up. The sim parks the ball there. */
export const GUS_HANDS: Point = { x: 8, y: 27 };
