import { CONTENT } from './lesson/content.js';

/**
 * Мова інтерфейсу. Українська — базова; англійські назви вузлів горологічні,
 * не буквальний переклад (проміжне = third wheel, секундне = fourth wheel).
 *
 * Ключі `part.*` іменують деталі й течуть у 3D-підписи, тумблери видимості та
 * пресети камери — тому вони мусять бути ключами, а не рядками, ще до того, як
 * над сценою з'явиться будь-який текст уроку.
 *
 * `%n` у значенні — місце для числа (див. `tn`).
 */
const DICT = {
  ua: {
    // ── деталі механізму ──
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

    // ── панель вільного режиму ──
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

    // ── станції ──
    'station.winding': 'Заведення',
    'station.energy': 'Енергія',
    'station.train': 'Колісна передача',
    'station.escapement': 'Спуск і регулятор',
    'station.timeDisplay': 'Індикація часу',
    'station.powerReserve': 'Запас ходу',
    'station.winding.sub': 'головка · конічна пара · собачка',
    'station.energy.sub': 'барабан · пружина · заряд',
    'station.train.sub': '4 зачеплення · 48→12→40…',
    'station.escapement.sub': 'анкерне колесо · вилка · баланс',
    'station.timeDisplay.sub': '12 : 1 і 60 : 1',
    'station.powerReserve.sub': 'диференціал · віднімання кутів',

    // ── оболонка уроку ──
    'app.subtitle': 'дослідження механіки',
    'mode.lesson': 'Дослідження',
    'mode.free': 'Вільний режим',
    'rail.title': 'Ланцюг енергії',
    'rail.subtitle': 'Шість зупинок: від вашого пальця на головці до кута стрілки.',
    'rail.collected': 'ЗІБРАНО ДОСІ',
    'rail.more': '+ ще %n раніше',
    'rail.empty': 'Порожньо — це перша зупинка. Кожна лишить по одному реченню, і наприкінці вони складуться в опис ходу.',
    'card.station': 'СТАНЦІЯ %n З 6',
    'card.soon': 'Зміст картки — у наступній фазі: головна думка, формула з живими числами й одна ручка покрутити.',
    'card.start': 'початок',
    'card.summary': 'Підсумок',
    'chain.label': 'ЛАНЦЮГ',
    'chain.where': 'де ви зараз у потоці енергії',
    'chain.winding': 'Заведення',
    'chain.barrel': 'Барабан',
    'chain.train': 'Передача',
    'chain.escape': 'Спуск',
    'chain.balance': 'Баланс',
    'chain.powerReserve': 'Запас ходу',
    'chain.hands': 'Стрілки',
    'chain.rate': 'ритм',
    'view.top': 'Згори',
    'view.side': 'Збоку',
    'view.caption': 'розгортка вздовж ланцюга · висоти справжні, вертикальний масштаб ×%1',
    'status.modelTime': 'Демонстраційний час',
    'status.realTime': 'Реальний час',
    'status.speed': 'швидкість',
    'status.wind': 'завод',
    'foot.modelTime': 'модельний час',
    'hint.controls': 'ЛКМ — обертання · колесо — зум · ПКМ — панорама',
  },
  en: {
    // ── mechanism parts ──
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

    // ── free-mode panel ──
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

    // ── stations ──
    'station.winding': 'Winding',
    'station.energy': 'Energy',
    'station.train': 'Going train',
    'station.escapement': 'Escapement & regulator',
    'station.timeDisplay': 'Time display',
    'station.powerReserve': 'Power reserve',
    'station.winding.sub': 'crown · bevel pair · click',
    'station.energy.sub': 'barrel · mainspring · charge',
    'station.train.sub': '4 meshes · 48→12→40…',
    'station.escapement.sub': 'escape wheel · lever · balance',
    'station.timeDisplay.sub': '12 : 1 and 60 : 1',
    'station.powerReserve.sub': 'differential · subtracting angles',

    // ── lesson shell ──
    'app.subtitle': 'movement explorer',
    'mode.lesson': 'Explore',
    'mode.free': 'Free mode',
    'rail.title': 'The energy chain',
    'rail.subtitle': 'Six stops: from your finger on the crown to the angle of a hand.',
    'rail.collected': 'COLLECTED SO FAR',
    'rail.more': '+ %n earlier',
    'rail.empty': 'Empty — this is the first stop. Each one leaves a sentence behind, and together they add up to a description of the going.',
    'card.station': 'STATION %n OF 6',
    'card.soon': 'Card content lands in the next phase: the key idea, a formula with live numbers, and one control to turn.',
    'card.start': 'start',
    'card.summary': 'Summary',
    'chain.label': 'CHAIN',
    'chain.where': 'where you are in the flow of energy',
    'chain.winding': 'Winding',
    'chain.barrel': 'Barrel',
    'chain.train': 'Train',
    'chain.escape': 'Escape',
    'chain.balance': 'Balance',
    'chain.powerReserve': 'Power reserve',
    'chain.hands': 'Hands',
    'chain.rate': 'rate',
    'view.top': 'Top',
    'view.side': 'Side',
    'view.caption': 'developed section along the chain · true heights, vertical scale ×%1',
    'status.modelTime': 'Model time',
    'status.realTime': 'Real time',
    'status.speed': 'speed',
    'status.wind': 'wind',
    'foot.modelTime': 'model time',
    'hint.controls': 'LMB — orbit · wheel — zoom · RMB — pan',
  },
};

// Копірайт уроку живе окремо (`lesson/content.js`) — тут лишається хром.
for (const l of Object.keys(DICT)) Object.assign(DICT[l], CONTENT[l]);

export const LANGS = Object.keys(DICT);
const listeners = new Set();
let lang = 'ua';

/** Переклад ключа; невідомий ключ повертається як є — щоб пропуск було видно. */
export function t(key) {
  return DICT[lang][key] ?? DICT.ua[key] ?? key;
}

/** Переклад із підстановкою числа замість `%n`. */
export const tn = (key, n) => t(key).replace('%n', String(n));

/** Переклад із підстановкою `%1`, `%2`, … — усі входження кожного. */
export function tf(key, ...vals) {
  let out = t(key);
  vals.forEach((v, i) => { out = out.split(`%${i + 1}`).join(String(v)); });
  return out;
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
