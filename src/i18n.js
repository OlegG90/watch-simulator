/**
 * Мова інтерфейсу. Українська — базова; англійські назви вузлів горологічні,
 * не буквальний переклад (проміжне = third wheel, секундне = fourth wheel).
 *
 * Ключі `part.*` іменують деталі й течуть у 3D-підписи, тумблери видимості та
 * пресети камери — тому вони мусять бути ключами, а не рядками, ще до того, як
 * над сценою з'явиться будь-який текст уроку.
 */
const DICT = {
  ua: {
    'part.barrel': 'Барабан',
    'part.centre': 'Центральне колесо',
    'part.third': 'Проміжне колесо',
    'part.fourth': 'Секундне колесо',
    'part.escapeArbor': 'Анкерний вузол',
    'part.tourbillon': 'Турбійон',
    'part.fixedWheel': 'Нерухоме колесо',
    'part.balance': 'Баланс',
    'part.hands': 'Стрілки',
    'part.winding': 'Заведення',
    'part.click': 'Собачка',
    'part.powerReserve': 'Запас ходу',

    'gui.running': 'Рух',
    'gui.timeMode': 'Режим часу',
    'gui.timeDemo': 'Демонстраційний час',
    'gui.timeReal': 'Реальний час',
    'gui.speed': 'Швидкість',
    'gui.beat': 'Хід, уд/с',
    'gui.amplitude': 'Амплітуда, °',
    'gui.wireframe': 'Каркас',
    'gui.wind': '⟳ Завести пружину',
    'gui.charge': 'Завод, %',
    'gui.labels': 'Підписи',
    'gui.nodes': 'Вузли',
    'gui.handsAndMotionWorks': 'Стрілки + моторний мех.',
    'gui.camera': 'Камера',
    'cam.overview': 'Загальний вид',

    'station.winding': 'Заведення',
    'station.energy': 'Енергія',
    'station.train': 'Колісна передача',
    'station.escapement': 'Спуск і регулятор',
    'station.timeDisplay': 'Індикація часу',
    'station.powerReserve': 'Запас ходу',
  },
  en: {
    'part.barrel': 'Barrel',
    'part.centre': 'Centre wheel',
    'part.third': 'Third wheel',
    'part.fourth': 'Fourth wheel',
    'part.escapeArbor': 'Escape arbor',
    'part.tourbillon': 'Tourbillon',
    'part.fixedWheel': 'Fixed wheel',
    'part.balance': 'Balance',
    'part.hands': 'Hands',
    'part.winding': 'Winding',
    'part.click': 'Click',
    'part.powerReserve': 'Power reserve',

    'gui.running': 'Run',
    'gui.timeMode': 'Time mode',
    'gui.timeDemo': 'Model time',
    'gui.timeReal': 'Real time',
    'gui.speed': 'Speed',
    'gui.beat': 'Rate, beats/s',
    'gui.amplitude': 'Amplitude, °',
    'gui.wireframe': 'Wireframe',
    'gui.wind': '⟳ Wind the mainspring',
    'gui.charge': 'Wind, %',
    'gui.labels': 'Labels',
    'gui.nodes': 'Nodes',
    'gui.handsAndMotionWorks': 'Hands + motion works',
    'gui.camera': 'Camera',
    'cam.overview': 'Overview',

    'station.winding': 'Winding',
    'station.energy': 'Energy',
    'station.train': 'Going train',
    'station.escapement': 'Escapement & regulator',
    'station.timeDisplay': 'Time display',
    'station.powerReserve': 'Power reserve',
  },
};

export const LANGS = Object.keys(DICT);
const listeners = new Set();
let lang = 'ua';

/** Переклад ключа; невідомий ключ повертається як є — щоб було видно на екрані. */
export function t(key) {
  return DICT[lang][key] ?? DICT.ua[key] ?? key;
}

export const getLang = () => lang;

export function setLang(next) {
  if (!DICT[next] || next === lang) return;
  lang = next;
  for (const fn of listeners) fn(lang);
}

/** Підписатися на зміну мови; повертає функцію відписки. */
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Для перевірок: набори ключів мають збігатися між мовами. */
export const dictKeys = (l) => Object.keys(DICT[l]);
