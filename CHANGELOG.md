# Changelog

## v1.0.0

First complete release — a browser 3D model of a simple mechanical watch
movement (no dial), built procedurally with Three.js + Vite, with a headless
Vitest suite locking in every kinematic invariant.

### Mechanism

- **Going train** — barrel → center → third → seconds → escape arbor, exact gear ratios.
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
