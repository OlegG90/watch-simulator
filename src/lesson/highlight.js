/**
 * Підсвітка вузла: приглушити все, крім заданого набору.
 *
 * Матеріали в сцені СПІЛЬНІ (одна `brass` на десятках мешів), тому міняти
 * `material.opacity` не можна — зблякне пів-механізму. Натомість тримаємо по
 * одному приглушеному клону на кожен матеріал і підмінюємо `mesh.material`.
 *
 * Приналежність береться з `userData.mod` (модуль) та `userData.arbor` (номер
 * вузла передачі) — їх проставляють самі модулі під час збірки.
 */

const DIM_OPACITY = 0.12;

export function createHighlighter(root, { dimOpacity = DIM_OPACITY } = {}) {
  const dimOf = new Map();   // оригінальний матеріал → приглушений клон
  const items = [];          // { obj, base, mod, arbor }

  root.traverse((o) => {
    if (!o.isMesh && !o.isLine) return; // спрайти-підписи не чіпаємо
    items.push({ obj: o, base: o.material, mod: o.userData.mod ?? null, arbor: o.userData.arbor });
  });

  function dimmed(mat) {
    let d = dimOf.get(mat);
    if (!d) {
      d = mat.clone();
      d.transparent = true;
      d.opacity = (mat.opacity ?? 1) * dimOpacity;
      d.depthWrite = false;
      dimOf.set(mat, d);
    }
    // Клон робиться один раз, а база може змінитися після цього: тумблер
    // «Каркас» у вільному режимі перемикає саме оригінали. Без цієї звірки
    // повернення в дослідження показало б підсвічене каркасом, а приглушене —
    // суцільним.
    d.wireframe = mat.wireframe;
    return d;
  }

  /**
   * @param {?{mods?: string[], arbors?: number[]}} spec
   *        null або порожній набір — показати все у повну силу.
   */
  function focus(spec) {
    const mods = new Set(spec?.mods ?? []);
    const arbors = new Set(spec?.arbors ?? []);
    const all = mods.size === 0 && arbors.size === 0;
    for (const it of items) {
      const lit = all || mods.has(it.mod) || arbors.has(it.arbor);
      it.obj.material = lit ? it.base : dimmed(it.base);
    }
  }

  /** Повернути сцену до повної яскравості. */
  const clear = () => focus(null);

  /** Які модулі взагалі є в сцені (для перевірок). */
  const modules = () => new Set(items.map((it) => it.mod));

  /** Скільки мешів зараз приглушено (для перевірок). */
  const dimCount = () => items.filter((it) => it.obj.material !== it.base).length;

  // Знищувати нічого не треба: клонів рівно стільки, скільки різних матеріалів
  // у сцені (одиниці), а підсвітка живе стільки ж, скільки сама сторінка.
  // `dispose()` тут був мертвим кодом і вдавав керований життєвий цикл.

  clear();
  return { focus, clear, modules, dimCount, count: items.length };
}
