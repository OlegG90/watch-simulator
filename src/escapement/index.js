/**
 * Гніздо спуску: у механізмі завжди рівно один встановлений модуль.
 *
 * Усі варіанти збираються одразу при старті — заміна тоді миттєва, час і завод
 * її не помічають, і не треба коду розбирання (він тут уже одного разу виявився
 * мертвим і брехав про життєвий цикл). Але **оновлюється тільки встановлений**:
 * спіраль балансу переписує 1089 вершин щокадру, тож три працюючі спуски
 * потроїли б кадровий бюджет.
 *
 * Контракт варіанта: він отримує матеріали й параметри, а повертає
 * `{ id, nameKey, rotating, fixed, update(t, beatHz, amp) → β, api }`.
 * `rotating` чіпляється до анкерної осі, `fixed` стоїть у сцені. Більше про
 * варіант гніздо не знає — скільки в ньому вкладених клітей і навколо чого
 * вони крутяться, його справа.
 */
import { buildTourbillon, VARIANT_ID as TOURBILLON } from './tourbillon.js';
import { buildLever, VARIANT_ID as LEVER } from './lever.js';

/** Порядок = зростання складності. Саме в ньому їх показує порівняння. */
export const VARIANT_IDS = [LEVER, TOURBILLON];

/**
 * Який варіант стоїть при старті — найпростіший: подача веде від нього до
 * складніших. Це НЕ те саме, що перший у списку (порядок — подача, типовий
 * варіант — поведінка), просто тут вони збігаються.
 *
 * Вибір НЕ зберігається між сесіями: щоразу починаємо з анкерного спуску.
 */
export const DEFAULT_VARIANT = LEVER;

const BUILDERS = {
  [LEVER]: (mats, { escTeeth }) => {
    const l = buildLever(mats, { escTeeth, escDirLocal: 0 });
    return { rotating: l.rotating, fixed: l.fixed, update: l.update, api: l };
  },
  [TOURBILLON]: (mats, { escTeeth, cageMat, cageR }) => {
    const t = buildTourbillon(
      { ...mats, plateMat: cageMat },
      { escTeeth, fixedTeeth: 10, pinionTeeth: 10, moduleT: 0.26, cageR, escDirLocal: 0 }
    );
    return { rotating: t.cage, fixed: t.fixed, update: t.update, api: t };
  },
};

/**
 * Зібрати всі варіанти й встановити один.
 *
 * @param mount.arbor  група анкерної осі — до неї йде обертова частина
 * @param mount.root   корінь сцени — до нього йде нерухома частина
 * @param mount.pos    позиція гнізда у площині платини
 * @param mount.zBase  висота основи гнізда
 */
export function buildEscapementSocket(mats, opts, mount, installed = DEFAULT_VARIANT) {
  const built = new Map();

  for (const id of VARIANT_IDS) {
    const v = BUILDERS[id](mats, opts);
    v.rotating.position.z = mount.zBase;
    mount.arbor.add(v.rotating);
    v.fixed.position.set(mount.pos.x, mount.pos.y, mount.zBase);
    mount.root.add(v.fixed);
    built.set(id, { id, nameKey: `part.${id}`, ...v });
  }

  let current = installed;

  function show(id) {
    for (const [vid, v] of built) {
      const on = vid === id;
      v.rotating.visible = on;
      v.fixed.visible = on;
    }
    current = id;
  }
  show(current);

  return {
    ids: [...VARIANT_IDS],
    get installed() { return current; },
    get nameKey() { return built.get(current).nameKey; },
    variant: (id) => built.get(id),
    install(id) {
      if (!built.has(id)) throw new Error(`невідомий варіант спуску: ${id}`);
      show(id);
    },
    /** Рухається ТІЛЬКИ встановлений варіант — решта сховані й не рахуються. */
    update: (t, beatHz, amp) => built.get(current).update(t, beatHz, amp),
  };
}
