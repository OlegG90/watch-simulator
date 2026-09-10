# watch-simulator

[![tests](https://github.com/OlegG90/watch-simulator/actions/workflows/test.yml/badge.svg)](https://github.com/OlegG90/watch-simulator/actions/workflows/test.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**▶ Live demo: <https://olegg90.github.io/watch-simulator/>**

A simple visual model of watch gears that can work together — a 3D simulation of a
mechanical watch movement (no dial), focused on the minimal set of modules and wheels.

Built with **Three.js** + **Vite**. All geometry is generated procedurally in code.

## Features

- **Going train** — barrel → centre → third → fourth → escape arbor, with correct gear ratios.
- **Escapement socket** — the movement always holds exactly one escapement, and it can be swapped: a **Swiss lever escapement** (escape wheel, pallet fork with ruby pallets, balance with hairspring) or a **tourbillon**, where the whole escapement rides in a rotating cage around a fixed wheel. A double-axis tourbillon is planned. The rate is identical in all of them — what differs is the cost, and that is measured rather than claimed.
- **Motion works & hands** — hour, minute and central seconds hands (12:1), raised to the top of the central staff.
- **Winding** — ratchet, crown wheel and winding crown; "wind the mainspring" animation.
- **Open barrel** — the drum is open so the coiled mainspring is visible inside.
- **Power reserve differential** — a real bevel differential (two suns, two planets, hand on the carrier) computes the remaining wind as the difference between winding and running; real-time mode behaves like an auto-winder.
- **Time modes** — demo time (runs from the escapement) and real time (hands follow the system clock while the escapement stays visually coupled).
- **Compact layered layout** — the train is coiled into a tight loop; balance, motion works and central seconds sit on higher Z-layers above it.

## Three modes

**Explore** is what opens: six stops in the order energy flows through the movement —
winding, barrel, going train, escapement, time display, power reserve. A stop dims
everything but its own parts, flies the camera to it, and shows a card with the key
idea, the formula and one control to turn. Each stop leaves a sentence behind; the
summary at the end assembles all six into a description of the going.

Two markers keep the cards honest. Green names the test that backs the claim — and a
meta-test asserts every referenced test actually exists, so the badge cannot quietly
become a lie. Amber marks where the model departs from real horology (the same
departures listed under *Assumptions* below).

No figure in a card is typed: every one is derived from the constants that build the
geometry, so a card cannot drift from the mechanism it describes.

Each stop can be seen **from the side** — a developed section along the chain rather
than a projection. An orthographic side view collapses Y and would drop the tourbillon
cage onto the differential; here heights are true and arbors sit at their real centre
distances, which is why every pinion touches its neighbour exactly at the pitch circles.

**Free mode** is the movement with every control at once — run/pause, time mode, speed,
beat rate, amplitude, per-node visibility, camera presets, winding. It is reachable from
the header and from the end of the route, and has its own way back.

**The escapement model** is a separate exhibit rather than a third view of the same
movement. Inside the movement the escapement runs at movement scale and at movement
speed, where lock, unlock, impulse and drop blur into one flip; here one lever
escapement stands alone, large, with its own play/pause, a step that advances to the
middle of the next stage, a way back to the home view, and a readout naming the current
phase and the pallet doing the work.

**It runs on contact, not on a schedule.** The balance is the input; its pin drives the
lever through the notch; the lever's travel is what the pallets were traced from, so the
wheel's angle follows from the faces rather than from an eased window. Who pushes whom
changes at the release, and so does the flank of the notch in contact — the balance
drives the lever off the lock, then the wheel drives the lever, which runs ahead and is
held back by the other flank, and that is how the impulse reaches the balance.

**What holds the lever between beats is the guard pin**, not the draw alone: knocked off
its banking the lever butts the safety roller and stops, well before the lock could come
off, and the crescent cut into that roller is the one place it may pass — facing the lever
exactly while the impulse pin is in the notch. A control in the panel pushes the lever so
you can watch it be caught; it is live only between beats, because that is the only time
anything is holding the lever that a push could argue with.

The pallets are the **conjugate profiles** of that action: for every lever angle in a
phase, the acting tooth's toe is put where the phase says the wheel stands, and the run
of those places is the face. So a beat advances the wheel by exactly half a pitch — a
result of the pallets spanning two and a half teeth, written down nowhere — the draw
comes out at the 12° it was asked for, and the lift at the 50° the pin's orbit was solved
for. Two figures are magnified four times, because a real lock and a real drop would be
invisible at this size: the panel says so. It shares no code with the movement's
escapement — see *Source layout*.

The interface is Ukrainian and English, including the 3D labels; wheel names follow
horological usage rather than literal translation.

## Mechanism elements

Notation: $m$ — module, $z$ — tooth count, $s = 2\pi/z$ — angular tooth pitch, $r = mz/2$ — pitch radius, $\omega$ — angular velocity (sign = direction).

### Common meshing formulas

- Center distance of a pair: $a = r_A + r_B = \dfrac{m(z_A+z_B)}{2}$
- External mesh: $\omega_B = -\omega_A\,\dfrac{z_A}{z_B}$
- Initial phase of the driven gear ("tooth into gap" along the line of centers, direction $\theta$):

$$\varphi_B = \theta + \pi - \frac{s_B}{2} + \frac{z_A}{z_B}\big((\theta-\varphi_A)\bmod s_A\big)$$

- **Mesh verification invariant** (must stay $\equiv 0$) for current gear angles $R_A, R_B$:

$$u = \frac{(\theta - R_A)\bmod s_A}{s_A},\qquad v = \frac{(\theta+\pi-\tfrac{s_B}{2}-R_B)\bmod s_B}{s_B},\qquad u+v \equiv 0 \pmod 1$$

Measured: error **0** on every mesh at arbitrary drive angles.

### 1. Mainspring barrel

Barrel wheel 48 teeth ($m=0.35$, $r=8.4$), 5 spoke windows; open drum (wall + floor, $R=7.2$), steel core $r=0.85$. Speed reference for the train: $\omega_0 = 1$.

### 2. Mainspring

- Archimedean spiral: $r(t) = r_{in} + (r_{out}-r_{in})\,t$, $\theta(t) = 2\pi N t$, $t\in[0,1]$, $r_{in}=1.05$.
- Wind state $c\in[0,1]$: $r_{out}(c) = 6.8 - 1.2c$, $N(c) = 3.4 + 3.6c$ (tighter = more coils, smaller radius).
- Winding and drain are computed by the **differential** (see §12): the charge is derived from the ratchet and barrel-wheel angles; one click $= +0.375$, a full wind ≈ 213 s of demo running (2.5 beats/s); at $c=0$ the movement stops.
- Verified: the coil radius is monotonic in charge (the spring shape always agrees with the reserve hand).

### 3. Going train

| # | Node | Pinion $z_p$ | Wheel $z_w$ | $\omega$ vs barrel |
|---|---|---|---|---|
| 0 | Barrel | — | 48 | $1$ |
| 1 | Centre wheel | 12 | 40 | $-4$ |
| 2 | Third wheel | 12 | 36 | $+40/3 \approx 13.33$ |
| 3 | Fourth (seconds) wheel | 12 | 32 | $-40$ |
| 4 | Escape-wheel arbor | 12 | 15 (escape) | $+320/3 \approx 106.67$ |

$$\omega_k = -\,\omega_{k-1}\cdot\frac{z_{w,k-1}}{z_{p,k}}$$

Verified: measured angle increments $=[1,\,-4,\,+13.333,\,-40,\,+106.667]$ — exact.

### 4. Escape wheel

15 ratchet-shaped teeth (steep locking face + sloped back), pitch $s_E = 24°$. Advance per balance beat is half a tooth pitch: $\Delta E = \pi/15$; wheel angle $E(u) = \frac{\pi}{15}(n-1+ss)$ with $n=\mathrm{round}(u)$ and $ss$ a smoothstep inside the flip window $|u-n|\le 0.12$. Verified: stationary between beats, exactly $\pi/15$ per beat.

### 5. Pallet fork (anchor)

Pallets at $\pm30°$ from the line of centers (span 2.5 teeth), fork throw $F_{max}=0.14$ rad; $F(u) = -F_{max}\,\sigma(n)\,(2\,ss-1)$, $\sigma(n)=(-1)^n$. Verified: alternates $-0.14/+0.14/-0.14$ rad at rest.

### 6. Balance wheel

- $\theta_b(u) = A\sin(\pi u)$, $u = t\,f_{beat}$; amplitude $A$ = 90–270°, beat rate $f_{beat}$ = 0.5–6 beats/s (sliders).
- Balance zero crossings (integer $u$) trigger the fork flip and the escape-wheel step. **The whole movement is driven by the escapement:** $driveAngle = \beta/\omega_4$, where $\beta$ is the tourbillon cage angle (§6a).
- In the tourbillon the balance is at the **cage center** (coaxial with the fixed wheel). Its radius is derived from the cage, not set on its own: $r_{bal} = \min(1.95,\ r_{cage} - 1.95) = 1.95$, exported as `balanceR(cageR)` because the developed section draws from the same number.
- Verified: $\theta_b$ at half-beat $=A$ exactly, at beat $=0$ exactly; seconds-wheel period $= 32$ s at $f_{beat}=2.5$ (the tourbillon does not change timing).

### 6a. The escapement socket

The escapement is a **socket** holding exactly one module at a time. Whatever is in it, the train is driven by the same angle — the escape arbor's — so swapping the module changes no timing and no figure on the station card. That is the point of the thing: one function, units of wildly different complexity.

The beat maths lives once, in `escapement/beat.js`, and a module only maps that phase onto its own geometry. `β` is therefore physically one, and identical timing cannot be broken by accident.

A module hands the socket `{ rotating, fixed, update() → β, nodes }` and nothing else. `nodes` are its own controls for the free-mode panel — the lever offers escape wheel, pallet fork and balance; the tourbillon offers fixed wheel, balance, cage opacity and top plate. The panel asks the socket for the **installed** module's controls and never names a variant, so it cannot show one module's parts beside another's.

| | parts | of them moving | nested rotations | footprint (r × h) |
|---|---|---|---|---|
| Lever escapement | 18 | 16 | 1 | 4.73 × 2.95 |
| Tourbillon | 50 | 48 | 2 | 4.32 × 5.20 |
| Double-axis tourbillon | — | — | — | — |

Every figure is measured by walking the module's own scene graph (`escapement/metrics.js`), never typed; the planned module has none because there is nothing to walk yet. Note that the **lever's footprint is wider** — its balance is carried out to one side, while the cage keeps everything inside its rim. The cost of complexity shows in part count, in how much of it moves, in nesting and in height, not in width.

What the model does **not** show is what a tourbillon is *for*: a scripted kinematic has no positional error to average away (see assumption 12).

#### Lever escapement

The escape wheel sits directly on the escape arbor (arbor4), so it turns by exactly $\beta$ — once per 12 s at 2.5 beats/s. The fork and balance stand on the plate and turn about their own axes. The balance sits 2.6 from the arbor with radius 1.95 — deliberately the same position and size the tourbillon gives it, so that a swap moves only the construction (assumption 11).

#### Tourbillon

The entire escapement (escape wheel + pallet fork + balance + hairspring) lives inside a **rotating cage**. The cage IS the escape arbor (arbor4): it carries the pinion (12) that meshes the seconds wheel and turns as the cage. The escape pinion ($Z_p$) rolls around a **fixed wheel** ($Z_f$) at the cage center.

- **Key identity:** with $Z_f = Z_p$ the cage angle equals the escapement beat, $\theta_{cage} = \beta\cdot\frac{Z_p}{Z_f} = \beta$. So $\theta_{cage}$ **replaces** the old escape-wheel angle in the drive — the movement's timing is unchanged (the tourbillon doesn't affect the rate, it only averages the error — physically correct).
- Cage period = the old escape arbor's period = **12 s** (at 2.5 beats/s); the escape wheel relative to the cage is also 12 s/rev, so 6 s/rev absolute.
- The fixed wheel stays put (pinned to the plate through a post to the cage center); the cage, balance, fork and escape wheel rotate around it.
- Compact geometry: cage module $m_T=0.26$, $Z_f=Z_p=10$ → escape arbor 2.6 from center; cage radius 4.3, fitting the existing footprint (the plate does not grow). The cage is two bevelled plates (0.11 thick) on three pillars with caps and screws; the pallets and the balance's impulse jewel are a physical material with refraction ($n=1.76$), and the hairspring is a swept tube with a Breguet overcoil rather than a line.
- Verified: cage = arbor4.group, 12 s period; the fixed wheel does not rotate while the cage does; escape wheel relative to cage = $\beta$; seconds-wheel period 32 s; real-time hand angles exact.

### 7. Hairspring

Polyline of 200 points: $\alpha(f) = \theta_b(1-f) + f\Phi - \Phi + \lambda$, $r(f) = r_0 + (r_1-r_0)f$, $\Phi = 2\pi\cdot 4.5$. Outer end ($f{=}1$) pinned to the stud, inner end ($f{=}0$) rotates with the balance — the "breathing" effect.

### 8. Motion works

- Cannon pinion (12) → minute wheel (36): ×3; minute-wheel pinion (10) → hour wheel (40): ×4. Total $12{:}1$, same direction (two external meshes).
- The two meshes use different modules so they share one center distance: $\dfrac{m_1(12+36)}{2} = \dfrac{m_2(10+40)}{2} \Rightarrow m_2 = m_1\cdot\frac{48}{50}$ ($m_1=0.28$).
- Verified: $\omega_{hour}/\omega_{center} = +\frac{1}{12} = 0.08333$ exactly; both mesh invariants = 0.

### 9. Central seconds train

- Drive wheel (48) on the seconds arbor → idler (20) → center pinion (8). The idler preserves direction and does not affect the ratio: $i = 48/8 = 6$.
- Combined with the train ($\omega_3/\omega_1 = 10$): **central seconds : minute axis = 60:1**.
- Module fitted to the actual axis distance $d$: $m = \dfrac{d}{\frac{48+8}{2} + 20}$; the idler sits on the line between the axes.
- Verified: measured ratio $=60.0000$; both mesh invariants = 0.

### 10. Hands

- Hour (L 5.6, z 9.9) < minute (L 7.0, z 10.25) < seconds (L 7.4, z 10.7) — on concentric pipes at the top of the central staff, above every wheel (highest wheel z≈9.45).
- Real-time mode: hand angle $=\dfrac{\pi}{2} - 2\pi u$, where $u$ is the fraction of a revolution (hour: $\frac{h + m/60 + s/3600}{12}$, minute: $\frac{m + s/60}{60}$, seconds: $\frac{s}{60}$).
- Verified: hand-angle error at control times (3:00, 9:00:30, 12:30:15, 6:45:52) = 0 for all three hands.

### 11. Winding works

- Chain: crown → winding stem → bevel pinion (8) → bevel wheel (16) → crown wheel (18) → ratchet wheel (28) on the barrel arbor.
- **The click** — a lever on a post whose tip rests on the ratchet teeth. It is the one-way valve of the winding works: it lets the ratchet turn in the winding direction (hopping over the teeth — the familiar "click-click" of winding a watch) and blocks the mainspring from unwinding back through the winding chain, so the spring's energy can only escape into the going train. The click is also what holds the winding input still while the watch runs — the very condition the power reserve differential (§12) relies on.
- Click animation: lever angle follows the tooth phase, $\alpha_{cl}(w) = 0.07\cdot\dfrac{w \bmod s_R}{s_R}$, $s_R = \dfrac{2\pi}{28}$ — slow rise, sharp drop ("click") on every tooth; active during manual winding and auto-winding.
- Verified: at rest the lever sits in the valley (0); while winding it rises within the 0.07 rad travel with ≥3 drops per winding click.
- **90° bevel pair:** $\tan\delta_w = \dfrac{z_w}{z_p} \Rightarrow \delta_w \approx 63.4°$, $\delta_p \approx 26.6°$, $\delta_w+\delta_p = 90°$; the apexes of both pitch cones meet at a **common point** on the axis intersection; each gear ring sits at $R/\tan\delta$ along its own axis; shared cone distance: $L = \dfrac{R_w}{\sin\delta_w} = \dfrac{R_p}{\sin\delta_p} = 2.95$.
- Winding kinematics: ratchet $+\omega$; crown-wheel assembly $-\omega\cdot\frac{28}{18}$; stem/pinion/crown $+\omega\cdot\frac{28}{18}\cdot\frac{16}{8}$.
- Verified: distance between the bevel pitch circles = **0.0000** (tangent); apex distance = 0; the barrel wheel stays still while winding.

### 12. Power reserve differential

- **A real bevel differential, COAXIAL with the barrel** — the whole module sits on the barrel axis with its fan-shaped sector scale (120° + margins, not a full ring) floating right above the barrel (both inputs are already on that axis, so no long transfer trains).
- Winding input: ratchet → straight pipe → **upper sun** (16), $R_A = 1$. Running input: barrel wheel → hub wheel (32) → compound idler (pinion 8 + wheel 20) → sun-pipe wheel (20) → **lower sun** (16), $R_B = \frac{32}{8}\cdot\frac{20}{20} = 4$; both pairs share one center distance $\frac{(32+8)m}{2} = \frac{(20+20)m}{2} = 6.0$.
- Two planets (10) on a **cage carrier** (a ring around the suns with inward stub axles — the planet axle cannot cross the center, the pipes live there); the hand sits on the carrier bridge above the upper sun.
- Differential condition: $\theta_C = \dfrac{\theta_{up} + \theta_{low}}{2} + const$. Cones: $\delta_s \approx 58°$, $\delta_{pl} \approx 32°$, common apex.
- **The charge is derived, not a separate state:** $c(w,\beta) = c_0 + \dfrac{R_A w - R_B \beta}{2\,\Delta}$, $\Delta = 120°$. The winding arbor **counter-rotates** relative to the running direction — the reversal the offset gear pair used to provide is now in the spin direction.
- While winding the lower sun stands still (the train holds the barrel); while running the upper sun stands still (the click holds the ratchet).
- **Real-time mode acts as an auto-winder:** $dw = (R_B/R_A)\,d\beta = 4\,d\beta$ — the ratchet creeps, the reserve hand holds steady while both suns turn.
- Stops: at $c = 1$ the crown stops taking turns; at $c = 0$ demo mode halts the movement.
- Numbers: one click (a quarter-turn of the ratchet) = $+0.375$ charge; a full wind ($c=1$) runs ≈ 213 s (≈ 3.6 min) of demo time at 2.5 beats/s, and the default starting charge $c_0=0.75$ gives ≈ 160 s.
- Z-stack above the barrel: hub wheel 1.85 → ratchet 2.6 → compound 3.3 → suns/planets 4.4–7.8 → carrier bridge 7.95 → sector scale 8.55 → hand 8.85.
- Verified: the differential condition holds to 12 digits; sun immobility per mode; mesh invariants of both running-path pairs = 0; auto-winder behaviour; full-wind stop.

### 13. Main plate & jewels

- Plate radius: $R_{plate} = \max\Big(\tfrac{\sqrt{W^2+H^2}}{2},\ \max_i\big(|p_i-c| + r_i\big)\Big) + 1.8$ over all nodes (train, escapement, hands, motion works, winding).
- Ruby jewels under every arbor; `movement.bounds` exposes $minX/maxX/minY/maxY$, center and $R_{plate}$ for checks.

## Assumptions & simplifications

1. **Kinematics, not physics.** All motion is scripted through gear ratios; torque, friction, inertia and elasticity are not modeled.
2. **Simplified tooth profile** (trapezoidal, not involute): mesh phasing is exact (invariant = 0), but tooth surfaces are not conjugate — teeth may locally interpenetrate at high zoom.
3. **Compressed time scale:** the seconds wheel turns once per 32 s (at 2.5 beats/s), the "minute" axis ~5.3 min, the "hour" axis ~64 min. Ratios are exact (60:1, 12:1), absolute periods are not.
4. **Real-time mode:** hands are overlaid on top of the train (separate subgroups) and visibly "slip" against their wheels; the escapement stays coupled (a deliberate trade-off — the compressed model's mismatch is moved from the escapement to the hands).
5. **Bevel pair:** pitch cones are geometrically exact (tangency = 0), but tooth phasing is approximate — profiles are not conjugate.
6. **Mainspring:** its shape is interpolated from the charge; ribbon length is not conserved and spring torque is not modeled. The run time (≈ 213 s from a full wind, ≈ 160 s from the default $c_0=0.75$) follows from the differential's ratios, not from spring physics.
7. **Hairspring** "breathes" in a simplified way (linear angle interpolation along the coils), without length conservation.
8. **Winding** moves during the button animation and auto-winding; the click ratchets kinematically (angle from the tooth phase), but physical contact and locking are not modeled.
9. **No bearings/bridges:** arbors float visually; the plate is decorative.
10. **Power reserve differential:** the kinematics are exact (carrier condition, sun immobility, mesh invariants), but sun↔planet bevel tooth phasing is approximate (profiles are not conjugate), the sector scale floats without bridges, and the winding input is taken off the ratchet rather than the barrel arbor (equivalent — they are rigidly coupled).
11. **The lever's balance placement:** the balance sits 2.6 from the escape arbor with radius 1.95 — exactly where and how big the tourbillon's is. A real lever escapement would put it further out and make it larger. This is deliberate: swapping the module should change **only the module**, and if the balance moved too, the viewer would be comparing two pictures rather than two solutions.
12. **Tourbillon:** kinematics are exact (cage angle = $\beta$ with $Z_f=Z_p$, timing unchanged, escape pinion rolls around the fixed wheel), but escape-pinion↔fixed-wheel tooth phasing is approximate and the physical purpose of a tourbillon (averaging the balance's positional error) is not reproduced in a scripted model — it is a purely visual/kinematic complication. The fixed wheel's post and the cage arbor are coaxial and interpenetrate; a real calibre would use a hollow cage arbor.
13. **Verification precision:** mesh invariants, gear ratios, hand angles and cone tangency are exact to machine precision (<1e−6); layout collisions are checked by bounding-sphere scans (threshold: XY overlap > 1.3 units with Z intersection).

## Controls

- Mouse: orbit (LMB), zoom (wheel), pan (RMB).
- **Explore**: pick a stop in the left rail; each card carries the one control that
  matters there. Camera presets and the top/side switch sit over the scene; the mode
  and language switches are in the header.
- **Free mode**: the `lil-gui` panel — run/pause, time mode, speed, beat rate,
  amplitude, wireframe, per-node visibility, cage opacity and top plate, camera
  presets, and "wind the mainspring".
- **Escapement model**: a bar over the scene — play/pause, a step to the middle of the
  next stage (lock → unlock → impulse → drop, four presses to the beat), a push that tests
  the safety catch (live only between beats), the home view, a speed slider, and the
  current phase with the working pallet.

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

### Serve as plain static files

`npm run build` produces a self-contained `dist/` (one `index.html` + one bundle),
so it can be served by any static HTTP server — no Node needed.

One-shot build + serve:

```bash
npm run serve   # builds, then http://localhost:8642 (also on your LAN)
```

Or serve an existing `dist/` with any static server:

```bash
python -m http.server 8642 --directory dist
```

## Source layout

One file per mechanism module, mirroring *Mechanism elements* above. `movement.js` is a
composer, not a monolith. The escapement is the exception: it is a socket rather than a
single module, so it gets a folder — the shared beat maths and one file per variant.

```text
src/
  main.js          scene, render loop, lil-gui, time modes
  movement.js      composer: layout → bounds → module assembly → kinematics  §13
  common.js        shared constants and helpers (meshPhase, makeAxle, makeHandAssembly)
  gear.js          procedural geometry: gears, bevel gears, hands, spirals
  train.js         going train (TRAIN table, MESH_ANGLES)                    §3
  barrel.js        barrel and mainspring                                     §1, §2
  escapement/      the escapement socket — one module installed at a time    §4–§7
    index.js       the registry, install(), and "only the installed one runs"
    beat.js        the beat phase, shared by every module
    hairspring.js  the balance spring, shared by every module
    metrics.js     cost of complexity, measured by walking the graph
    lever.js       Swiss lever escapement
    tourbillon.js  cage: escape wheel, fork, balance, hairspring
  motionWorks.js   motion works, central seconds, hands                      §8–§10
  winding.js       ratchet, crown wheel, bevel pair, click, stem             §11
  powerReserve.js  bevel differential and sector scale                       §12
  ui.js            node labels and camera presets
  i18n.js          interface strings, Ukrainian and English
  settings.js      the one table of running parameters: range, step, format, label
  lesson/          the guided layer (see below)
  showcase/        the escapement exhibit (see below)
```

The lesson layer is separate from the mechanism and never reaches into it:

```text
src/lesson/
  panel.js         header, rail, card, chain footer - knows nothing of three.js
  stations.js      the six stops: focus, highlight set, content keys, backing test
  content.js       card copy in both languages
  readouts.js      every live figure, derived from the mechanism constants
  highlight.js     dims all but a station's parts (swaps in dimmed material clones,
                   because materials are shared across dozens of meshes)
  section.js       the developed section as data - a composer over module profiles
  sectionView.js   and as SVG
  variantsModal.js the escapement comparison: silhouettes, the cost table, the swap
  cardText.js      one resolver for card text, shared with the tests
  draw.js          el, svgEl and one linear projector, shared by all three diagrams
  lesson.css       the interface; fonts.css + fonts/ ship the faces (OFL 1.1)
```

The escapement exhibit is not a module of the movement and imports nothing from it:

```text
src/showcase/
  design.js        the escapement itself: the geometry and the contact. The pallets
                   are traced from the action, so the shapes and the poses are one
                   solution; no meshes here and no time
  leverModel.js    the meshes: the wheel, the lever cut as one piece, the balance
                   with its roller and impulse pin, the banking bridge, the stand
  motion.js        the running: the balance drives the lever, the lever the wheel
  spring.js        its hairspring
  bar.js           the controls, inside the scene (showcase CSS hides all else)
```

The isolation is structural, not an agreement: a text test in `test/showcase.test.js`
fails if any file there imports from `movement`, `escapement`, `lesson`, `settings` or
`motionWorks`. The cost is that a couple of numbers exist twice — deliberately, because
the alternative was contact kinematics inside the socket, which every variant would then
have to satisfy.

There is no `escapement.js` — the escapement is a **socket**, `escapement/`, holding one
interchangeable module at a time (§*The escapement socket*). Nothing outside it names a
variant: the socket is the only door.

Every module is **three-phase**:

- `layout…()` returns positions **and its own `extents`** (centre + radius pairs). It runs
  before any mesh exists, so `movement.js` can size the main plate from the whole mechanism
  while no module needs to know about its neighbours.
- `build…()` creates the meshes and returns its own `update()`.
- `profile()` returns the module's own figures — centre distances, z-spans, radii, label
  keys — for the station cards and the developed section. No mesh needed, and no outsider
  re-derives them: the same centre-distance expression used to be typed in three places at
  once, in the module, in `lesson/readouts.js` and in `lesson/section.js`.

Keep that split: it is what lets a module move or grow without touching the rest. A module's
interface is those three functions — not its constant table.

The running parameters follow the same rule from the other side. `settings.js` holds the one
table — range, step, formatter, label key — and both the free-mode panel and the station cards
are adapters over it. Two adapters, so the seam is real: a control declared in one place and
not the other cannot drift, and a card naming a parameter that does not exist now throws
instead of moving a slider that changes nothing.

Two cautions for anyone refactoring the kinematics:

- Almost everything is a pure function of the drive angle, but the winding stem's spin is
  **not** — it accumulates, because auto-winding advances the ratchet without turning the
  crown. Rewriting it as a function of the ratchet angle silently breaks that.
- The test suite alone is not enough cover for a large refactor. Diff the scene graph
  against the previous build (world transform of every mesh across idle / demo / manual
  wind / auto-wind states); that is what caught the crown-spin regression above.

## Tests

```bash
npm test
```

Headless [Vitest](https://vitest.dev/) suite (no browser needed — three.js builds geometry in Node). It locks in every formula from *Mechanism elements*: mesh invariants on all pairs, train/motion-works/central-seconds ratios, escapement stepping and balance phase, real-time hand angles, the winding charge model, bevel-pair tangency (analytic point-to-circle), spiral/gear/hand geometry, and a layout collision scan.

The exhibit has its own suite: the tooth profile and the stones' solved seats, the arbors on the line of centres, the measured lock pose, the phase machine's stepping, and the import isolation above. Three more guards read source text rather than objects — no GUI label may bypass `t()`, and `src/` may hold no Cyrillic outside the two dictionaries that are the Ukrainian interface copy.

The Explore layer is covered too. `test/panel.test.js` runs under **jsdom** (declared per file, so the geometry suites keep the faster Node environment): it mounts the real panel — over the real movement, in the real `index.html` grid — and asserts that the rail, the card, the chain and the developed section always agree with each other. `test/lessonHarness.js` is the rig; it is not a suite, so the runner does not collect it.

## License

[MIT](LICENSE) © OlegG90. See [CHANGELOG.md](CHANGELOG.md) for release notes.
