# AusEdit

Web photo editor that matches a reference look and exports to Capture One. See [SPEC.md](SPEC.md).

## Status

Live at https://keithtelliott.github.io/AusEdit/ (updated on every push to `main`).

Working: batch import of JPEGs and camera raw files (Sony A7 III tested), grid and edit views,
basic sliders, Levels, Curves, Color Balance, Black & White, Match look (single or batch),
copy/paste settings, JPEG export (full or half size).

Waiting: Capture One `.cos` export (build phase 1) needs sample files from Capture One 16.3.

## Run the editor

Requires Node 20+.

```sh
cd web
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173).

- **Add photos…** / **Add folder…**, or drag files onto the window
- Grid: click, Shift-click (range), ⌘/Ctrl-click (add); ⌘/Ctrl-A selects all; double-click or Enter opens a photo
- Edit: ← / → step through photos; Esc returns to the grid
- **\\** or **Show original** toggles before/after
- Double-click a slider or its name to reset it

Sample raw files go in `samples/` (ignored by git; the repo is public).
`npm test` runs the unit tests.
