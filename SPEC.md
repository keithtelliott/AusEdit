# Photo Editor App — Product Spec

Copied 2026-10-17 from the master Claude Doc: https://claude.ai/code/artifact/cf6b6b0f-5836-418e-9004-e545b7dae886
The Claude Doc stays the master copy; update it first, then refresh this file.

## Overview and goals

A web app that edits photos automatically to match an example photo, then lets editors fine-tune with standard sliders. It replaces Capture One for day-to-day editing, while exporting edits and photos back into Capture One.

- **Edit faster:** a batch of 200 photos edited to a reference look in minutes, not hours
- **Stay editable:** every automatic edit is expressed as slider values, never baked-in pixels
- **Stay compatible:** edits open in Capture One as native, adjustable settings

## Users and scope

| Item | Requirement |
| --- | --- |
| Users | A team of editors, each with their own login |
| File types | Camera raw files and JPEGs |
| Typical batch | About 200 photos |
| Capture One | Version 16.3, using sessions (not catalogs) |
| Platform | Web browser (desktop first) |

**Team features:** shared reference looks (presets), shared projects, and a record of who edited what.

**Out of scope for version 1:** local retouching (brushes, healing, masks), printing, and client galleries.

## Core features and user flow

The editor uploads a batch and one example photo; the app proposes slider settings for every photo; the editor reviews, adjusts, and exports.

1. **Upload** a batch of raw or JPEG photos into a project
2. **Choose a look:** upload an example photo, or pick a saved team look
3. **Auto edit:** the app analyzes the example and sets sliders for each photo, adjusting for differences in lighting between shots
4. **Review** the batch in a grid with before/after comparison
5. **Fine-tune** any photo with sliders; copy settings across selected photos
6. **Save the look** as a reusable team preset
7. **Export** Capture One settings files, plus rendered JPEGs if needed

**Slider set for version 1** (chosen to map cleanly to Capture One):

- Exposure, contrast, brightness, saturation
- White balance: temperature and tint
- Highlights, shadows, whites, blacks
- Tone curve (RGB and per channel)
- Color editor: hue, saturation, lightness by color range
- Clarity and structure
- Crop and rotation

## Capture One export

Edits must open in Capture One as normal, adjustable settings on the original files, not as baked-in images.

| Export | What it is | Use |
| --- | --- | --- |
| Per-photo settings (.cos sidecar) | Capture One's XML file holding one image's adjustments | Primary path: drop files beside the originals, Capture One reads the edits |
| Style (.costyle) | Capture One's XML preset file | Apply a team look to many photos inside Capture One |
| Rendered JPEG | Finished image | Delivery or review outside Capture One |

**Requirements**

- Originals are never modified; settings travel as separate files
- Every version 1 slider maps to a Capture One adjustment, or is flagged as app-only
- Export is tested by round trip: edit here, open in Capture One, values match

**Approach:** Capture One's file format is not publicly documented. We map it by making known edits in Capture One and inspecting the saved XML. This is the first build task.

## Architecture and stack

The browser handles editing, live preview, raw decoding and look matching; a server is needed later for team data (phase 6). (The architecture diagram lives in the Claude Doc.)

| Layer | Recommended (to confirm) | Why |
| --- | --- | --- |
| Front end | React + TypeScript | Widely supported; agents write it well |
| Live preview | WebGL in the browser | Instant slider feedback without server round trips |
| Back end | Python (FastAPI) | Strongest libraries for image analysis and raw decoding |
| Raw decoding | LibRaw compiled to WebAssembly, in the browser | Supports most camera raw formats; photos never leave the editor's computer and no server is needed |
| Database | PostgreSQL | Users, projects, looks, edit history |
| File storage | Cloud object storage or office NAS | Depends on where photos live today |

## Build phases

Each phase ends with something an editor can use and test. The riskiest piece, Capture One export, goes first.

1. **Capture One proof of concept:** write a settings file for a few sliders; confirm Capture One reads it correctly
2. **Basic editor:** upload, sliders, live preview for JPEGs
3. **Raw support:** decode common camera raw files
4. **Reference matching:** auto-set core sliders (exposure, white balance, contrast), then expand to curves and color
5. **Batch workflow:** 200-photo grid, copy settings, export all
6. **Team features:** logins, shared projects, shared looks
7. **Polish and speed:** performance tuning, keyboard shortcuts, editor feedback

## Risks and open questions

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Capture One format is undocumented and may change between versions | Export breaks or values drift | Prove it first; keep export code isolated; retest each Capture One release |
| Our sliders render differently from Capture One's | Photo looks different after import | Calibrate against Capture One renders; accept close, not identical |
| Raw decoding varies by camera | Some files fail or look off | Start with the team's main cameras |
| Reference matching quality | Auto edits need heavy correction | Measure against editor corrections; improve over time |

**Open questions**

- [x] Which camera models does the team shoot? **Sony A7 III** (ILCE-7M3, .ARW files)
- [ ] Where do photos live today (local drives, NAS, cloud)?
- [ ] How many editors, and do they work at the same time on one project?
- [ ] Should photos be stored in the cloud, or processed locally and never uploaded?
- [x] Are Capture One sessions or catalogs used? **Sessions** (Capture One 16.3)
