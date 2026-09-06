# Changelog

## v2.1.2 — 2026-09-07

Housekeeping. Nothing in the running app changes — same scene, same
kinematics, same numbers.

### Changed

- **The workflows moved onto Node 24 actions.** Every action in both
  workflows targeted Node 20, which the runner already forced onto Node 24
  with a deprecation warning; when support is dropped the tests and the Pages
  deploy would have stopped. `checkout` v4 → v7, `setup-node` v4 → v7,
  `configure-pages` v5 → v6, `upload-pages-artifact` v3 → v5, `deploy-pages`
  v4 → v5.

### Removed

- **`springMat`, which drew nothing.** The `LineBasicMaterial` outlived the
  last `Line` in the scene: the mainspring and the hairspring are both solid
  (`springSteel`) and the click spring clones `steel`, so it was threaded
  from `main.js` through `buildMovement` into `tourbillon.js` without ever
  rendering. Its only remaining use was the unreachable half of `springSteel
  || springMat`. The hairspring material is now simply a `springSteel` clone
  — verified identical, and the scene holds 176 meshes and zero lines.

### Fixed

- Three stale details in the README: the balance radius was still documented
  as ≈1.5 where the mesh has 1.95 (and is now derived from the cage radius),
  the cage was still described as two cut-out plates, and the free-mode
  control list did not mention cage opacity or the top plate.

## v2.1.1 — 2026-09-07

Two things the visual overhaul left behind.

### Fixed

- **The hairspring rebuilt its whole mesh every frame.** `updateHair()` made a
  fresh CatmullRom curve and a whole `TubeGeometry`, then threw the previous
  one away: ~5.7 KB of garbage and ~285 µs per frame — more than the rest of
  the movement put together, plus a full GPU buffer re-upload each frame. The
  tube grid (121×9 vertices, indices, UVs) is now built once and only
  `position` and `normal` are rewritten in place. **`setTime`: ~395 µs → ~140
  µs per frame; the hairspring's own allocation goes to zero.** Cross-sections
  are framed from the Z axis rather than by Frenet — the spiral's tangent never
  turns vertical, so that is stable, cheaper, and does not twist the section
  along the coil. Verified against the analytic curve at four balance angles:
  axis, thickness and normal length match to Float32 precision.
- **The two cage controls named themselves in Ukrainian**, so they stayed
  Ukrainian in English. They now go through `i18n`, and a test scans `main.js`
  for Cyrillic in `.name()` literals — key parity cannot catch a string that
  never reaches a dictionary.
- **Cage opacity and top-plate state reset on a language change.** The GUI is
  rebuilt when the language switches, and that state lived inside the builder
  while the cage kept whatever had been applied to it.

## v2.1.0 — 2026-09-06

Finish and detail. The movement was correct but flat-looking; this release
is mostly about what the eye gets, plus the render loop the lesson layer
had quietly made expensive.

### Added

- **Tourbillon cage in detail** — plates extruded with a bevel, pillars with
  caps and screws, timing screws on the balance, and pallet stones as a
  physical material with transmission so the rubies read as stones.
- **Hairspring as a body**, not a line: a swept tube with a Breguet
  overcoil, studded to the cage at one end and the balance at the other.
- **Winding you can read** — a thickened ratchet, a 36-ridge knurled crown
  with bevels, cap and gasket, and an extruded click lever with its ruby
  and spring. Bevel-gear teeth now taper toward the apex, preserving the
  cone invariant.
- **Two cage controls** in free mode: cage opacity and top-plate visibility,
  so the escapement inside can actually be seen.
- A spot light on the cage, so blued steel and rubies stand out without
  blowing out the brass.

### Fixed

- **The render loop allocates again — as in, no longer.** `readouts()` ran
  every frame and rebuilt a dozen objects: 807 B per frame, 2.8 MB a
  minute. Mechanism constants are computed once, rounding no longer goes
  through `toFixed`, and the panel passes a reusable buffer. 807 B → 23 B
  per frame, 3.6 µs → 0.06 µs. Free mode now skips the lesson update
  entirely: it is the pre-lesson app and should not pay for the lesson.
- **The side view kept its own copies of the mechanism's dimensions** —
  the cage radius, the central-seconds module, hand lengths and the
  differential radii were typed into `section.js`, contradicting the
  promise in its own header. Every one of them is now derived from the
  module that owns it. This surfaced a real error: the balance rim was
  drawn at 1.5 where the mesh has 1.95.
- **Dimmed material clones ignored a later wireframe toggle.** Turning on
  the wireframe in free mode and returning to a station left the dimmed
  parts solid while the highlighted ones were wireframe.
- Two Ukrainian strings in the test suite closed their quotes early, so
  Vite could not parse the file and half the suite silently never ran.

### Removed

- `createHighlighter().dispose()` — dead code that implied a managed
  lifecycle the app does not have.

## v2.0.0 — 2026-09-06

A guided layer over the simulator. On open the app is no longer a bare
scene with a panel of engineering knobs: it is a route through the
movement, and the old app is one click away.

### Added

- **Explore mode** — six stops in the order energy flows: winding, barrel,
  going train, escapement, time display, power reserve. Each stop dims the
  rest of the movement, flies the camera to its node, and shows a card:
  the key idea, the formula, one control to turn.
- **Live figures.** No number in a card is typed. `readouts.js` derives
  every figure from the same constants that build the geometry, so a card
  cannot drift from the mechanism. This caught a false claim during
  development: a card said the seconds wheel "still" takes 32 s at any
  rate — both periods scale with the rate; only their ratio does not.
- **Two honesty markers.** Green names the test that backs the claim, and a
  meta-test asserts every referenced test exists, so the badge cannot
  quietly become a lie. Amber marks where the model departs from horology.
- **Side view** — a developed section along the chain, not a projection: an
  orthographic side view collapses Y and would drop the tourbillon cage on
  the differential. Heights are true, arbors sit at their real centre
  distances, so every pinion touches its neighbour exactly at the pitch
  circles. Vertical exaggeration is measured, not asserted.
- **Summary.** Each stop leaves a sentence; the end assembles all six into
  a description of the going, and hands over to free mode.
- **Ukrainian and English** throughout, including the 3D labels and the
  free-mode panel. Wheel names are horological, not literal: the third and
  fourth wheels are not "intermediate" and "seconds".
- **Interface fonts ship with the repo** (OFL 1.1), so typography does not
  depend on the network.
- The version is shown in the header, taken from `package.json` at build.

### Changed

- **Free mode** is the v1.1.0 app unchanged — verified by a scene-graph
  diff across four states, zero differences — reachable from the header
  and from the end of the route, with its own way back.
- Modules tag what they create (`userData.mod`), which is what lets a
  station light the barrel without the rest of the train: scene groups are
  mixed by purpose, so dimming by group could not express a station.
- 59 tests (was 34).

## v1.1.0 — 2026-09-06

### Changed

- **`movement.js` split into per-subsystem modules.** It was 798 lines with a single
  ~750-line `buildMovement`; it is now a ~230-line composer over `train.js`,
  `barrel.js`, `motionWorks.js`, `winding.js` and `powerReserve.js` (plus
  `common.js` for shared constants and helpers), mirroring the documented modules.
  Each module is two-phase: `layout…()` returns positions **and its own extents**,
  so bounds and the plate radius are known before any mesh exists; `build…()` then
  creates meshes and returns its own `update()`. Behaviour is unchanged — a
  scene-graph diff against the previous build (660 meshes across six states) shows
  zero differences.
- The escape arbor is labelled **"Анкерний вузол"** rather than "Анкерне колесо":
  it carries no escape wheel any more, it *is* the tourbillon cage.

### Fixed

- Removed a duplicate label: the escape arbor and the tourbillon cage share one
  axis, so their two 3D labels overlapped. The axis is now labelled only
  "Турбійон".
- Merged the duplicate entry in the node-visibility list for the same reason —
  one "Турбійон" toggle instead of "Анкерне колесо" + "Турбійон (кліть)".

### Docs

- Live demo link and GitHub Pages deployment; `npm run serve` for a static build.
- Corrected the run time: a full wind is ≈ 214 s of demo time, not 160 s — that
  figure is the run from the default starting charge $c_0 = 0.75$.
- Documented that the fixed wheel's post and the cage arbor are coaxial and
  interpenetrate (a real calibre would use a hollow cage arbor).

## v1.0.0 — 2026-07-23

First complete release — a browser 3D model of a simple mechanical watch
movement (no dial), built procedurally with Three.js + Vite, with a headless
Vitest suite locking in every kinematic invariant.

### Mechanism

- **Going train** — barrel → centre → third → fourth → escape arbor, exact gear ratios.
- **Swiss lever escapement** in a **tourbillon** — the whole escapement (escape
  wheel, pallet fork with ruby pallets, balance, hairspring) rides in a rotating
  cage; the escape pinion rolls around a fixed wheel. Timing is unchanged
  (`θ_cage = β`), as a real tourbillon only averages error.
- **Motion works & hands** — hour, minute and central seconds (12:1), raised to
  the top of the central staff.
- **Open barrel** — the drum is open so the coiled mainspring is visible; it
  tightens while winding and unwinds while running.
- **Winding works** — ratchet, crown wheel, a 90° **bevel take-off** to the
  winding stem, and an animated **click**.
- **Power reserve differential** — a real bevel differential (two suns, two
  planets, hand on the carrier) computes the remaining wind as the difference
  between winding and running; real-time mode acts as an auto-winder. Fan-shaped
  sector sub-dial above the barrel.
- **Time modes** — demo time (driven by the escapement) and real time (hands
  follow the system clock).
- **Compact layered layout** — the train is coiled into a tight loop; balance,
  motion works and central seconds sit on higher Z-layers.

### Presentation

- Dark backdrop plate + blued-steel tourbillon cage for contrast.
- Node labels, camera presets (Overview, Hands, Power reserve, Tourbillon),
  visibility toggles, wind button and a live wind-% readout in a `lil-gui` panel.

### Engineering

- 34 headless tests (mesh invariants, train/motion-works/central-seconds ratios,
  escapement stepping, real-time hand angles, winding charge, bevel-pair tangency,
  differential condition, tourbillon cage, layout collision scan).
- GitHub Actions CI on every push.
- MIT licensed.
