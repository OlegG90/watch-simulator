# AGENTS.md — working in this repository

SimWatch: a 3D simulation of a simple mechanical watch movement — going train, a swappable
escapement, motion works, winding, and a power-reserve differential. Three.js + Vite, no
framework, all geometry generated in code. It opens in **Explore** mode, a guided route of six
stations along the flow of energy; **free mode** is the same movement with every control at
once; **the escapement model** is a separate exhibit that is not the movement at all.

**This repository is the record.** Decisions about the code are made and kept here — in this
file, in `README.md`, and in the code's own comments. If it is not written down in one of
those three places, it is not decided.

## Everything in this repository is written in English

**Code, comments, documentation, tests, commit messages, issues and identifiers are English —
without exception.** What is not prose about the code is the Ukrainian *interface copy*: the
`ua` side of `src/i18n.js` and `src/lesson/content.js`. That is product content shown to the
user, and it stays. Everything written *about* the code is English so that any reader or tool
can follow it.

Comments were Ukrainian here for most of the project's life, which split the record in two: the
prose explaining a trap sat in one language, the file naming that trap in another, and neither
could be searched from the other. Translating them was a single sweep; adding a Ukrainian
comment back would start the split again.

So a grep for Cyrillic outside those two dictionaries is expected to return almost nothing, and
what it does return is a short, deliberate list: the `«УКР»` label on the language
switch (the `.name()` guard in `lesson.test.js` carves out that one string by name), the
`[Ѐ-ӿ]` character classes in the guards themselves, and the handful of assertions that check
what the Ukrainian dictionary renders. Anything else the grep finds is a regression.

## The one rule that shapes everything else

**Every number the app shows is derived from the constants that build the geometry. Nothing
is typed.**

A station card promising "verified by a test" beside a figure someone typed is a lie waiting
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
  A module that cannot answer honestly says so: the double-axis one hands back
  `escapeTurns: null`, because «turns of the escape wheel per turn of the arbor» has an
  answer only while everything turns about one axis, and the modal prints a dash.

The same rule applies to prose: the app says what it does and does not model, and the amber
markers name the simplifications rather than hiding them.

## Where things are recorded

| | What it holds |
|---|---|
| `AGENTS.md` (this file) | how to work here: contracts, conventions, invariants, traps |
| `README.md` | what the mechanism is, in English: every formula, the source map, the assumptions |
| `CHANGELOG.md` | what changed and why, in prose — `Unreleased` grows as work lands, and becomes a version when one is cut |
| code comments | why a line is the way it is — never what it does |
| GitHub issues | **code work only** |

**GitHub issues are for this repository.** A ticket here names work that this repository's
tests can see and its commits can close. Anything that cannot be tested or closed here does
not belong in the tracker — that mistake has been made, and it parks work where nobody can
finish it.

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
| `src/i18n.js` | every interface string, Ukrainian and English (with `lesson/content.js`, the only Ukrainian in the repo) |
| `src/lesson/` | the Explore layer: panel, stations, live figures, developed section, modal |
| `src/showcase/` | the escapement exhibit: `design.js` the geometry, `motion.js` the running, `leverModel.js` the meshes, `bar.js` its panel |
| `test/` | six suites; `lessonHarness.js` is the rig, not a suite |
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
the node toggle all read the `part.escapement` label whatever is installed, because that list
names seats in the mechanism — barrel, centre wheel, hands, winding. The installed module is
named where it is the subject: the variants modal, the developed section, the cost table. Decided in issue #21;
the free-mode gap this leaves (nothing there names the installed module) is a known cost.

### The double-axis module, and what it proved

It is the module the socket was built for, and it went in without `index.js` gaining a
single line about it — which was the socket's whole claim.

Three things are worth carrying forward:

- **The train's ratios are not free.** The escape wheel must turn by exactly β relative to
  its fork, and both ride in the inner cage, so the product of the three ratios along the
  drive — rolling on the plate, through the bevel, rolling again inside — must be 1. That
  is a constraint on the tooth counts, not a number anyone chose. Within it there is still
  a choice, and here the inner cage turns twice for every turn of the outer.
- **The cage's height is a consequence, not a preference.** The balance is the same size in
  every variant (a decided rule, so a swap shows a different construction rather than a
  different picture), an inner cage turning about a horizontal axis has to carry it through
  a full circle, and that circle has to fit between the outer plates. Change the balance and
  the cage's height follows; a test holds the chain.
- **What every module shares is built once.** The balance is the same balance in every
  variant — a decision, so that a swap shows a different construction rather than a
  different picture — and it was written down as a rule and then built three times. The
  three drifted: one had timing screws and another did not. The guard compared radii, the
  radii agreed, and nothing went red. `escapement/balance.js` builds it now, and the guard
  compares construction — every mesh, its parameters and its place. What stays with each
  module is what is genuinely its own: the staff and the roller, which are mounting.
  The **fork** went the same way (`escapement/fork.js`), and it is the harder case:
  it is not the same part in three places but the same PARTS in three arrangements,
  so the builder takes what genuinely varies — the wheel's centre, the pivot, the
  direction to the balance, the reach, whether there are horns — and owns what does
  not: the stones, the sections, the arbor. Those are quoted at a reference wheel of
  r=1.5 and scaled by the module's own `escR`, because a fork belongs to its escape
  wheel; the guard normalises by the scale each fork declares and compares the
  sections that are left against numbers written out in the test, so all three can
  be wrong together and still fail.
- **A measurement that stopped being an angle.** `worldZ()` in the tests summed `rotation.z`
  up the parent chain, which is an angle only while every link turns about Z. It now checks
  that precondition and throws instead of adding angles measured about different axes. The
  debt was recorded when the socket landed and came due with the first module that broke it.

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

## The three modes

Explore is what opens. Free mode is the same movement with every control at once, and two
things must hold: it keeps **all** the knobs, and its **kinematics** stay those of the
pre-lesson app — verify with a scene-graph diff against `v1.1.0`, not only the suite.

What is *not* frozen is how it looks. Explore and free mode show one scene, so visual work
lands in free mode too, and new node controls belong there.

**The escapement model is the exception, and it is an exhibit, not a mode of the movement.**
`src/showcase/` is a separate lever escapement at exhibit scale, shown so that lock, unlock,
impulse and drop can be read one beat at a time. It swaps the scene's contents: the movement
is hidden while it is open, and it is hidden everywhere else.

### Why there are two models at all

This repository holds **two models of the same escapement, and they answer different
questions**. Keep them apart; the moment one is asked to do the other's job, both get worse.

**The movement** is the object of study: every part present, in one working assembly, so that
the interaction of the parts can be seen and followed. To stay that, it does NOT chase exact
correspondence anywhere — tooth profiles are simplified, the time scale is compressed, contact
is staged rather than solved. Those are recorded simplifications, not debts, and the amber
markers name them to the viewer. The escapement inside it is phased, not engaged: it keeps the
beat honestly and shows the place the escapement occupies in the chain of energy.

**The exhibit** exists because that trade costs something specific. The escapement is not just
one link in the chain — *how* it works is a subject in its own right, and a staged flip cannot
teach it. So one lever escapement is modelled separately, at a size and a tempo where the
lock, the unlocking, the impulse and the drop are things you watch happen, not captions you
read. It answers for the function; the movement answers for the assembly.

This is why the exhibit is joined to nothing (below), and why «the movement does it this way»
is never an argument for how the exhibit should behave. Where the exhibit shows contact, the
contact must be real geometry — it is the only place in this repository that promises it.

It is joined to nothing on purpose — no import from `movement/`, `escapement/`, `lesson/` or
`settings.js`, and a text test in `showcase.test.js` enforces that. The alternative was
contact kinematics inside the socket, which would have meant re-deriving the β-identity every
variant shares and rewriting the tourbillon around it. Do not "fix" the separation with an
import: the isolation test will go red, and it is right.

The exhibit owns its own time (`{ t, playing, speed }` in `main.js`, counted in beats) and its
own panel inside the scene, because showcase CSS hides everything but the stage.

### How the exhibit's escapement is built

`src/showcase/design.js` holds the geometry and nothing else — no meshes, no time.
`leverModel.js` builds the shapes it describes, `motion.js` reads the poses it solves. One
solution read twice, so the picture and the movement cannot drift apart.

**The pallets are the conjugate profiles of the action, not shapes with angles chosen.**
Three earlier attempts picked face angles and measured what the contact did; every one of
them recoiled through the whole impulse. Scanning the angle from −50° to +80° showed why:
for a pallet whose corner creeps backwards as it lifts, *no* straight face at any angle lets
the wheel advance. So the action is stated first — the lever's travel, the recoil the draw
gives back, the wheel's advance, the drop — and each face is then traced by putting the
acting tooth's toe where that phase says the wheel stands and writing its place down in the
lever's frame. Contact through the phase is then true by construction, and a test checks it
by a polygon intersection that knows nothing of the construction.

What that buys, and what to protect:

- **Half a pitch per beat is a RESULT**, not a setting. It appears nowhere as a number; it
  falls out of the pallets spanning two and a half teeth. The test measures it.
- **Real figures are inputs, derived ones are outputs.** The draw is given (12°, what a
  watchmaker specifies) and the recoil is solved from it, per stone. The lift is given (50°)
  and the pin's orbit is solved until the measured engagement lands there. The impulse is
  not a choice at all: a beat moves the wheel half a pitch, so the impulse is what the
  recoil and the drop leave.
- **Two figures are magnified and the viewer is told.** A real lock is worth about a
  sixteenth of the lever's travel and a real drop about a degree; at this size both would be
  nothing. `EXAGGERATION` multiplies exactly those two, the panel prints the factor read
  from the same constant, and everything else — face angles, travel, lift, the proportions
  of time — is the real thing.
- **The exit stone's draw comes out at 19° rather than the 12° asked for**: at zero recoil
  its geometry already draws that much. Recorded rather than forced, and the test holds it
  to «steeper than the entry's» instead of pretending otherwise.
- **The safety action is a constraint, not a decoration.** The guard pin's place is solved
  so the catch happens after 7.5% of the lever's travel — half the share the unlocking
  needs — and the crescent's half-angle and depth are measured from the passage the guard
  actually makes. Through a correct beat the guard never touches (worst clearance 0.010),
  and the suite holds it to that. The push that demonstrates it (`nudge`) is a state beside
  the time, so the pose stays a pure function of the pair and stepping still works.
- **Where a shape and its placement come from one measurement, test them separately.** The
  crescent's width and its position are both read off the same sweep, so a crescent turned a
  few degrees off centre simply widens itself to cover the passage — every test still green,
  and the exhibit showing an opening that has nothing to do with the moment it exists for.

## Commands

```bash
npm run dev      # Vite dev server on 5173
npm test         # every suite
npm run build    # production build into dist/
npm run serve    # build, then serve dist/ statically on 8642
```

## Testing

Six suites, ~140 tests. `gear.test.js`, `movement.test.js`, `lesson.test.js` and
`showcase.test.js` run headless in Node — three.js builds geometry there quite happily.
`panel.test.js` and `showcaseBar.test.js` run under **jsdom**, declared per file so the
geometry suites keep the faster environment; `panel.test.js` mounts the real panel over the
real movement in the real `index.html` grid, and `lessonHarness.js` is its rig.

**Some guards read the source, not the objects.** Three rules here cannot be observed from a
built scene at all — that no GUI label bypasses `t()`, that `src/` holds no Cyrillic outside
the two dictionaries, and that the showcase imports nothing from the movement. Each is a test
that reads files and asserts about their text. A rule with no such guard is a rule that will
be broken by the next commit; that has now happened once, measured in days.

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

**Comments are in English and say why.** The code already says what. A comment earns its
place by recording a decision, a trap, or a consequence not visible locally.

**Commits explain the change in prose**: what was wrong, why this is the fix, and what was
verified — enough that the reasoning survives without the conversation that produced it.

**Every interface string goes through `t()`.** Key parity between languages is tested, and a
separate guard scans `main.js` for Cyrillic passed straight to `.name()`, because a string
that never reaches the dictionary cannot be caught by parity. Units belong in the dictionary
too — `«12 с»` stayed Cyrillic in the English UI for two releases because one was not.

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

- **A rule that answers «no» when it was not given enough to answer.** `hasRunDown()` took
  `{ real, running, charge }`, the app's status object had no `running` at all, and the rule
  quietly returned `undefined` — so the notice it gates never appeared. The tests passed,
  because the test harness happened to supply the field. It now throws on a missing one.
  A predicate that shrugs is worse than one that stops.
- **A harness with its own copy of a rule grades the copy.** The same status object was
  computed twice — once in `main.js`, once in `lessonHarness.js` — so the panel's tests were
  checking a rule the app did not run. The harness imports the rule now. This has happened
  twice: the list of planned escapement variants was the first.
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

- **The design canvas working files** — `../design`: `.dc.html` artboards and `canvas.json` for
  the published canvas. Outside this repo on purpose, so they never reach the build.
