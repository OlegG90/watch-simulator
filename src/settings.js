/**
 * Налаштування ходу — одна таблиця на весь застосунок.
 *
 * Доти «які взагалі є ручки, у яких межах і під яким підписом» не мало
 * власного місця: три повзунки були оголошені двічі — у `main.js` для lil-gui
 * і в `lesson/stations.js` для карток, — з межами, зведеними вручну. Ніщо не
 * перевіряло, що вони збігаються, а картка могла назвати параметр, якого
 * немає: `params[c.param] = …` мовчки створював новий ключ, повзунок їздив, і
 * не відбувалося нічого.
 *
 * Таблиця тут одна, а над нею два адаптери — панель вільного режиму й ручка на
 * картці станції. Два адаптери, тому шов справжній, а не про запас.
 *
 * `values` — звичайний обʼєкт: його читає цикл рендеру (`params.beatHz`), і
 * геттери там коштували б дорожче за саме значення.
 */

/** `labelKey` — ключ словника; підписи ніде не вписуються текстом. */
const SPEC = {
  running: { kind: 'flag', value: true, labelKey: 'gui.running' },
  timeMode: {
    kind: 'choice', value: 'demo', labelKey: 'gui.timeMode',
    options: [['demo', 'gui.timeDemo'], ['real', 'gui.timeReal']],
  },
  speed: {
    kind: 'range', value: 1.0, min: 0, max: 10, step: 0.1,
    labelKey: 'gui.speed', fmt: (v) => `×${v.toFixed(1)}`,
  },
  beatHz: {
    kind: 'range', value: 2.5, min: 0.5, max: 6, step: 0.1,
    labelKey: 'gui.beat', fmt: (v) => v.toFixed(1),
  },
  amplitude: {
    kind: 'range', value: 220, min: 90, max: 270, step: 5,
    labelKey: 'gui.amplitude', fmt: (v) => `${v}°`,
  },
  wireframe: { kind: 'flag', value: false, labelKey: 'gui.wireframe' },
};

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function createSettings() {
  const values = {};
  for (const [name, s] of Object.entries(SPEC)) values[name] = s.value;

  /** Опис параметра. Невідоме імʼя — помилка тут, а не тиша на екрані. */
  function spec(name) {
    const s = SPEC[name];
    if (!s) throw new Error(`невідоме налаштування: ${name}`);
    return s;
  }

  /**
   * Записати значення. Діапазон затискається за тією ж таблицею, з якої
   * побудовано ручку, тож «поза межами» не залежить від того, хто пише.
   */
  function set(name, v) {
    const s = spec(name);
    values[name] = s.kind === 'range' ? clamp(Number(v), s.min, s.max) : v;
    return values[name];
  }

  return { values, names: Object.keys(SPEC), spec, set };
}
