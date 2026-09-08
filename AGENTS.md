# AGENTS.md — working in this repository

SimWatch: a 3D simulation of a simple mechanical watch movement — going train, a swappable
escapement, motion works, winding, and a power-reserve differential. Three.js + Vite, no
framework, all geometry generated in code. It opens in **Explore** mode, a guided route of six
stations along the flow of energy; **free mode** is the same movement with every control at
once.

**This repository is the record.** Decisions about the code are made and kept here — in this
file, in `README.md`, and in the code's own comments. The Obsidian vault
(`hobbyVault/Projects/Horology/SimWatch`) describes the mechanism for a human reader in
Ukrainian; it is informational, and nothing in it constrains the code.

## The one rule that shapes everything else

**Every number the app shows is derived from the constants that build the geometry. Nothing
is typed.**

A station card promising «перевірено тестом» beside a figure someone typed is a lie waiting
for its first refactor, and this has happened here more than once — a copied balance radius
drifted from the mesh inside a single commit; the developed section carried eyeballed body
thicknesses that had already diverged. So:

- A module owns its own figures and hands them out through `profile()`. Consumers compose,
  round for display, and derive nothing themselves.
- The cost of complexity in the variants modal is **measured** by walking each module's scene
  graph (`escapement/metrics.js`), never stated.
- Guard tests fail when a centre-distance expression appears outside its owning module, or
  when a card figure stops matching the built meshes. They exist because both happened.
- Where the model cannot honestly produce a number, it shows `—` rather than inventing one.
  The planned double-axis module has an empty column for exactly this reason.

The same rule applies to prose: the app says what it does and does not model, and the amber
markers name the simplifications rather than hiding them.

## Where things are recorded

| | What it holds |
|---|---|
| `AGENTS.md` (this file) | how to work here: contracts, conventions, invariants, traps |
| `README.md` | what the mechanism is, in English: every formula, the source map, the assumptions |
| code comments | why a line is the way it is — never what it does |
| GitHub issues | **code work only** |
| the vault | the mechanism explained in Ukrainian, for reading, not for constraining |

**GitHub issues are for this repository.** A question about a vault note — a rename, a
wording, a missing section — is not a ticket here and must not become one. That mistake has
been made once already (issue #24 asked for a note to be renamed in Obsidian), and it puts
work in a tracker that cannot see it, cannot test it, and cannot close it honestly. Vault work
belongs in the vault.

## Layout

| Path | What it is |
|---|---|
| `src/main.js` | scene, render loop, free-mode GUI, time modes, camera focus |
| `src/movement.js` | the composer: layout → bounds → build → kinematics. Not a module itself |
| `src/common.js` | shared constants and helpers (`meshPhase`, `makeAxle`, `pitchR`, tagging) |
| `src/gear.js` | procedural geometry: gears, bevel gears, hands, spirals |
| `src/train.js` `barrel.js` `motionWorks.js` `winding.js` `powerReserve.js` | one file per documented module |
| `src/escapement/` | the socket and its modules — see below |
| `src/settings.js` | the one table of running parameters: range, step, format, label key |
| `src/ui.js` | 3D node labels and the camera fly |
| `src/i18n.js` | every interface string, Ukrainian and English |
| `src/lesson/` | the Explore layer: panel, stations, live figures, developed section, modal |
| `test/` | four suites; `lessonHarness.js` is the rig, not a suite |
| `init-version/` | an early snapshot with its own deps. Not built, not tested, kept on purpose |
| `dist/` | build output. Never edit; `.github/workflows/pages.yml` regenerates it |

## The module contract — three phases

Every mechanism module answers in three ways, and its interface is those three functions,
**not its constant table**:

```
layout…(…)  → positions and its own `extents`, before any mesh exists
build…(…)   → the meshes, and its own update()
profile()   → its own figures: centre distances, z-spans, radii, label keys
```

`layout` runs first so `movement.js` can size the main plate from the whole mechanism while
no module knows about its neighbours. `profile` exists so the station cards and the developed
section can be *composed* rather than re-derived: `lesson/section.js` places axes along the
chain and nothing more, and each profile part says what it hangs from (`anchor`) and how far
along.

Constants that only the module needs are **not exported**. Nineteen of them were removed once
the profiles arrived; adding one back is a sign that a consumer is about to re-derive
something.

## The escapement is a socket, not a module

`src/escapement/` holds a registry and its interchangeable modules. The movement always
contains exactly one, and it can be swapped while running.

A module hands the socket `{ rotating, fixed, update() → β, nodes, motion }` and nothing else.
How many nested cages it has, and about which axes they turn, is its own business — that is
what lets a third module arrive without touching `index.js`.

- All modules are built at startup; **only the installed one is updated**. A test enforces it,
  and the reason is cost: the hairspring alone rewrites over a thousand vertices per frame.
- The beat maths lives once, in `beat.js`. Identical timing across modules is therefore
  structural, not a rule anyone has to remember.
- `nodes` are the module's own controls for the free-mode panel. The panel asks the socket for
  the **installed** module's list and never names a variant. Naming one is how a hidden
  module's parts once became visible beside the installed one.
- Test-only mesh handles live behind `internals`, named so nobody mistakes them for interface.

**The scene chrome names the place, not the module in it.** The 3D label, the camera preset and
the node toggle read «Спуск» whatever is installed, because that list names seats in the
mechanism — barrel, centre wheel, hands, winding. The installed module is named where it is
the subject: the variants modal, the developed section, the cost table. Decided in issue #21;
the free-mode gap this leaves (nothing there names the installed module) is a known cost.

## The Explore layer

**One render seam.** `render()` in `lesson/panel.js` derives the whole screen from `state`, and
every action is a state change plus that one call. Never redraw a region on its own: a state
nobody redraws for becomes unreachable, which is exactly how the start screen became a
one-way door. The camera stays outside `render()` — a camera flight is an event, not a
projection of state.

**One parameter table.** `settings.js` owns range, step, formatter and label key. The
free-mode panel and the station card are two adapters over it; a station names only the
parameter. Do not declare a control twice, and do not keep bounds in `stations.js` — guard
tests fail on both. `settings.values` stays a plain object because the render loop reads it
every frame; writes go through `set()`, which clamps by the same table the control was built
from.

**One list of focus points.** `movement.focusPoints` is where the camera looks and what the
labels say; each point declares how to look at it (`back`, `up`) and whether the chrome offers
it as a button. An unknown id throws. There used to be a second list keyed differently, with
a silent `?? overview` fallback — two of the six stations fell through it for a whole
release, showing the overview while their card named a node.

**Every station names the test backing its claim**, and a meta-test asserts that test exists.
Renaming a test therefore breaks the suite; update `lesson/stations.js` with it.

**Nothing allocates in the render loop.** `readouts()` takes a caller's buffer, `beatPhase()`
fills one, the hairspring mesh is built once and its vertices rewritten in place. Both of the
last two were regressions before they were rules.

## The two modes

Explore is what opens. Free mode is the same movement with every control at once, and two
things must hold: it keeps **all** the knobs, and its **kinematics** stay those of the
pre-lesson app — verify with a scene-graph diff against `v1.1.0`, not only the suite.

What is *not* frozen is how it looks. Both modes show one scene, so visual work lands in free
mode too, and new node controls belong there.

## Commands

```bash
npm run dev      # Vite dev server on 5173
npm test         # all four suites
npm run build    # production build into dist/
npm run serve    # build, then serve dist/ statically on 8642
```

`init-version/` has its own `package.json` and runs on 5174.

## Testing

Four suites, ~120 tests. `gear.test.js`, `movement.test.js` and `lesson.test.js` run headless
in Node — three.js builds geometry there quite happily. `panel.test.js` runs under **jsdom**,
declared per file so the geometry suites keep the faster environment; it mounts the real panel
over the real movement in the real `index.html` grid, and `lessonHarness.js` is its rig.

**A test asserts behaviour, not arrangement.** Prefer one that would fail if the rule were
broken over one that pins the current shape of the code.

**Sabotage every guard you write.** Break the thing the test claims to protect and watch it
fail; a guard that has never failed is a guess. Several tests here passed for years while
checking the wrong object — the clearest case being a focus-point test that validated the list
the camera did *not* use.

**Two lists mean one of them is untested.** When a fact appears in two places, the test almost
always checks the healthy one. The fix is one list, not two tests.

**Kinematics changes need a scene-graph diff**, not just green tests: the world transform of
every mesh across idle, demo, manual wind and auto-wind, compared against the previous build.
That is what caught a crown-spin regression the suite missed. The stem spin is an accumulator
by design — auto-wind advances the ratchet without turning the crown.

**Refactors of the Explore layer need a DOM diff.** Drive the panel through a dozen states in
jsdom, dump each region's markup plus the highlight count and camera calls, and compare before
and after. Two large refactors were proven inert this way, byte for byte, and the one visible
difference that did appear was the one intended.

## Conventions

**Comments are in Ukrainian and say why.** The code already says what. A comment earns its
place by recording a decision, a trap, or a consequence not visible locally. `README.md`,
this file, commit messages, test names, issues and identifiers are English.

**Commits explain the change in prose**: what was wrong, why this is the fix, and what was
verified — enough that the reasoning survives without the conversation that produced it.

**Every interface string goes through `t()`.** Key parity between languages is tested, and a
separate guard scans `main.js` for Cyrillic passed straight to `.name()`, because a string
that never reaches the dictionary cannot be caught by parity. Units belong in the dictionary
too — `«12 с»` stayed Cyrillic in English for two releases because one was not.

**Horological English is not literal translation**: `third wheel`, `fourth wheel`, `click`,
`motion works`, `pallet fork`, `escape wheel`. Never `anchor escapement` for the Swiss lever —
in English that names a different, older, recoiling escapement.

**Fonts ship with the repo** (`src/lesson/fonts`, OFL 1.1). Do not reintroduce a webfont CDN.

## Deployment

Pushing to `main` deploys to GitHub Pages (`.github/workflows/pages.yml`, built with
`--base=/watch-simulator/`). Both workflows run **Node 24 actions** — `checkout@v7`,
`setup-node@v7`, `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5`. Do not
pin them back to a Node 20 major. `setup-node`'s automatic caching stays overridden by the
explicit `cache: npm`; adding a `packageManager` field to `package.json` would change that.

## Traps that have cost real time

- **A hidden browser pane freezes `requestAnimationFrame`.** Measuring the camera or the model
  clock through an automated browser whose pane is not painting returns a frozen scene and
  looks exactly like a dead render loop. Force a paint (take a screenshot) between the action
  and the measurement.
- **lil-gui shows what it read when the controller was created.** A value changed elsewhere
  needs `updateDisplay()`, and a panel built for one escapement module needs rebuilding when
  another is installed.
- **A local name shadows an import for the whole function body.** `sectionView.js` already had
  an `axis` — the group holding the Z scale — and importing a projector under that name gave
  a temporal-dead-zone error at a line above the declaration.
- **A silent fallback hides a missing case.** `?? overview` in a camera lookup made three
  broken stations look like working ones. Prefer throwing on an unknown id.

## What lives outside this repository

- **The vault notes** — `hobbyVault/Projects/Horology/SimWatch`: the mechanism explained in
  Ukrainian, one note per module, plus the model's simplifications and the design of Explore
  mode. Read them for understanding; do not treat them as normative, and do not open issues
  here about them.
- **The design canvas working files** — `../design`: `.dc.html` artboards and `canvas.json` for
  the published canvas. Outside this repo on purpose, so they never reach the build.
