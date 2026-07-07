# watch-simulator

A simple visual model of watch gears that can work together — a 3D simulation of a
mechanical watch movement (no dial), focused on the minimal set of modules and wheels.

Built with **Three.js** + **Vite**. All geometry is generated procedurally in code.

## Features

- **Going train** — barrel → center → intermediate → seconds → escape wheel, with correct gear ratios.
- **Swiss lever escapement** — escape wheel, pallet fork with ruby pallets, balance wheel with hairspring; the whole movement is driven stepwise by the balance ("tick–tock").
- **Motion works & hands** — hour, minute and central seconds hands (12:1), raised to the top of the central staff.
- **Winding** — ratchet, crown wheel and winding crown; "wind the mainspring" animation.
- **Open barrel** — the drum is open so the coiled mainspring is visible inside.
- **Time modes** — demo time (runs from the escapement) and real time (hands follow the system clock while the escapement stays visually coupled).
- **Compact layered layout** — the train is coiled into a tight loop; balance, motion works and central seconds sit on higher Z-layers above it.

## Controls

- Mouse: orbit (LMB), zoom (wheel), pan (RMB).
- `lil-gui` panel: run/pause, time mode, speed, beat rate, amplitude, wireframe, per-node visibility, camera presets, and "wind the mainspring".

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

Build for production:

```bash
npm run build
npm run preview
```

## Versions

The repo keeps two versions side by side:

- **Latest** — the repo root (`src/`). Compact layered layout, open barrel with visible
  mainspring, hands raised to the top of the staff, demo/real time modes. Runs on **port 5173**.
- **Init** — [`init-version/`](init-version/). An earlier snapshot with the original
  spread-out arc layout (balance mounted separately, solid barrel). Runs on **port 5174**.

Run the early version:

```bash
cd init-version
npm install
npm run dev   # http://localhost:5174
```

Both can run at the same time (different ports).
