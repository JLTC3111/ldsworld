// Snowflake artwork and atlas builder from React Bits Pixel Snow by David Haz.
// Source: https://github.com/DavidHDev/react-bits/tree/main/src/content/Backgrounds/PixelSnow
// See REACT-BITS-LICENSE.txt for MIT + Commons Clause terms.
export const SPRITES = {
  square: [
    ['@'],
    ['oo', 'oo'],
    ['xox', 'o@o', 'xox'],
    ['xoox', 'o@@o', 'o@@o', 'xoox'],
    ['xooox', 'oo@oo', 'o@@@o', 'oo@oo', 'xooox'],
    ['xox', 'o@o', 'xox'],
    ['xoox', 'o@@o', 'o@@o', 'xoox'],
    ['xooox', 'oo@oo', 'o@@@o', 'oo@oo', 'xooox']
  ],
  round: [
    ['@'],
    ['.x.', 'x@x', '.x.'],
    ['.xx.', 'x@@x', 'x@@x', '.xx.'],
    ['.xxx.', 'xo@ox', 'x@@@x', 'xo@ox', '.xxx.'],
    ['..xxx..', '.xooox.', 'xoo@oox', 'xo@@@ox', 'xoo@oox', '.xooox.', '..xxx..'],
    ['.xx.', 'x@@x', 'x@@x', '.xx.'],
    ['.xxx.', 'xo@ox', 'x@@@x', 'xo@ox', '.xxx.'],
    ['..xxx..', '.xooox.', 'xoo@oox', 'xo@@@ox', 'xoo@oox', '.xooox.', '..xxx..']
  ],
  snowflake: [
    ['@'],
    ['.x.', 'x@x', '.x.'],
    ['..x..', 'x.o.x', '.o@o.', 'x.o.x', '..x..'],
    ['...x...', '.x.o.x.', '..ooo..', 'xoo@oox', '..ooo..', '.x.o.x.', '...x...'],
    [
      '....x....',
      '.x..o..x.',
      '..o.o.o..',
      '...ooo...',
      'xooo@ooox',
      '...ooo...',
      '..o.o.o..',
      '.x..o..x.',
      '....x....'
    ],
    ['x...x', '.o.o.', '..@..', '.o.o.', 'x...x'],
    ['x..x..x', '.o.o.o.', '..ooo..', 'xoo@oox', '..ooo..', '.o.o.o.', 'x..x..x'],
    [
      'x...x...x',
      '.o..o..o.',
      '..o.o.o..',
      '...ooo...',
      'xooo@ooox',
      '...ooo...',
      '..o.o.o..',
      '.o..o..o.',
      'x...x...x'
    ]
  ]
};

const VARIANTS = ['square', 'round', 'snowflake'];
const CELL = 9;
const LEVELS = 5;
const SLOTS = 8;

export const buildAtlas = () => {
  const width = CELL * SLOTS;
  const height = CELL * VARIANTS.length;
  const data = new Uint8Array(width * height * 4);
  VARIANTS.forEach((variant, row) => {
    SPRITES[variant].forEach((rows, level) => {
      rows.forEach((line, y) => {
        for (let x = 0; x < line.length; x++) {
          const mark = line[x];
          if (mark === '.') continue;
          const offset = ((row * CELL + y) * width + level * CELL + x) * 4;
          data[offset] = 255;
          data[offset + 1] = mark === '@' ? 255 : mark === 'o' ? 128 : 0;
          data[offset + 3] = 255;
        }
      });
    });
  });
  return { data, width, height };
};
