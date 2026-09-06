/**
 * Шість станцій ланцюга енергії — порядок дорівнює напряму потоку енергії,
 * а не зростанню складності.
 *
 * Тут лише каркас: що підсвітити й куди дивитись. Зміст карток (формули, живі
 * числа, ручки) додається у своїй фазі; ключі назв — у `i18n.js`.
 *
 * `focus` — ім'я точки фокуса з `movement.focusPoints`; `null` = загальний вид.
 * `highlight` — набір для `createHighlighter().focus()`.
 * `chain` — місце станції в діаграмі підвалу: рядок ланцюга або відгалуження.
 * `test` — назва тесту, яким підперта головна теза станції; мета-тест звіряє,
 *          що такий тест справді існує в наборі.
 */
export const STATIONS = [
  {
    id: 'winding',
    chain: { row: 0 },
    nameKey: 'station.winding',
    focus: 'part.winding',
    highlight: { mods: ['winding'] },
    test: 'барабанне колесо нерухоме під час заведення',
  },
  {
    id: 'energy',
    chain: { row: 1 },
    nameKey: 'station.energy',
    focus: 'part.barrel',
    highlight: { mods: ['barrel'], arbors: [0] },
    test: 'стиснення: більший заряд → менший зовнішній радіус, більше витків',
  },
  {
    id: 'train',
    chain: { row: 2 },
    nameKey: 'station.train',
    focus: null,
    highlight: { mods: ['train'] },
    test: 'інваріант зачеплення = 0 на всіх 4 парах за довільних кутів',
  },
  {
    id: 'escapement',
    chain: { row: 3 },
    nameKey: 'station.escapement',
    focus: 'part.tourbillon',
    highlight: { mods: ['tourbillon'] },
    test: 'θ_cage = β: спокій між ударами, +π/15 за удар',
  },
  {
    id: 'timeDisplay',
    chain: { branch: 'hands' },
    nameKey: 'station.timeDisplay',
    focus: 'part.hands',
    highlight: { mods: ['motionWorks'] },
    test: 'центральна секунда : хвилинна вісь = 60',
  },
  {
    id: 'powerReserve',
    chain: { branch: 'reserve' },
    nameKey: 'station.powerReserve',
    focus: 'part.powerReserve',
    highlight: { mods: ['powerReserve'] },
    test: 'умова диференціала: Δводило = (ΔS_up + ΔS_low)/2 при заведенні й ході',
  },
];

export const stationById = (id) => STATIONS.find((s) => s.id === id) ?? null;
