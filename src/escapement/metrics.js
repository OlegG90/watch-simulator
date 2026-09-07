import * as THREE from 'three';

/**
 * Ціна складності варіанта — виміряна, не вписана.
 *
 * Модель не відтворює того, ЩО дає турбійон: усереднення гравітаційної похибки
 * в скриптованій кінематиці не виникає. Але вона чесно показує, у що це
 * обходиться, і саме це тут рахується — обходом графа самого варіанта.
 *
 * Жодного числа руками: спробуйте змінити конструкцію — числа підуть за нею.
 *
 * ЩО САМЕ МІРЯЄМО
 * - `parts`   — скільки деталей у вузлі;
 * - `moving`  — скільки з них у русі (у турбійоні — всі: кліть везе весь спуск);
 * - `axes`    — скільки рівнів обертання вкладено одне в одне: анкерний — 1,
 *               турбійон — 2 (кліть, а в ній спуск), двовісний — 3;
 * - `r`, `h`  — півширина ніші й висота стека, тобто зайнятий простір.
 */

const T1 = 0.21, T2 = 0.63;   // два несиметричні моменти удару
const BEAT = 2.5, AMP = 220;

/** Локальна поза вузла — за нею видно, чи він рухається. */
const pose = (o) => `${o.rotation.x},${o.rotation.y},${o.rotation.z},` +
                    `${o.position.x},${o.position.y},${o.position.z}`;

/**
 * @param variant `{ rotating, fixed, update }` — як його віддає гніздо
 * @returns `{ parts, moving, axes, r, h }`
 */
export function measureVariant({ rotating, fixed, update }) {
  const roots = [rotating, fixed];

  // ── 1. Хто рухається: звіряємо пози у двох різних моментах ──
  const before = new Map();
  update(T1, BEAT, AMP);
  for (const root of roots) root.traverse((o) => before.set(o, pose(o)));
  update(T2, BEAT, AMP);
  const spins = new Set();
  for (const root of roots) root.traverse((o) => { if (before.get(o) !== pose(o)) spins.add(o); });

  // ── 2. Деталі, рух і глибина вкладених обертань ──
  let parts = 0, moving = 0, axes = 0;
  const vtx = new THREE.Vector3();
  const toLocal = new THREE.Matrix4();
  const inRoot = new THREE.Matrix4();
  let rMax = 0, zMin = Infinity, zMax = -Infinity;

  update(0, BEAT, AMP); // поза для вимірювання габариту — та сама, що при збірці
  for (const root of roots) {
    // Усе під `rotating` везе анкерна вісь: вона обертається завжди, тож це
    // окремий, зовнішній рівень обертання.
    const carried = root === rotating ? 1 : 0;
    root.updateMatrixWorld(true);
    // Габарит міряємо у системі координат ГНІЗДА, а не сцени: гніздо стоїть
    // далеко від центра платини, і світові координати дали б радіус ніші
    // разом із відстанню до неї.
    toLocal.copy(root.matrixWorld).invert();
    root.traverse((o) => {
      if (!o.isMesh) return;
      parts++;

      // Скільки рівнів обертання над цією деталлю (враховуючи її саму).
      let levels = carried;
      for (let p = o; p && p !== root.parent; p = p.parent) if (spins.has(p)) levels++;
      if (levels > 0) moving++;
      axes = Math.max(axes, levels);

      // Габарит — по самих вершинах, у системі координат гнізда.
      // Обмежувальні тіла тут брешуть в обидва боки: коробка навколо тора дає
      // свій кут (√2 × R), а сфера навколо високої колони — свою висоту, і
      // кліть «розростається» з 4.3 до 5.6. Вершин небагато, а міряємо раз.
      inRoot.multiplyMatrices(toLocal, o.matrixWorld);
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        vtx.fromBufferAttribute(pos, i).applyMatrix4(inRoot);
        rMax = Math.max(rMax, Math.hypot(vtx.x, vtx.y));
        zMin = Math.min(zMin, vtx.z);
        zMax = Math.max(zMax, vtx.z);
      }
    });
  }

  return {
    parts,
    moving,
    axes,
    r: Math.round(rMax * 100) / 100,
    h: Math.round((zMax - zMin) * 100) / 100,
  };
}
