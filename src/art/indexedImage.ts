/** A pixel buffer of logical colour ids. 0 is always transparent. */
export class IndexedImage {
  readonly data: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
    data?: Uint8Array,
  ) {
    this.data = data ?? new Uint8Array(width * height);
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.data[y * this.width + x]!;
  }

  set(x: number, y: number, c: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.data[y * this.width + x] = c;
  }

  clone(): IndexedImage {
    return new IndexedImage(this.width, this.height, this.data.slice());
  }
}

/** Parses hand-authored pixel art. Each char maps through `legend`; '.' is transparent. */
export function parseGrid(rows: readonly string[], legend: Readonly<Record<string, number>>): IndexedImage {
  const width = rows[0]?.length ?? 0;
  const img = new IndexedImage(width, rows.length);
  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`parseGrid: row ${y} has length ${row.length}, expected ${width}`);
    }
    for (let x = 0; x < width; x++) {
      const ch = row[x]!;
      if (ch === '.') continue;
      const c = legend[ch];
      if (c === undefined) throw new Error(`parseGrid: unknown char '${ch}' at row ${y}, column ${x}`);
      img.set(x, y, c);
    }
  });
  return img;
}

/** Draws `src` onto `dst` with its top-left at (dx, dy), skipping transparent pixels. */
export function blit(dst: IndexedImage, src: IndexedImage, dx: number, dy: number): void {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const c = src.get(x, y);
      if (c !== 0) dst.set(x + dx, y + dy, c);
    }
  }
}

/** A quarter turn anticlockwise: width and height swap, and the right-hand column becomes the top row. */
export function turnLeft(img: IndexedImage): IndexedImage {
  const out = new IndexedImage(img.height, img.width);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) out.set(x, y, img.get(img.width - 1 - y, x));
  }
  return out;
}

/** Shifts row `y` right by `slope` px per row above the bottom one, widening the image to fit. */
export function shearUp(img: IndexedImage, slope: number): IndexedImage {
  const shift = (y: number) => Math.round(slope * (img.height - 1 - y));
  const out = new IndexedImage(img.width + shift(0), img.height);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) out.set(x + shift(y), y, img.get(x, y));
  }
  return out;
}

export function flipX(img: IndexedImage): IndexedImage {
  const out = new IndexedImage(img.width, img.height);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) out.set(img.width - 1 - x, y, img.get(x, y));
  }
  return out;
}
