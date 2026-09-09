import { t } from '../i18n.js';

/**
 * The six stations of the energy chain — the order equals the direction of the
 * energy flow, not increasing complexity.
 *
 * `focus` — the name of a focus point from `movement.focusPoints`; `null` = the overview.
 * `highlight` — the set for `createHighlighter().focus()`.
 * `chain` — the station's place in the footer diagram: a chain row or a branch.
 * `test` — the name of the test backing the station's main claim; a meta-test
 *          verifies that such a test really exists in the suite.
 *
 * `formula` and `stats` are functions of live numbers (`readouts.js`), not texts:
 * not one number on a card is typed in by hand.
 */
export const STATIONS = [
  {
    id: 'winding',
    nameKey: 'station.winding',
    focus: 'part.winding',
    highlight: { mods: ['winding'] },
    chain: { row: 0 },
    test: 'the barrel wheel stays still while winding',
    prose: 'st.winding.prose',
    idea: 'st.winding.idea',
    hint: 'st.winding.hint',
    formula: (r) => [{ key: 'st.winding.f1', vals: [r.ratchetStep] }],
    stats: (r) => [
      ['st.winding.s1', `${r.bevel.wheel}° + ${r.bevel.pinion}°`],
      ['st.winding.s2', `+${r.clickPct} %`],
    ],
    controls: [{ kind: 'button', labelKey: 'gui.wind', action: 'wind' }],
  },
  {
    id: 'energy',
    nameKey: 'station.energy',
    focus: 'part.barrel',
    highlight: { mods: ['barrel'], arbors: [0] },
    chain: { row: 1 },
    test: 'compression: more charge → smaller outer radius, more turns',
    prose: 'st.energy.prose',
    idea: 'st.energy.idea',
    hint: 'st.energy.hint',
    simplification: 'st.energy.simp',
    proseVals: (r) => [Math.round(Math.abs(r.ratios[4].omega))],
    hintVals: (r) => [r.fullRunMin],
    formula: (r) => [
      { key: 'st.energy.f1' },
      { key: 'st.energy.f2', vals: [r.charge.toFixed(2), r.spring.turns] },
    ],
    stats: (r) => [
      ['st.energy.s1', `${r.spring.turns}`],
      ['st.energy.s2', `${r.fullRun} ${t('unit.s')}`],
    ],
    controls: [{ kind: 'slider', param: 'speed' }],
  },
  {
    id: 'train',
    nameKey: 'station.train',
    focus: null,
    highlight: { mods: ['train'] },
    chain: { row: 2 },
    test: 'the meshing invariant = 0 on all 4 pairs at arbitrary angles',
    prose: 'st.train.prose',
    idea: 'st.train.idea',
    hint: 'st.train.hint',
    formula: () => [{ key: 'st.train.f1' }],
    ladder: true, // the ladder of gear ratios instead of a pair of numbers
    controls: [{ kind: 'slider', param: 'speed' }],
  },
  {
    id: 'escapement',
    nameKey: 'station.escapement',
    focus: 'escapement',
    highlight: { mods: ['escapement'] },
    chain: { row: 3 },
    // The station's claim is «the balance sets the tempo, not the construction», so that is the test.
    test: 'every variant produces the same β — the timing does not depend on the construction',
    prose: 'st.escapement.prose',
    idea: 'st.escapement.idea',
    hint: 'st.escapement.hint',
    simplification: 'st.escapement.simp',
    formula: (r) => [
      { key: 'st.escapement.f1' },
      { note: 'st.escapement.n1' },
      { key: 'st.escapement.f2', vals: [r.halfStepDeg] },
    ],
    stats: (r) => [
      ['st.escapement.s1', `${r.cagePeriod} ${t('unit.s')}`],
      ['st.escapement.s2', `${r.secondsPeriod} ${t('unit.s')}`],
    ],
    controls: [
      { kind: 'slider', param: 'beatHz' },
      { kind: 'slider', param: 'amplitude' },
      { kind: 'variants', labelKey: 'variants.open' },
    ],
  },
  {
    id: 'timeDisplay',
    nameKey: 'station.timeDisplay',
    focus: 'part.hands',
    highlight: { mods: ['motionWorks'] },
    chain: { branch: 'hands' },
    test: 'centre seconds : minute arbor = 60',
    prose: 'st.timeDisplay.prose',
    idea: 'st.timeDisplay.idea',
    hint: 'st.timeDisplay.hint',
    simplification: 'st.timeDisplay.simp',
    formula: (r) => [
      { key: 'st.timeDisplay.f1' },
      { key: 'st.timeDisplay.f2' },
      { note: 'st.timeDisplay.n1', vals: [r.mw.centreA, r.mw.centreB] },
    ],
    controls: [{ kind: 'toggle', param: 'timeMode' }],
  },
  {
    id: 'powerReserve',
    nameKey: 'station.powerReserve',
    focus: 'part.powerReserve',
    highlight: { mods: ['powerReserve'] },
    chain: { branch: 'reserve' },
    test: 'the differential condition: Δcarrier = (ΔS_up + ΔS_low)/2 while winding and while running',
    prose: 'st.powerReserve.prose',
    idea: 'st.powerReserve.idea',
    hint: 'st.powerReserve.hint',
    formula: (r) => [
      { key: 'st.powerReserve.f1' },
      { key: 'st.powerReserve.f2', vals: [r.sweepDeg] },
      { note: 'st.powerReserve.n1' },
    ],
    stats: (r) => [
      ['st.powerReserve.s1', `${r.chargePct} %`],
      ['st.powerReserve.s2', `${r.reserve.centreA} = ${r.reserve.centreB}`],
    ],
    controls: [{ kind: 'button', labelKey: 'gui.wind', action: 'wind' }],
  },
];

export const stationById = (id) => STATIONS.find((s) => s.id === id) ?? null;
