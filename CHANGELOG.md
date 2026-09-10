# Changelog

## Unreleased

A third mode, one language, one snapshot fewer.

### Added

- **The escapement model** — a third mode, and an exhibit rather than a third
  view of the movement. Inside the movement the escapement runs at movement
  scale and movement speed, where lock, unlock, impulse and drop blur into a
  single flip. Here one lever escapement stands alone and large, with its own
  play/pause, a step to the middle of the next stage, and a readout naming the
  phase and the pallet holding the lock.
- **The stones are seated, not drawn.** Each pallet's locking corner is solved
  onto the tip of the tooth that locks it, and the impulse face follows the
  tip's retreat. The opening pose sits on a measured lock angle
  (`WHEEL_LOCK_PHASE`, found by scan), not on an eyeballed one.
- **The exhibit is isolated by a test, not by agreement.** Nothing under
  `src/showcase/` may import from `movement`, `escapement`, `lesson`,
  `settings` or `motionWorks`; a text test fails if it does. The alternative
  was contact kinematics inside the socket, which every variant would then have
  had to satisfy — the tourbillon included.
- **A guard for the repository's one language.** `src/` may hold no Cyrillic
  outside the two dictionaries that are the Ukrainian interface copy, plus the
  language switch's own label. Sabotage-verified.

- **The exhibit's escapement runs on contact.** The balance is the input, its pin
  drives the lever, and the wheel follows the pallets — which are no longer
  shapes with chosen angles but the **conjugate profiles of the action**: for
  every lever angle in a phase, the acting tooth's toe is put where the phase
  says the wheel stands, and the run of those places is the face. Contact
  through the phase is then true by construction, and a polygon intersection
  that knows nothing of the construction checks it.

  What comes out of it, measured rather than set: a beat advances the wheel
  exactly half a pitch (a result of the pallets spanning two and a half teeth,
  written down nowhere); the draw is the 12° a watchmaker would specify, with
  the recoil solved from it per stone; the lift is the 50° the pin's orbit was
  solved for. The impulse is not a choice at all — a beat moves the wheel half a
  pitch, so the impulse is what the recoil and the drop leave.

  Two figures are magnified four times, because a real lock and a real drop
  would be invisible at this size, and the panel tells the viewer so.
- **The safety action.** The guard pin catches the lever if it is knocked off
  its banking, and the crescent in the safety roller is the one place it may
  pass. Solved rather than placed: the pin's position gives a catch after 7.5%
  of the lever's travel — half the share the unlocking needs — and the
  crescent's half-angle and depth are measured from the passage the guard makes.
  Through a correct beat the guard never touches. A push in the panel
  demonstrates it, live only between beats, and the pin and roller light when
  they are what holds the lever.
- **The lever is cut as one piece** — boss, both pallet arms, the shank with the
  notch, the counterpoise — instead of a boss with plates added to it. The arms
  reach the corners the design traced and the notch is the one the contact is
  solved with; only the widths are aesthetic.

### Fixed

- **The showcase bar stopped clipping its own readout.** It was a fixed width,
  and the phase cells are the only flexible thing in the row, so every control
  added collapsed them to an ellipsis while everything else still looked right —
  three times. The bar now takes the width its content needs, with a floor so the
  Play/Pause toggle cannot make it breathe.
- **A step was wider than the stage it existed to show.** The step advanced a
  fixed ⅛ of a beat while the impulse is about 0.054 beat wide, so stepping from
  a lock went unlock → drop and the impulse was never seen. There is no step
  constant any more: a press asks the phase machine for the middle of the next
  stage, so the four stages take four presses and each landing sits as far from
  its boundaries as the stage allows.
- **The pallets changed hands half a window early.** The caption named the
  receiving pallet from the beat onwards, though one stone is unlocked and
  impulsed and only the drop hands over to the other. Nothing showed it while
  the step jumped over that point; the moment a press landed on the beat exactly,
  the name flipped mid-impulse. The handover is now at the drop.
- **No way back to the home view.** Showcase mode has no camera presets, so one
  orbit could leave the exhibit off-screen with nothing but a page reload to
  recover it. The bar now carries the flight home. The bar itself grew with it:
  the fourth control overflowed the fixed width, and the overflow was silent —
  the phase cells are the only flexible thing there, so they collapsed to an
  ellipsis while everything else looked right.

### Changed

- **English is the repository's one language.** Comments, tests and prose were
  Ukrainian for most of the project's life, which split the record in two: the
  comment explaining a trap in one language, the file naming it in another, and
  neither searchable from the other. The Ukrainian interface copy stays exactly
  where it belongs — `i18n.js` and `lesson/content.js`.
- **The record caught up with the code.** `AGENTS.md` still described two modes
  and four suites; `README.md` did not contain the word *showcase* at all. Both
  now carry the third mode, its isolation and what that isolation costs — one
  constant deliberately living in two files, so that nobody "fixes" it with an
  import and breaks the isolation test.
- The showcase fork is one lever stamping instead of bars bolted to a boss, the
  banking pins stand on a bridge rather than in mid-air, the balance rim is a
  machined rectangular section, and the hairspring reaches the rim instead of
  floating inside an empty wheel.

### Removed

- **`init-version/`** — the early snapshot, its dependencies and its section in
  the README. It had not been built or tested for months; git history is a
  better record of where the project started than a directory nobody runs.

## v3.0.0 — 2026-09-07

The escapement stops being one module and becomes a **socket** holding one of
several. The app now opens with a plain Swiss lever escapement; a tourbillon
can be installed in its place, and a double-axis tourbillon is shown as the
next step without pretending to exist.

The point is not configurability. It is that one function can be filled by
units of wildly different complexity — and that in this model the extra
complexity buys nothing. Swapping the escapement in front of the viewer moves
**no number on the station card**, because the card now shows only what a swap
cannot move. That is the strongest statement of the station's own claim.

### Added

- **The escapement socket.** All modules are built at startup, exactly one is
  installed, and only the installed one is updated. A module hands the socket
  a rotating group, a fixed group and `update() → β`; how many nested cages it
  has, and about which axes, is its own business — which is what lets a
  double-axis module arrive later without touching the socket.
- **The Swiss lever escapement**, restored from v0.5.0 (the tourbillon had
  deleted it) and adapted to the two-phase contract. The parts swap places: in
  a tourbillon the balance is central and the escape wheel orbits; in a lever
  the escape wheel is central — the train drives it directly — and the balance
  moves out to that same 2.6.
- **The Variants modal** on station 4: three modules with silhouettes, the cost
  table, one honesty line, and a keep-as-is / change pair of buttons. The mechanism keeps
  running while it is open — pausing would break the very thing being shown —
  and the camera flies to the escapement after a change.
- **The cost of complexity, measured.** parts · of them moving · nested
  rotations · footprint, all obtained by walking each module's own scene graph.

  | | parts | moving | nested | footprint |
  |---|---|---|---|---|
  | Lever escapement | 18 | 16 | 1 | 4.73 × 2.95 |
  | Tourbillon | 50 | 48 | 2 | 4.32 × 5.20 |

  The lever's footprint is *wider*: its balance is carried out to one side
  while the cage keeps everything inside its rim. The cost shows in part
  count, in how much of it moves, in nesting and in height — not in width. A
  test says so, so it does not get tidied into a neater story later.

### Changed

- **The app opens with the lever**, not the tourbillon, so the progression
  reads simplest-first. The choice belongs to the mechanism rather than to a
  mode or a session, and nothing about it is stored: every reload starts over.
- **Station 4 shows only variant-independent figures.** "Cage turn" becomes
  "escape arbor turn" — the same 12 s, but named after what is actually
  invariant. The escape *wheel* does differ (12 s against 6 s) and that moved
  into the module descriptions, in words rather than as a typed figure.
- **The developed section follows the installed module.** The lever draws
  three bodies at their true heights and no plates, which is the cost of
  complexity shown without a number.
- **The beat maths lives once**, in `escapement/beat.js`. It had already been
  copy-pasted verbatim between v0.5.0's escapement and the tourbillon — same
  constants, same smoothstep. Identical timing across modules is now
  structural rather than a rule someone has to remember. The hairspring moved
  out for the same reason.
- The escapement socket owns its scene chrome (`part.escapement`), because the
  camera preset, the 3D label and the node toggle are built once and would
  otherwise keep the previous module's name after a swap.

### Fixed

- **Units were never translated.** "12 с" stayed Cyrillic in English: the unit
  was written into `stations.js` rather than the dictionary, and key parity
  cannot see a string that never reaches one. A test now scans every station
  stat for Cyrillic. This predates the release.
- **"seconds wheel" contradicted "Fourth wheel"** — the same part named two
  ways, which the design notes warn about specifically. Also predates it.

### Notes

Stage 1 of the branch was a pure refactor, and every commit in it was verified
by a scene-graph diff against `main`: 704 meshes across idle, demo, manual
wind and auto-wind, zero differences. That is how a crown-spin regression was
caught once before, and tests alone had missed it.

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
- The escape arbor is labelled **"escape arbor"** rather than "escape wheel":
  it carries no escape wheel any more, it *is* the tourbillon cage.

### Fixed

- Removed a duplicate label: the escape arbor and the tourbillon cage share one
  axis, so their two 3D labels overlapped. The axis is now labelled only
  "tourbillon".
- Merged the duplicate entry in the node-visibility list for the same reason —
  one "tourbillon" toggle instead of "escape wheel" + "tourbillon (cage)".

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
