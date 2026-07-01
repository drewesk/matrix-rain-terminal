#!/usr/bin/env node
"use strict";

/**
 * Matrix Rain Terminal Animation
 * - Runs in the terminal with optional alternate screen
 * - Configurable charset (matrix/ascii/binary/hex/custom)
 * - Configurable single color, palette, or rainbow
 * - Optional background color
 * - Tunable speed, density (active columns), and trail length
 * - Handles terminal resize; quits on 'q' or Ctrl+C
 *
 * Usage examples:
 *   node scripts/matrix-rain.js
 *   node scripts/matrix-rain.js --charset binary --color cyan
 *   node scripts/matrix-rain.js --charset hex --palette green,cyan --bg black
 *   node scripts/matrix-rain.js --palette rainbow --speed 1.3 --density 0.7 --trail 28
 *   node scripts/matrix-rain.js --charset custom --chars "ABCD+-*-/" --color "#00ffcc" --bg "#000000"
 *
 * Exit with 'q' or Ctrl+C
 */

// -------------------- Argument parsing --------------------
function parseArgs(argv) {
  const args = Object.create(null);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// -------------------- Color helpers --------------------
const NAMED_COLORS = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  red: [255, 59, 48],
  green: [48, 209, 88],
  blue: [10, 132, 255],
  cyan: [50, 173, 230],
  magenta: [255, 45, 85],
  yellow: [255, 214, 10],
  orange: [255, 149, 0],
  purple: [191, 90, 242],
  pink: [255, 55, 95],
};

function isHexColor(s) {
  return /^#?[0-9a-fA-F]{6}$/.test(s);
}

function parseHexColor(s) {
  const hex = s.startsWith("#") ? s.slice(1) : s;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return [r, g, b];
}

function nameToRgb(nameOrHex) {
  if (!nameOrHex) return null;
  const key = String(nameOrHex).toLowerCase();
  if (NAMED_COLORS[key]) return NAMED_COLORS[key];
  if (isHexColor(key)) return parseHexColor(key);
  return null;
}

function hslToRgb(h, s, l) {
  // h [0,360), s,l [0,1]
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, c * 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function rgbToAnsiFg(r, g, b) {
  return `\x1b[38;2;${r};${g};${b}m`;
}

function rgbToAnsiBg(r, g, b) {
  return `\x1b[48;2;${r};${g};${b}m`;
}

function shadeColor(rgb, level, levels) {
  // Map level [0..levels-1] to brightness multiplier ~ [0.2 .. 1.0]
  const m = 0.2 + 0.8 * (level / Math.max(1, levels - 1));
  return [
    Math.max(0, Math.min(255, Math.round(rgb[0] * m))),
    Math.max(0, Math.min(255, Math.round(rgb[1] * m))),
    Math.max(0, Math.min(255, Math.round(rgb[2] * m))),
  ];
}

function parsePalette({ color, palette, width }) {
  // Returns array of base RGB per column
  if (palette) {
    const palKey = String(palette).toLowerCase();
    if (palKey === "rainbow") {
      const arr = new Array(width);
      for (let x = 0; x < width; x++) {
        const hue = (x / Math.max(1, width)) * 360;
        arr[x] = hslToRgb(hue, 1, 0.5);
      }
      return arr;
    } else {
      const parts = String(palette)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const colors = parts
        .map(nameToRgb)
        .filter((c) => Array.isArray(c));
      if (colors.length) {
        const arr = new Array(width);
        for (let x = 0; x < width; x++) arr[x] = colors[x % colors.length];
        return arr;
      }
    }
  }
  // Fallback to single color
  const single = nameToRgb(color) || NAMED_COLORS.green;
  return new Array(width).fill(single);
}

// -------------------- Charset helpers --------------------
const HALF_WIDTH_KATAKANA =
  "ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ";

const RAINBOW_HEAD_EMOJIS = ["🟢", "💚", "💊", "🐇", "🧬", "👾", "🤖", "🔋", "🔓", "🐛"];
function getRandomEmoji() {
  return RAINBOW_HEAD_EMOJIS[(Math.random() * RAINBOW_HEAD_EMOJIS.length) | 0];
}

function buildCharset(kind, customChars) {
  switch (String(kind || "matrix").toLowerCase()) {
    case "binary":
      return "01";
    case "hex":
      return "0123456789ABCDEF";
    case "ascii":
      return "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+-/=";
    case "custom":
      return customChars && customChars.length ? customChars : "01";
    case "matrix":
    default:
      // Mix of half-width katakana and ascii for single-cell width safety
      return (
        HALF_WIDTH_KATAKANA +
        "0123456789" +
        "abcdefghijklmnopqrstuvwxyz" +
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
        "@#$%&*+-/="
      );
  }
}

// -------------------- Main --------------------
(function main() {
  const rawArgs = parseArgs(process.argv.slice(2));
  if (rawArgs.help || rawArgs.h) {
    printHelp();
    process.exit(0);
  }

  const cfg = {
    charset: String(rawArgs.charset || "matrix"),
    chars: String(rawArgs.chars || ""),
    color: String(rawArgs.color || "green"),
    palette: rawArgs.palette ? String(rawArgs.palette) : null, // e.g., "rainbow" or "red,blue,green"
    bg: rawArgs.bg ? String(rawArgs.bg) : null, // e.g., "black" or "#000000" or "transparent"
    speed: Math.max(0.1, toNumber(rawArgs.speed, 1.0)), // column speed multiplier
    density: Math.min(1, Math.max(0.05, toNumber(rawArgs.density, 0.55))), // 0..1 fraction of active columns
    trail: Math.max(4, Math.min(200, Math.round(toNumber(rawArgs.trail, 28)))), // frames to fade (longer => longer trails)
    fps: Math.max(5, Math.min(60, Math.round(toNumber(rawArgs.fps, 30)))),
    levels: Math.max(3, Math.min(12, Math.round(toNumber(rawArgs.levels, 8)))), // shade levels
    alt: rawArgs["no-alt"] ? false : true,
  };

  const charset = buildCharset(cfg.charset, cfg.chars);
  const getRandomChar = () => charset.charAt((Math.random() * charset.length) | 0);
  const isRainbow = !!cfg.palette && String(cfg.palette).toLowerCase() === "rainbow";

  if (!process.stdout.isTTY) {
    console.error("This program requires a TTY (interactive terminal).");
    process.exit(1);
  }

  // Terminal setup
  const ESC = "\x1b";
  const HIDE_CURSOR = `${ESC}[?25l`;
  const SHOW_CURSOR = `${ESC}[?25h`;
  const CLEAR = `${ESC}[2J`;
  const HOME = `${ESC}[H`;
  const ALT_ON = `${ESC}[?1049h`;
  const ALT_OFF = `${ESC}[?1049l`;
  const RESET = `${ESC}[0m`;

  let width = process.stdout.columns || 80;
  let height = process.stdout.rows || 24;
  // Occasionally terminals report height including the last prompt line; avoid a blank bottom line
  if (height > 1) height = height - 0; // keep as-is; user can resize

  // Backing buffers
  let pixels = new Uint16Array(width * height); // brightness 0..255 (we use 0..(levels*step))
  let chars = new Array(width * height).fill(" ");

  // Fade per frame so that 255 -> 0 in ~ cfg.trail frames
  const fadeStep = Math.max(1, Math.round(255 / cfg.trail));

  // Active columns (streams)
  let activeCols = buildActiveColumns(width, cfg.density);
  let streams = initStreams(activeCols, height, cfg.speed);

  // Colors per column
  let baseColors = parsePalette({ color: cfg.color, palette: cfg.palette, width });
  let colorSGR = precomputeColorSGR(baseColors, cfg.levels);

  // Background color
  let bgSGR = "";
  if (cfg.bg && String(cfg.bg).toLowerCase() !== "transparent") {
    const bgRgb = nameToRgb(cfg.bg);
    if (bgRgb) bgSGR = rgbToAnsiBg(bgRgb[0], bgRgb[1], bgRgb[2]);
  }

  let running = true;
  let interval = null;

  function enter() {
    const seq = [];
    if (cfg.alt) seq.push(ALT_ON);
    seq.push(HIDE_CURSOR);
    if (bgSGR) seq.push(bgSGR);
    seq.push(CLEAR, HOME);
    process.stdout.write(seq.join(""));
  }

  function leave() {
    const seq = [];
    seq.push(RESET);
    if (cfg.alt) seq.push(ALT_OFF);
    seq.push(SHOW_CURSOR);
    process.stdout.write(seq.join(""));
  }

  function resize() {
    width = process.stdout.columns || 80;
    height = process.stdout.rows || 24;
    pixels = new Uint16Array(width * height);
    chars = new Array(width * height).fill(" ");
    activeCols = buildActiveColumns(width, cfg.density);
    streams = initStreams(activeCols, height, cfg.speed);
    baseColors = parsePalette({ color: cfg.color, palette: cfg.palette, width });
    colorSGR = precomputeColorSGR(baseColors, cfg.levels);
    // Clear screen to avoid artifacts after resize
    process.stdout.write(`${RESET}${bgSGR}${CLEAR}${HOME}`);
  }

  function buildActiveColumns(w, d) {
    const cols = [];
    for (let x = 0; x < w; x++) if (Math.random() < d) cols.push(x);
    if (cols.length === 0) cols.push((w / 2) | 0);
    return cols;
  }

  function initStreams(cols, h, speedMul) {
    return cols.map((x) => ({
      x,
      y: Math.random() * h,
      dy: (0.4 + Math.random() * 0.8) * speedMul, // cells per frame
      lastRow: -99999,
      headEmoji: getRandomEmoji(),
    }));
  }

  function precomputeColorSGR(baseColors, levels) {
    const out = new Array(baseColors.length);
    for (let i = 0; i < baseColors.length; i++) {
      out[i] = new Array(levels);
      for (let l = 0; l < levels; l++) {
        const [r, g, b] = shadeColor(baseColors[i], l, levels);
        out[i][l] = rgbToAnsiFg(r, g, b);
      }
    }
    return out;
  }

  function drawFrame() {
    // Update streams: drop new head cells
    for (const s of streams) {
      const prevInt = s.lastRow;
      s.y += s.dy;
      const currInt = (s.y | 0);
      if (currInt !== prevInt) {
        const row = ((currInt % height) + height) % height; // wrap
        const idx = row * width + s.x;
        pixels[idx] = 255;
        chars[idx] = getRandomChar();
        s.lastRow = currInt;
      }
      // occasional wrap reset to vary stream positions
      if (s.y > height + 20) {
        s.y = -Math.random() * 20;
        s.dy = (0.4 + Math.random() * 0.8) * cfg.speed;
        s.headEmoji = getRandomEmoji();
      }
    }

    // Rainbow-only: map the leading-tip cell of each stream to its emoji (render overlay only)
    const headEmojiAt = isRainbow ? new Map() : null;
    if (isRainbow) {
      for (const s of streams) {
        const row = ((s.lastRow % height) + height) % height;
        const idx = row * width + s.x;
        if (pixels[idx] > 0) headEmojiAt.set(idx, s.headEmoji);
      }
    }

    // Fade
    for (let i = 0; i < pixels.length; i++) {
      const v = pixels[i];
      if (v > 0) {
        const nv = v > fadeStep ? v - fadeStep : 0;
        pixels[i] = nv;
        if (nv === 0) chars[i] = " ";
      }
    }

    // Render
    const sb = [];
    sb.push(HOME);
    if (bgSGR) sb.push(bgSGR);

    for (let r = 0; r < height; r++) {
      let lastSGR = "";
      for (let c = 0; c < width; c++) {
        const idx = r * width + c;
        const v = pixels[idx];
        if (v <= 0) {
          if (lastSGR) {
            sb.push(RESET);
            if (bgSGR) sb.push(bgSGR);
            lastSGR = "";
          }
          sb.push(" ");
          continue;
        }
        // Quantize brightness to levels for color reuse
        const level = Math.min(cfg.levels - 1, (v * cfg.levels) >> 8);
        const sgr = colorSGR[c % colorSGR.length][level];
        if (sgr !== lastSGR) {
          sb.push(sgr);
          lastSGR = sgr;
        }
        // Rainbow-only: draw an emoji at the stream's leading tip. Emojis are
        // double-width, so consume the next cell to keep column alignment.
        // Skip on the last column (no neighbor to consume) to avoid line wrap.
        if (headEmojiAt && c < width - 1 && headEmojiAt.has(idx)) {
          sb.push(headEmojiAt.get(idx));
          c++; // the emoji occupies this cell and the next one
          continue;
        }
        sb.push(chars[idx]);
      }
      if (lastSGR) {
        sb.push(RESET);
        if (bgSGR) sb.push(bgSGR);
      }
      if (r < height - 1) sb.push("\n");
    }

    process.stdout.write(sb.join(""));
  }

  function onKey(data) {
    if (!data) return;
    const code = data[0];
    const s = data.toString("utf8");
    if (code === 3 /* Ctrl+C */ || s === "q" || s === "Q") {
      shutdown();
    }
  }

  function start() {
    enter();
    interval = setInterval(drawFrame, Math.round(1000 / cfg.fps));
    if (process.stdin.isTTY) {
      try { process.stdin.setRawMode(true); } catch {}
      process.stdin.resume();
      process.stdin.on("data", onKey);
    }
    process.stdout.on("resize", resize);
  }

  function shutdown() {
    if (!running) return;
    running = false;
    try { clearInterval(interval); } catch {}
    process.stdout.write(`${RESET}${CLEAR}${HOME}`);
    leave();
    if (process.stdin.isTTY) {
      try { process.stdin.setRawMode(false); } catch {}
      process.stdin.pause();
      process.stdin.removeListener("data", onKey);
    }
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("exit", () => {
    try { leave(); } catch {}
  });

  start();
})();

function printHelp() {
  const help = `\nMatrix Rain Terminal Animation\n\nOptions:\n  --charset <matrix|ascii|binary|hex|custom>  Character set (default: matrix)\n  --chars <string>                             Custom characters when --charset custom\n  --color <name|#RRGGBB>                       Single color (default: green)\n  --palette <rainbow|c1,c2,...>                Multi-colors (overrides --color).\n                                              Example: --palette red,blue,#00ff00\n  --bg <name|#RRGGBB|transparent>              Background color (default: black if provided)\n  --speed <number>                             Speed multiplier (default: 1.0)\n  --density <0..1>                             Fraction of active columns (default: 0.55)\n  --trail <frames>                             Approx fade length in frames (default: 28)\n  --fps <5..60>                                Frames per second (default: 30)\n  --levels <3..12>                             Shading levels (default: 8)\n  --no-alt                                     Do not use alternate screen buffer\n  -h, --help                                   Show this help\n\nExamples:\n  node scripts/matrix-rain.js\n  node scripts/matrix-rain.js --charset binary --color cyan\n  node scripts/matrix-rain.js --palette rainbow --bg black\n  node scripts/matrix-rain.js --charset custom --chars "XO" --palette orange,purple --speed 1.3 --density 0.7\n\nExit: 'q' or Ctrl+C\n`;
  process.stdout.write(help);
}

