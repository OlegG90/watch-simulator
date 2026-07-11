# watch-simulator

[![tests](https://github.com/OlegG90/watch-simulator/actions/workflows/test.yml/badge.svg)](https://github.com/OlegG90/watch-simulator/actions/workflows/test.yml)

A simple visual model of watch gears that can work together — a 3D simulation of a
mechanical watch movement (no dial), focused on the minimal set of modules and wheels.

Built with **Three.js** + **Vite**. All geometry is generated procedurally in code.

## Features

- **Going train** — barrel → center → intermediate → seconds → escape wheel, with correct gear ratios.
- **Swiss lever escapement** — escape wheel, pallet fork with ruby pallets, balance wheel with hairspring; the whole movement is driven stepwise by the balance ("tick–tock").
- **Motion works & hands** — hour, minute and central seconds hands (12:1), raised to the top of the central staff.
- **Winding** — ratchet, crown wheel and winding crown; "wind the mainspring" animation.
- **Open barrel** — the drum is open so the coiled mainspring is visible inside.
- **Power reserve indicator** — a sub-dial hand next to the barrel shows the remaining wind (120° sector).
- **Time modes** — demo time (runs from the escapement) and real time (hands follow the system clock while the escapement stays visually coupled).
- **Compact layered layout** — the train is coiled into a tight loop; balance, motion works and central seconds sit on higher Z-layers above it.

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
- Drain while running (demo): $\dot c = -1/T_{full}$, $T_{full}=120$ s; winding: $\Delta c = +0.34$ per click; at $c=0$ the movement stops.
- Verified: radius is monotonic in charge — $c=0.75/0.5/0/0.34 \Rightarrow r_{out}=5.91/6.11/6.87/6.45$.

### 3. Going train

| # | Node | Pinion $z_p$ | Wheel $z_w$ | $\omega$ vs barrel |
|---|---|---|---|---|
| 0 | Barrel | — | 48 | $1$ |
| 1 | Center wheel | 12 | 40 | $-4$ |
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
- Balance zero crossings (integer $u$) trigger the fork flip and the escape-wheel step. **The whole movement is driven by the escapement:** $driveAngle = E/\omega_4$.
- Verified: $\theta_b$ at half-beat $=A$ exactly, at beat $=0$ exactly; seconds-wheel period $=\dfrac{2\pi}{(\omega_3/\omega_4)\cdot \frac{\pi}{15} f_{beat}} = 32$ s at $f_{beat}=2.5$.

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

- Chain: crown → winding stem → bevel pinion (8) → bevel wheel (16) → crown wheel (18) → ratchet wheel (28) on the barrel arbor; a click holds the ratchet.
- **90° bevel pair:** $\tan\delta_w = \dfrac{z_w}{z_p} \Rightarrow \delta_w \approx 63.4°$, $\delta_p \approx 26.6°$, $\delta_w+\delta_p = 90°$; the apexes of both pitch cones meet at a **common point** on the axis intersection; each gear ring sits at $R/\tan\delta$ along its own axis; shared cone distance: $L = \dfrac{R_w}{\sin\delta_w} = \dfrac{R_p}{\sin\delta_p} = 2.95$.
- Winding kinematics: ratchet $+\omega$; crown-wheel assembly $-\omega\cdot\frac{28}{18}$; stem/pinion/crown $+\omega\cdot\frac{28}{18}\cdot\frac{16}{8}$.
- Verified: distance between the bevel pitch circles = **0.0000** (tangent); apex distance = 0; the barrel wheel stays still while winding.

### 12. Power reserve indicator

- Small sub-dial next to the barrel: base disc, brass 120° sector scale, ticks at 0–100% (the zero tick is ruby), blued hand.
- Hand angle is linear in the mainspring charge: $\alpha(c) = \alpha_0 + (\alpha_1-\alpha_0)\,c$ with $\alpha_0 = 150°$ (empty), $\alpha_1 = 30°$ (fully wound).
- Updated by the same hook that reshapes the mainspring — any charge change moves both.
- Verified: exact angle for $c = 0.75/0/0.34$; monotonic motion toward "empty" while running.

### 13. Main plate & jewels

- Plate radius: $R_{plate} = \max\Big(\tfrac{\sqrt{W^2+H^2}}{2},\ \max_i\big(|p_i-c| + r_i\big)\Big) + 1.8$ over all nodes (train, escapement, hands, motion works, winding).
- Ruby jewels under every arbor; `movement.bounds` exposes $minX/maxX/minY/maxY$, center and $R_{plate}$ for checks.

## Assumptions & simplifications

1. **Kinematics, not physics.** All motion is scripted through gear ratios; torque, friction, inertia and elasticity are not modeled.
2. **Simplified tooth profile** (trapezoidal, not involute): mesh phasing is exact (invariant = 0), but tooth surfaces are not conjugate — teeth may locally interpenetrate at high zoom.
3. **Compressed time scale:** the seconds wheel turns once per 32 s (at 2.5 beats/s), the "minute" axis ~5.3 min, the "hour" axis ~64 min. Ratios are exact (60:1, 12:1), absolute periods are not.
4. **Real-time mode:** hands are overlaid on top of the train (separate subgroups) and visibly "slip" against their wheels; the escapement stays coupled (a deliberate trade-off — the compressed model's mismatch is moved from the escapement to the hands).
5. **Bevel pair:** pitch cones are geometrically exact (tangency = 0), but tooth phasing is approximate — profiles are not conjugate.
6. **Mainspring:** its shape is interpolated from the charge; ribbon length is not conserved and spring torque is not modeled; "120 s per full wind" is an arbitrary demo value.
7. **Hairspring** "breathes" in a simplified way (linear angle interpolation along the coils), without length conservation.
8. **Winding** moves only during the button animation; the click is static (does not ratchet over the teeth).
9. **No bearings/bridges:** arbors float visually; the plate is decorative.
10. **Power reserve indicator is scripted:** the hand reads `charge` directly; real calibers take the reserve off the barrel arbor through a differential, which is not modeled here.
11. **Verification precision:** mesh invariants, gear ratios, hand angles and cone tangency are exact to machine precision (<1e−6); layout collisions are checked by bounding-sphere scans (threshold: XY overlap > 1.3 units with Z intersection).

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

## Tests

```bash
npm test
```

Headless [Vitest](https://vitest.dev/) suite (no browser needed — three.js builds geometry in Node). It locks in every formula from *Mechanism elements*: mesh invariants on all pairs, train/motion-works/central-seconds ratios, escapement stepping and balance phase, real-time hand angles, the winding charge model, bevel-pair tangency (analytic point-to-circle), spiral/gear/hand geometry, and a layout collision scan.

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
