/**
 * Вигляд збоку — **розгортка вздовж ланцюга**, а не проекція.
 *
 * Чесна ортогональна проекція тут не працює: вона схлопує вісь Y, і кліть
 * турбійона (за 14 одиниць від барабана) налазить на диференціал. Тому
 * робимо так, як роблять у годинникових розрізах: висоти справжні, а по
 * горизонталі вузли стоять на своїх справжніх міжосьових відстанях уздовж
 * ланцюга. Побічний виграш — кожен тріб дотикається колеса сусіда рівно по
 * ділильних колах, бо відстані не вигадані.
 *
 * Деталі беруться з тих самих `layout…()` і `LAYERS`, що будують сцену:
 * діаграма не може розійтися з механізмом.
 */
import { TRAIN, layoutTrain } from '../train.js';
import { pitchR, WHEEL_T, PINION_T } from '../common.js';
import { LAYERS as BARREL } from '../barrel.js';
import { LAYERS as WIND, RATCHET_T, CROWN_T, RATCH_M } from '../winding.js';
import { profile as reserveProfile } from '../powerReserve.js';
import { profile as motionProfile } from '../motionWorks.js';
import { variantProfile } from '../escapement/index.js';
import { CAGE_R } from '../movement.js';

const V_EXAGGERATION = 2; // інакше шари в 1.1 зливаються; підписано у в'юпорті

/**
 * Деталі розрізу: `u` — місце вздовж ланцюга, `z0..z1` — висота, `r` — півширина.
 * Усе в одиницях механізму.
 *
 * Це КОМПОЗИТОР: власних чисел вузлів він не виводить. Кожен модуль сам каже,
 * з чого складається (`profile()`) і від якої осі висить (`anchor`) — тут лише
 * розставляються осі вздовж ланцюга.
 *
 * @param variant яку конструкцію спуску малювати — обов'язково: типовий
 *                варіант знає гніздо, і другої думки про нього тут не буде
 */
export function sectionParts(variant) {
  const arbors = layoutTrain();
  const u = [0];
  for (let k = 1; k < TRAIN.length; k++) {
    u.push(u[k - 1] + pitchR(TRAIN[k - 1].wheel) + pitchR(TRAIN[k].pinion));
  }

  const parts = [];
  const add = (p) => parts.push(p);

  // ── Ланцюг передачі: сходинка, де кожен щабель торкається наступного ──
  TRAIN.forEach((spec, k) => {
    if (spec.pinion) {
      add({ u: u[k], z0: arbors[k].pinionZ, z1: arbors[k].pinionZ + PINION_T,
            r: pitchR(spec.pinion), mod: 'train', kind: 'pinion' });
    }
    if (spec.wheel) {
      add({ u: u[k], z0: arbors[k].wheelZ, z1: arbors[k].wheelZ + WHEEL_T,
            r: pitchR(spec.wheel), mod: 'train', kind: 'wheel', labelKey: spec.nameKey });
    }
  });

  // Точки зачеплення — там, де ділильні кола дотикаються.
  const meshes = [];
  for (let k = 1; k < TRAIN.length; k++) {
    meshes.push({
      u: u[k] - pitchR(TRAIN[k].pinion),
      z: (arbors[k].pinionZ + arbors[k - 1].wheelZ + WHEEL_T) / 2,
      text: `${TRAIN[k - 1].wheel}→${TRAIN[k].pinion}`,
    });
  }

  // ── Барабан із пружиною (нижче колеса) ──
  const drumR = pitchR(TRAIN[0].wheel) - 1.2;
  add({ u: 0, z0: BARREL.drumCentre - BARREL.drumHeight / 2, z1: BARREL.drumCentre + BARREL.drumHeight / 2,
        r: drumR, mod: 'barrel', kind: 'drum' });

  // ── Заведення: храповик на осі барабана + коронне колесо на своїй ──
  add({ u: 0, z0: WIND.deck, z1: WIND.deck + 0.5, r: pitchR(RATCHET_T, RATCH_M), mod: 'winding', kind: 'wheel' });
  const uCrown = -((RATCHET_T + CROWN_T) / 2) * RATCH_M;
  add({ u: uCrown, z0: WIND.deck, z1: WIND.deck + 0.5, r: pitchR(CROWN_T, RATCH_M), mod: 'winding', kind: 'wheel',
        labelKey: 'part.winding' });

  // ── Решта вузлів: кожен розповідає про себе сам ──
  // Осі ланцюга — тут; що на них висить — справа самих модулів.
  const anchorU = { barrel: u[0], centre: u[1], seconds: u[3], escape: u[4] };
  const place = (mod, prof) => {
    // `anchor` — це те, що модуль каже композиторові, а не властивість деталі:
    // після розстановки він уже нічого не означає й у розгортку не йде.
    for (const { anchor, ...p } of prof.parts) add({ ...p, u: anchorU[anchor] + p.u, mod });
  };

  place('powerReserve', reserveProfile());
  place('motionWorks', motionProfile(arbors));

  // ── Гніздо спуску: показуємо ТЕ, ЩО СТОЇТЬ ──
  // Розгортка — єдина діаграма, яку тут тримають правдивою, тож вона мусить
  // малювати встановлений варіант, а не один назавжди обраний.
  place('escapement', variantProfile(variant, arbors[4].wheelZ, { cageR: CAGE_R }));

  // ── Платина ──
  const uMin = Math.min(...parts.map((p) => p.u - p.r));
  const uMax = Math.max(...parts.map((p) => p.u + p.r));
  add({ u: (uMin + uMax) / 2, z0: -3.6, z1: -2.8, r: (uMax - uMin) / 2, mod: 'plate', kind: 'plate' });

  return { parts, meshes, arborU: u, bounds: { uMin, uMax } };
}

/** Z-рівні для шкали ліворуч — беруться з тих самих даних. */
export function zTicks() {
  const arbors = layoutTrain();
  return [...new Set([
    ...arbors.map((a) => a.wheelZ),
    ...reserveProfile().zTicks,
    ...motionProfile(arbors).zTicks,
  ])].sort((a, b) => a - b);
}

export const V_SCALE = V_EXAGGERATION;
