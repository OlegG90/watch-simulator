# Changelog

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
