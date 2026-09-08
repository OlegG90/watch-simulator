import * as THREE from 'three';

/**
 * Спіраль балансу вітрини — плоска стрічка, що дихає.
 *
 * Предмет вітрини — зачеплення, тож спіраль тут ілюстрація «пружина дихає»,
 * а не модель регулятора: кінцевої кривої Бреге нема, радіальне дихання
 * виходить з диференційного розвороту (внутрішній кінець їде з балансом,
 * зовнішній стоїть у колодці), а не з фізики. Це зафіксоване спрощення,
 * а не недоробка.
 *
 * Форма — стрічка в площині (не трубка): деформація планарна, тож нормалі
 * сталі (0,0,1) і буфер вершин переписується на місці — нуль алокацій
 * у кадрі, як вимагає практика руху.
 */

/** Витків, точок, радіуси (внутрішній — на колодці осі, зовнішній — у stud). */
export const TURNS = 5;
export const SPRING_N = 200;
export const SPRING_R0 = 0.18;
export const SPRING_R1 = 0.95;
const WIDTH = 0.045;

export function buildSpring({ cx, cy, z, material }) {
  const pos = new Float32Array(SPRING_N * 2 * 3);
  const nor = new Float32Array(SPRING_N * 2 * 3);
  for (let i = 0; i < SPRING_N; i++) {
    nor.set([0, 0, 1], (i * 2) * 3);
    nor.set([0, 0, 1], (i * 2 + 1) * 3);
  }
  const idx = [];
  for (let i = 0; i < SPRING_N - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(idx);

  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(cx, cy, z);
  mesh.frustumCulled = false; // вершини рухаються — кешованої сфери меж нема
  mesh.castShadow = true;

  const center = new Float32Array(SPRING_N * 2);
  /**
   * Дихання: точка i повернута на кут балансу з вагою (1 − i/(N−1)) —
   * внутрішній кінець (i=0) жорстко з балансом, зовнішній стоїть.
   * Пише в той самий буфер, геометрію не чіпає.
   */
  function update(bal) {
    for (let i = 0; i < SPRING_N; i++) {
      const f = i / (SPRING_N - 1);
      const r = SPRING_R0 + (SPRING_R1 - SPRING_R0) * f;
      const a = f * TURNS * Math.PI * 2 + bal * (1 - f);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      center[i * 2] = x;
      center[i * 2 + 1] = y;
    }
    for (let i = 0; i < SPRING_N; i++) {
      const p = i === 0 ? 0 : i - 1, q = i === SPRING_N - 1 ? i : i + 1;
      let tx = center[q * 2] - center[p * 2], ty = center[q * 2 + 1] - center[p * 2 + 1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      const nx = -ty * WIDTH / 2, ny = tx * WIDTH / 2;
      pos.set([center[i * 2] + nx, center[i * 2 + 1] + ny, 0], (i * 2) * 3);
      pos.set([center[i * 2] - nx, center[i * 2 + 1] - ny, 0], (i * 2 + 1) * 3);
    }
    geo.attributes.position.needsUpdate = true;
  }

  update(0);
  return { mesh, update };
}
