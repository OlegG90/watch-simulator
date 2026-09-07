/**
 * Шість станцій ланцюга енергії — порядок дорівнює напряму потоку енергії,
 * а не зростанню складності.
 *
 * `focus` — ім'я точки фокуса з `movement.focusPoints`; `null` = загальний вид.
 * `highlight` — набір для `createHighlighter().focus()`.
 * `chain` — місце станції в діаграмі підвалу: рядок ланцюга або відгалуження.
 * `test` — назва тесту, яким підперта головна теза станції; мета-тест звіряє,
 *          що такий тест справді існує в наборі.
 *
 * `formula` і `stats` — функції від живих чисел (`readouts.js`), а не тексти:
 * жодне число в картці не вписане руками.
 */
export const STATIONS = [
  {
    id: 'winding',
    nameKey: 'station.winding',
    focus: 'part.winding',
    highlight: { mods: ['winding'] },
    chain: { row: 0 },
    test: 'барабанне колесо нерухоме під час заведення',
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
    test: 'стиснення: більший заряд → менший зовнішній радіус, більше витків',
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
      ['st.energy.s2', `${r.fullRun} с`],
    ],
    controls: [{ kind: 'slider', param: 'speed', labelKey: 'gui.speed', min: 0, max: 10, step: 0.1, fmt: (v) => `×${v.toFixed(1)}` }],
  },
  {
    id: 'train',
    nameKey: 'station.train',
    focus: null,
    highlight: { mods: ['train'] },
    chain: { row: 2 },
    test: 'інваріант зачеплення = 0 на всіх 4 парах за довільних кутів',
    prose: 'st.train.prose',
    idea: 'st.train.idea',
    hint: 'st.train.hint',
    formula: () => [{ key: 'st.train.f1' }],
    ladder: true, // драбина передавальних відношень замість пари чисел
    controls: [{ kind: 'slider', param: 'speed', labelKey: 'gui.speed', min: 0, max: 10, step: 0.1, fmt: (v) => `×${v.toFixed(1)}` }],
  },
  {
    id: 'escapement',
    nameKey: 'station.escapement',
    focus: 'escapement',
    highlight: { mods: ['escapement'] },
    chain: { row: 3 },
    test: 'θ_cage = β: спокій між ударами, +π/15 за удар',
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
      ['st.escapement.s1', `${r.cagePeriod} с`],
      ['st.escapement.s2', `${r.secondsPeriod} с`],
    ],
    controls: [
      { kind: 'slider', param: 'beatHz', labelKey: 'gui.beat', min: 0.5, max: 6, step: 0.1, fmt: (v) => v.toFixed(1) },
      { kind: 'slider', param: 'amplitude', labelKey: 'gui.amplitude', min: 90, max: 270, step: 5, fmt: (v) => `${v}°` },
    ],
  },
  {
    id: 'timeDisplay',
    nameKey: 'station.timeDisplay',
    focus: 'part.hands',
    highlight: { mods: ['motionWorks'] },
    chain: { branch: 'hands' },
    test: 'центральна секунда : хвилинна вісь = 60',
    prose: 'st.timeDisplay.prose',
    idea: 'st.timeDisplay.idea',
    hint: 'st.timeDisplay.hint',
    simplification: 'st.timeDisplay.simp',
    formula: (r) => [
      { key: 'st.timeDisplay.f1' },
      { key: 'st.timeDisplay.f2' },
      { note: 'st.timeDisplay.n1', vals: [r.mw.centreA, r.mw.centreB] },
    ],
    controls: [{
      kind: 'toggle', param: 'timeMode',
      options: [['demo', 'gui.timeDemo'], ['real', 'gui.timeReal']],
    }],
  },
  {
    id: 'powerReserve',
    nameKey: 'station.powerReserve',
    focus: 'part.powerReserve',
    highlight: { mods: ['powerReserve'] },
    chain: { branch: 'reserve' },
    test: 'умова диференціала: Δводило = (ΔS_up + ΔS_low)/2 при заведенні й ході',
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
