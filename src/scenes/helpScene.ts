import type { ButtonName } from '../art/glyphs';
import { MASTER } from '../art/colors';
import { GLYPH_H } from '../art/font';
import { BASE_H, BASE_W } from '../engine/viewport';
import { drawBackdrop } from './backdrop';
import type { GameContext } from './context';
import { backsOut } from './menu';
import type { Scene } from './scene';

export interface HelpScene extends Scene {
  readonly page: number;
}

/** Five pages in the pixel font. A line starting "A:", "X:" and so on is drawn with that button's picture. */
export const HELP_PAGES: readonly { title: string; lines: readonly string[] }[] = [
  {
    title: 'CONTROLS',
    lines: [
      'STICK OR D-PAD: RUN ANYWHERE. KEYS: ARROWS',
      'A: JUMP. THE BALL ON YOUR HEAD IS A HEADER. KEY Z',
      'X: SHOOT. TAP IT, OR HOLD TO CHARGE. KEY X',
      'B: CHIP WITH THE BALL, SLIDE TACKLE WITHOUT. KEY C',
      'Y: POWER UP WITH A FULL POWER METER. KEY V',
      'LB: STEAL THE BALL OFF MAX. KEY A',
      'RS: UP FOR A RAINBOW FLICK, DOWN FOR A STEPOVER. KEYS F, D',
      'RT: SPRINT. KEY SHIFT',
      'START: PAUSE. KEY ENTER OR ESC',
      'MENUS: UP/DOWN TO CHOOSE, A TO PICK, B TO GO BACK',
    ],
  },
  {
    title: 'THE MATCH',
    lines: [
      "BEAT MAX IN HARRISON'S BACKYARD!",
      'THE CLOCK COUNTS DOWN FROM 1:30, OR 2:00 AT SCHOOL.',
      'SCORE BY GETTING THE WHOLE BALL OVER THE LINE,',
      'BETWEEN THE POSTS AND UNDER THE BAR.',
      'AFTER A GOAL, THE SIDE THAT LET IT IN KICKS OFF.',
      'LEVEL AT 0:00? GOLDEN GOAL: THE NEXT GOAL WINS.',
      "NOBODY SCORES BEFORE IT RUNS OUT? IT'S A DRAW.",
      'PLAYERS ARE SOLID: GO ROUND MAX, NOT THROUGH HIM.',
      'FROM THE SCHOOL FIELD ON, A KEEPER GUARDS EACH GOAL.',
      "BISCUIT CAN'T SHOOT: BLOCK HIS WAY TO YOUR GOAL.",
      "SPEEDY SAM CAN'T STOP: TURN AND LET HIM FLY PAST.",
      'GOALIE GUS FILLS THE GOAL. HE CAN EVEN STOP THE WAVE.',
    ],
  },
  {
    title: 'MOVES',
    lines: [
      'HOLD X TO CHARGE A SHOT. LET GO IN THE GOLD',
      'PART OF THE BAR FOR A PERFECT SHOT: FAST AND TRUE.',
      'HOLD ON TOO LONG AND IT FLIES WILD AND HIGH.',
      'WHILE CHARGING OR IN THE AIR, UP AIMS AT THE',
      'FAR POST AND DOWN AT THE NEAR POST.',
      'B WITH THE BALL CHIPS IT UP AND OVER.',
      'B WITHOUT IT IS A SLIDE TACKLE TO WIN IT BACK.',
      'LB WHEN MAX HAS IT CLOSE STEALS IT. MISS AND YOU STUMBLE.',
      'JUMP INTO A HIGH BALL FOR A HEADER. IN THE AIR,',
      'X HITS A VOLLEY.',
      'RT SPRINTS, BUT IT USES STAMINA: THE BAR AT THE',
      'TOP LEFT. RUN IT DRY AND YOU SLOW DOWN FOR A BIT.',
      'STAMINA IN THE SHOP MAKES IT LAST LONGER.',
    ],
  },
  {
    title: 'TRICKS',
    lines: [
      'FROM LEVEL 4, WITH THE BALL AT YOUR FEET:',
      'RIGHT STICK DOWN DOES A STEPOVER. RIGHT STICK UP',
      'DOES A RAINBOW FLICK, FLICKING THE BALL OVER YOUR HEAD.',
      'ON THE KEYBOARD, KEYS D AND F.',
      'DO IT WHEN SOMEONE IS CLOSE IN FRONT, FACING YOU:',
      'A STEPOVER CONFUSES THEM, A FLICK TRIPS THEM UP.',
      'THEN TAKE THE BALL PAST THEM!',
      'TOO FAR OFF OR TOO LATE FOOLS NOBODY,',
      'AND THEY GET WISE TO IT FOR A WHILE.',
      'SCORE RIGHT AFTER ONE FOR A TRICK GOAL.',
    ],
  },
  {
    title: 'POWER MOVES',
    lines: [
      'BUY THE ENERGY WAVE IN THE SHOP. FILL THE POWER',
      'METER AND PRESS Y OR V TO POWER UP. WHEN SHOOT!',
      'SHOWS, FIRE IT WITH X BEFORE THE GOLD BAR RUNS OUT.',
      'MAX BACKS OFF TO BRACE AND STOP IT, SO CHASE HIM:',
      'GET CLOSE AND HE GOES FLYING. IF HE TAKES THE BALL,',
      'YOUR POWER-UP ENDS, BUT YOU KEEP THE METER.',
    ],
  },
];

const PANEL = { x: 6, y: 4, w: BASE_W - 12, h: BASE_H - 8 };
const TEXT_X = 14;
const TITLE_Y = 10;
const FIRST_LINE_Y = 32;
const LINE_H = 10;
/** Lines with a button picture need more room: the button is taller than the text. */
const BUTTON_LINE_H = 13;
const BUTTON_GAP = 4;
/** The picture sits this far above the text's top, so their middles line up. */
const BUTTON_RAISE = 2;
const FOOTER_Y = BASE_H - 18;
const BUTTON_LINE = /^(A|B|X|Y|LB|RS|RT|START): (.*)$/;
/** A line of text's height at scale 1, with its outline. */
const TEXT_H = GLYPH_H + 2;

/** Each line's top row on its page, and the bottom of the last line's text: the rows draw uses, so a test can see a page fit. */
export function helpLineYs(lines: readonly string[]): { ys: number[]; bottom: number } {
  const ys: number[] = [];
  let y = FIRST_LINE_Y;
  for (const line of lines) {
    ys.push(y);
    y += BUTTON_LINE.test(line) ? BUTTON_LINE_H : LINE_H;
  }
  return { ys, bottom: (ys.at(-1) ?? FIRST_LINE_Y) + TEXT_H };
}

/** CONTROLS, THE MATCH, MOVES: left/right flip the pages (wrapping); B, Backspace, C, Esc or Start goes back. */
export function createHelpScene(ctx: GameContext, back: () => Scene): HelpScene {
  let page = 0;
  const { art } = ctx;
  return {
    kind: 'help',
    get page() {
      return page;
    },
    update(input) {
      if (backsOut(input)) {
        ctx.audio.play('menuBack');
        return back();
      }
      const n = HELP_PAGES.length;
      const before = page;
      if (input.pressed.has('right')) page = (page + 1) % n;
      if (input.pressed.has('left')) page = (page - 1 + n) % n;
      if (page !== before) ctx.audio.play('menuMove');
      return null;
    },
    draw(g, nowS) {
      drawBackdrop(g, art, nowS);
      g.fillStyle = MASTER.outline;
      g.fillRect(PANEL.x - 1, PANEL.y - 1, PANEL.w + 2, PANEL.h + 2);
      g.fillStyle = MASTER.ink;
      g.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);

      const { title, lines } = HELP_PAGES[page]!;
      const heading = art.text(title, 2, 'energyGold', 'outline');
      g.drawImage(heading, Math.round(BASE_W / 2 - heading.width / 2), TITLE_Y);
      const { ys } = helpLineYs(lines);
      lines.forEach((line, i) => {
        const y = ys[i]!;
        const button = BUTTON_LINE.exec(line);
        if (button) {
          const pic = art.buttons[button[1] as ButtonName];
          g.drawImage(pic, TEXT_X, y - BUTTON_RAISE);
          g.drawImage(art.text(button[2]!, 1, 'white', 'outline'), TEXT_X + pic.width + BUTTON_GAP, y);
        } else {
          g.drawImage(art.text(line, 1, 'white', 'outline'), TEXT_X, y);
        }
      });

      g.drawImage(art.text('LEFT/RIGHT: MORE', 1, 'silver', 'outline'), TEXT_X, FOOTER_Y);
      const b = art.buttons.B;
      const backX = BASE_W / 2 + 10;
      g.drawImage(b, backX, FOOTER_Y - BUTTON_RAISE);
      g.drawImage(art.text('BACK', 1, 'silver', 'outline'), backX + b.width + BUTTON_GAP, FOOTER_Y);
      const count = art.text(`${page + 1}/${HELP_PAGES.length}`, 1, 'white', 'outline');
      g.drawImage(count, PANEL.x + PANEL.w - count.width - 6, FOOTER_Y);
    },
  };
}
