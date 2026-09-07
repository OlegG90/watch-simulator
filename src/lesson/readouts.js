/**
 * Живі числа для карток станцій.
 *
 * Головне правило: **нічого не вписувати руками**. Кожне число тут виводиться
 * з тих самих констант, які будують геометрію й кінематику. Інакше картка,
 * що обіцяє «перевірено тестом», почне брехати при першій же зміні коду —
 * наприклад, варто зрушити `beatHz`, і зашите «12.0 с» стане неправдою.
 */
import { TRAIN, layoutTrain } from '../train.js';
import { M, pitchR } from '../common.js';
import { SPRING_TURNS_0, SPRING_TURNS_C, SPRING_SQUEEZE } from '../barrel.js';
import { profile as motionProfile } from '../motionWorks.js';
import { RATCHET_T, CROWN_T, BEVEL_W, BEVEL_P, RATCH_M } from '../winding.js';
import { profile as reserveProfile, RA, RB, SWEEP } from '../powerReserve.js';

// Арифметичне округлення, а не `toFixed`: той створює рядок на кожен виклик,
// а це гарячий шлях. Усі величини тут додатні, тож розбіжності між
// «половина від нуля» (toFixed) і «половина вгору» (Math.round) не виникає.
const round = (x, n = 2) => { const p = 10 ** n; return Math.round(x * p) / p; };

let RATIOS = null;

/**
 * Передавальні відношення вузлів відносно барабана — тим самим правилом, що й у `layoutTrain`.
 *
 * Рахується один раз: `TRAIN` незмінний, а цей масив лежить на гарячому шляху
 * (`readouts` кличеться щокадру). Результат **спільний — не мутувати**.
 */
export function trainRatios() {
  if (RATIOS) return RATIOS;
  const out = [{ nameKey: TRAIN[0].nameKey, omega: 1, pair: null }];
  for (let k = 1; k < TRAIN.length; k++) {
    const zw = TRAIN[k - 1].wheel, zp = TRAIN[k].pinion;
    out.push({ nameKey: TRAIN[k].nameKey, omega: -out[k - 1].omega * (zw / zp), pair: `${zw}/${zp}` });
  }
  RATIOS = out;
  return RATIOS;
}

/** Пів-кроку зубця анкерного колеса — стільки воно проходить за удар балансу. */
export const halfStep = () => Math.PI / TRAIN[4].escapeTeeth;

/** Період оберту кліті: 2π / (пів-крок · удари за секунду). */
export const cagePeriod = (beatHz) => (2 * Math.PI) / (halfStep() * beatHz);

/** Період секундного колеса — з відношення його швидкості до швидкості кліті. */
export function secondsWheelPeriod(beatHz) {
  const r = trainRatios();
  return cagePeriod(beatHz) * Math.abs(r[4].omega / r[3].omega);
}

/** Скільки модельного часу тримає завод від заряду `c` до нуля, при даному ході. */
export function runTime(beatHz, c = 1) {
  const r = trainRatios();
  const drivePerSec = (halfStep() * beatHz) / r[4].omega; // приріст кута барабана за секунду
  return (c * 2 * SWEEP) / RB / drivePerSec;
}

/** Приріст заряду за один клік (чверть оберту храповика). */
export const chargePerClick = () => (RA * (Math.PI / 2)) / (2 * SWEEP);

/**
 * Моторний механізм: обидві пари й доказ, що міжосьова в них однакова.
 *
 * Числа приходять із самого модуля — тут лишається тільки округлення для
 * показу. Доти цей самий вираз міжосьової був вписаний тричі: у модулі, тут і
 * в розгортці.
 */
export function motionWorks() {
  const { hourRatio, centres, modules } = motionProfile(layoutTrain());
  return {
    hourRatio,
    centreA: round(centres.mw1, 3),
    centreB: round(centres.mw2, 3),
    equal: centres.equal,
    modules: [modules[0], round(modules[1], 4)],
  };
}

/** Центральна секунда: 48→20→8 множить швидкість секундної осі на 6. */
export function centralSeconds() {
  const r = trainRatios();
  const { step, idler } = motionProfile(layoutTrain()).cs;
  return { step, total: Math.abs(r[3].omega / r[1].omega) * step, idler };
}

/** Передача запасу ходу: та сама міжосьова в обох пар — тому проміжне колесо одне. */
export function reserveTrain() {
  const { ratio, centres } = reserveProfile();
  return { ratio, centreA: round(centres.hub, 3), centreB: round(centres.sun, 3), equal: centres.equal };
}

/** Заведення: скільки обертів робить головка на один оберт храповика. */
export const crownPerRatchet = () => (RATCHET_T / CROWN_T) * (BEVEL_W / BEVEL_P);

/** Кути ділильних конусів заводної пари — доповнюють один одного до 90°. */
export function bevelAngles() {
  const w = (Math.atan(BEVEL_W / BEVEL_P) * 180) / Math.PI;
  const p = (Math.atan(BEVEL_P / BEVEL_W) * 180) / Math.PI;
  return { wheel: round(w, 1), pinion: round(p, 1), sum: round(w + p, 1) };
}

/** Крок зубця храповика — по ньому й клацає собачка. */
export const ratchetStepDeg = () => round(360 / RATCHET_T, 2);

/** Форма пружини при даному заряді. `out` — необов'язковий буфер для гарячого шляху. */
export function springAt(c, out = {}) {
  out.turns = round(SPRING_TURNS_0 + SPRING_TURNS_C * c, 1);
  out.squeeze = round(SPRING_SQUEEZE * c, 2);
  return out;
}

/** Радіус барабанного колеса — звідки береться масштаб усього механізму. */
export const barrelR = () => round(pitchR(TRAIN[0].wheel, M), 2);

let CONST = null;

/**
 * Те, що взагалі не залежить від налаштувань — самі сталі механізму.
 * Рахується один раз; ці вкладені об'єкти спільні для всіх знімків.
 */
function constants() {
  if (CONST) return CONST;
  CONST = {
    ratios: trainRatios(),
    halfStepDeg: round((halfStep() * 180) / Math.PI, 1),
    clickPct: Math.round(chargePerClick() * 1000) / 10,
    mw: motionWorks(),
    cs: centralSeconds(),
    reserve: reserveTrain(),
    bevel: bevelAngles(),
    crownTurns: round(crownPerRatchet(), 2),
    ratchetStep: ratchetStepDeg(),
    barrelR: barrelR(),
    sweepDeg: Math.round((SWEEP * 180) / Math.PI),
  };
  return CONST;
}

/**
 * Знімок усіх чисел для картки: сталі — з констант, змінні — з поточних
 * налаштувань і заряду.
 *
 * Функція лежить у циклі рендеру, тому не має алокувати: сталі беруться з
 * `constants()`, а викличник із гарячого шляху передає власний буфер `out`
 * і перевикористовує його щокадру. Без буфера повертається свіжий об'єкт —
 * знімки лишаються незалежними для тих, хто порівнює два виклики.
 */
export function readouts({ beatHz, amplitude, speed, charge }, out = {}) {
  const k = constants();
  const run = runTime(beatHz, 1);

  out.beatHz = beatHz;
  out.amplitude = amplitude;
  out.speed = speed;
  out.charge = charge;
  out.chargePct = Math.round(charge * 100);
  out.cagePeriod = round(cagePeriod(beatHz), 1);
  out.secondsPeriod = round(secondsWheelPeriod(beatHz), 1);
  out.fullRun = Math.round(run);
  // Швидкість множить модельний час, тож на екрані завод «згорає» швидше.
  out.fullRunMin = round(run / 60 / Math.max(speed, 0.1), 1);
  out.spring = springAt(charge, out.spring);

  out.ratios = k.ratios;
  out.halfStepDeg = k.halfStepDeg;
  out.clickPct = k.clickPct;
  out.mw = k.mw;
  out.cs = k.cs;
  out.reserve = k.reserve;
  out.bevel = k.bevel;
  out.crownTurns = k.crownTurns;
  out.ratchetStep = k.ratchetStep;
  out.barrelR = k.barrelR;
  out.sweepDeg = k.sweepDeg;
  return out;
}
