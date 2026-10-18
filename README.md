# AusEdit

Web photo editor that matches a reference look and exports to Capture One. See [SPEC.md](SPEC.md).

## Status

Phase 2 (basic editor) in progress: open a JPEG, adjust sliders, live WebGL preview.
Phase 1 (Capture One export proof of concept) is waiting on sample `.cos` files from Capture One 16.3.

## Run the editor

Requires Node 20+.

```sh
cd web
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173).

- **Open photo…** or drag a JPEG onto the window
- **\\** or **Show original** toggles before/after
- Double-click a slider or its name to reset it
