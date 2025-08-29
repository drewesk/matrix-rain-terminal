# Matrix Rain Terminal

A standalone CLI that renders a Matrix-style rain animation in your terminal.

Features
- Works in any modern terminal with truecolor support
- Multiple character sets: matrix (half-width katakana + ASCII), ascii, binary, hex, or custom
- Single color, named color palette, or rainbow across columns
- Optional background color or transparent overlay
- Tunable speed, density, trail length, FPS, and shading levels
- Resizes with your terminal; quit with 'q' or Ctrl+C

Requirements
- Node.js >= 14 (tested with Node 24)
- A TTY (interactive terminal)

Install and run
- Run locally (no install):
  ```bash
  node ./bin/matrix-rain.js
  ```
- Link globally (from this directory):
  ```bash
  npm link
  matrix-rain
  ```
- Or run via npm script (from this directory):
  ```bash
  npm run matrix
  ```

Quick help
```bash
matrix-rain -h
```

Options
- --charset <matrix|ascii|binary|hex|custom>  Choose character set (default: matrix)
- --chars "<string>"                          Used when --charset custom (e.g., "XO+-")
- --color <name|#RRGGBB>                      Single color (default: green)
- --palette <rainbow|c1,c2,...>               Multi-colors across columns; overrides --color.
                                              Example: --palette red,blue,#00ff00
- --bg <name|#RRGGBB|transparent>             Background color or transparent overlay
- --speed <number>                            Stream speed multiplier (default: 1.0)
- --density <0..1>                            Fraction of active columns (default: 0.55)
- --trail <frames>                            Approx fade length in frames (default: 28)
- --fps <5..60>                               Frames per second (default: 30)
- --levels <3..12>                            Shading levels for brightness steps (default: 8)
- --no-alt                                    Avoid alternate screen buffer (draw over your prompt)

Common examples
- Balanced rainbow with darker background and longer trails:
  ```bash
  matrix-rain --palette rainbow --bg black --speed 1.15 --density 0.6 --trail 36 --fps 45
  ```
- Cinematic slow, sparse streams with long trails:
  ```bash
  matrix-rain --palette rainbow --bg black --speed 0.8 --density 0.45 --trail 48 --fps 30
  ```
- Bright, fast ASCII rainbow with extra shading levels:
  ```bash
  matrix-rain --charset ascii --palette rainbow --bg "#000011" --speed 1.4 --density 0.6 --trail 24 --fps 60 --levels 12
  ```
- Overlay on your current prompt (no alternate screen, transparent background):
  ```bash
  matrix-rain --palette rainbow --bg transparent --no-alt --speed 1.0 --density 0.55 --trail 32 --fps 30
  ```
- Two-color palette (hex + named) with black background:
  ```bash
  matrix-rain --charset hex --palette "#00ffcc",purple --bg black --speed 1.2 --density 0.55 --trail 30
  ```
- Custom characters:
  ```bash
  matrix-rain --charset custom --chars "XO+-" --color magenta --bg "#000000"
  ```
  You can include slashes safely. For example:
  ```bash
  matrix-rain --charset custom --chars "ABCD+-*-/" --color "#00ffcc" --bg "#000000"
  ```

Tips
- Exit any time with 'q' or Ctrl+C
- Resize your terminal to change the canvas size dynamically
- For crisp visuals, use a terminal that supports 24-bit color (truecolor)
- If your terminal feels slow at high FPS, reduce --fps, --density, or --trail

Named colors supported
black, white, gray/grey, red, green, blue, cyan, magenta, yellow, orange, purple, pink

License
MIT
