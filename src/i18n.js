import { CONTENT } from './lesson/content.js';

/**
 * The interface language. Ukrainian is the base one; the English part names are
 * horological rather than literal translations — `part.third` is the third wheel and
 * `part.fourth` the fourth wheel, whatever the Ukrainian side calls them.
 *
 * The `part.*` keys name the parts and flow into the 3D labels, the visibility
 * toggles and the camera presets — which is why they must be keys rather than
 * strings, well before any lesson text appears over the scene.
 *
 * A `%n` inside a value is a slot for a number (see `tn`).
 */
const DICT = {
  ua: {
    // ── units ──
    'unit.s': 'с',

    // ── parts of the movement ──
    'part.barrel': 'Барабан',
    'part.centre': 'Центральне колесо',
    'part.third': 'Проміжне колесо',
    'part.fourth': 'Секундне колесо',
    'part.escapeArbor': 'Анкерний вузол',
    'part.escapement': 'Спуск',
    'part.lever': 'Анкерний спуск',
    'part.doubleAxis': 'Двовісний турбійон',
    'part.tourbillon': 'Турбійон',
    'part.fixedWheel': 'Нерухоме колесо',
    'part.escapeWheel': 'Анкерне колесо',
    'part.fork': 'Вилка',
    'part.balance': 'Баланс',
    'part.hands': 'Стрілки',
    'part.winding': 'Заведення',
    'part.click': 'Собачка',
    'part.powerReserve': 'Запас ходу',

    // ── the free-mode panel ──
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
    'gui.cageOpacity': 'Кліть — прозорість',
    'gui.cageTopPlate': 'Кліть — верхня платівка',

    // ── the «Variants» modal: the escapement socket ──
    'variants.eyebrow': 'Гніздо спуску',
    'variants.title': 'Варіанти модуля',
    'variants.lead': 'У механізмі завжди рівно один спуск. Ці три виконують ту саму роботу — і коштують дуже по-різному.',
    'variants.installed': 'встановлено',
    'variants.planned': 'у планах',
    'variants.behaviour': 'Що робить',
    'variants.metric.escapeTurn': 'оберт анкерного колеса',
    'variants.metric.cageTurn': 'оберт кліті',
    'variants.metric': 'Чим платимо',
    'variants.metric.parts': 'деталей',
    'variants.metric.moving': 'з них у русі',
    'variants.metric.axes': 'рівнів обертання',
    'variants.metric.size': 'ніша, радіус × висота',
    'variants.keep': 'Лишити як є',
    'variants.apply': 'Змінити',
    'variants.open': 'Варіанти',
    'variants.honesty': 'темп у всіх трьох однаковий — це перевірено тестом. А вигоду турбійона (усереднення похибки балансу) ця модель не відтворює: тут видно тільки її ціну.',
    'variants.lever.desc': 'Анкерне колесо сидить прямо на анкерній осі; вилка й баланс поруч на платині. Колесо обертається рівно на приводний кут.',
    'variants.tourbillon.desc': 'Увесь спуск усередині кліті, яка сама обертається навколо нерухомого колеса. Анкерне колесо їде на кліті, тож крутиться і з нею, і відносно неї — удвічі швидше.',
    'variants.doubleAxis.desc': 'Кліть у кліті: друга вісь обертання під кутом до першої. Ще не збудовано.',
    'gui.camera': 'Камера',
    'cam.overview': 'Загальний вид',

    // ── stations ──
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

    // ── the lesson shell ──
    'app.subtitle': 'дослідження механіки годинника',
    'mode.lesson': 'Дослідження',
    'mode.free': 'Вільний режим',
    'mode.showcase': 'Модель спуску',
    'mode.back': '← Дослідження',
    // ── showcase: motion controls ──
    'show.play': 'Грати',
    'show.pause': 'Пауза',
    'show.step': 'Крок',
    'show.home': 'Вихідний вид',
    'show.exag': 'замок і падіння збільшено',
    'show.speed': 'Швидкість',
    'show.phase.lock': 'Замок',
    'show.phase.unlock': 'Зрив',
    'show.phase.impulse': 'Імпульс',
    'show.phase.drop': 'Падіння',
    'show.pallet.entry': 'вхідна палета',
    'show.pallet.exit': 'вихідна палета',
    'rail.title': 'Ланцюг енергії',
    'rail.subtitle': 'Шість зупинок: від вашого пальця на головці до кута стрілки.',
    'rail.collected': 'ЗІБРАНО ДОСІ',
    'rail.more': '+ ще %n раніше',
    'rail.empty': 'Порожньо — це перша зупинка. Кожна лишить по одному реченню, і наприкінці вони складуться в опис ходу.',
    'card.station': 'СТАНЦІЯ %n З 6',
    'card.soon': 'Зміст картки — у наступній фазі: головна думка, формула з живими числами й одна ручка покрутити.',
    'card.start': 'початок',
    'card.resume': 'Кілька зупинок уже пройдено — їхні речення тримає рейка ліворуч. Звідси можна почати спочатку або повернутися на будь-яку.',
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
    // ── units ──
    'unit.s': 's',

    // ── mechanism parts ──
    'part.barrel': 'Barrel',
    'part.centre': 'Centre wheel',
    'part.third': 'Third wheel',
    'part.fourth': 'Fourth wheel',
    'part.escapeArbor': 'Escape arbor',
    'part.escapement': 'Escapement',
    'part.lever': 'Lever escapement',
    'part.doubleAxis': 'Double-axis tourbillon',
    'part.tourbillon': 'Tourbillon',
    'part.fixedWheel': 'Fixed wheel',
    'part.escapeWheel': 'Escape wheel',
    'part.fork': 'Pallet fork',
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
    'gui.cageOpacity': 'Cage opacity',
    'gui.cageTopPlate': 'Cage top plate',

    // ── the variants modal: the escapement socket ──
    'variants.eyebrow': 'Escapement socket',
    'variants.title': 'Module variants',
    'variants.lead': 'The movement always holds exactly one escapement. These three do the same job — at very different cost.',
    'variants.installed': 'installed',
    'variants.planned': 'planned',
    'variants.behaviour': 'What it does',
    'variants.metric.escapeTurn': 'escape wheel turn',
    'variants.metric.cageTurn': 'cage turn',
    'variants.metric': 'What it costs',
    'variants.metric.parts': 'parts',
    'variants.metric.moving': 'of them moving',
    'variants.metric.axes': 'nested rotations',
    'variants.metric.size': 'footprint, radius × height',
    'variants.keep': 'Leave as is',
    'variants.apply': 'Change',
    'variants.open': 'Variants',
    'variants.honesty': 'the rate is the same in all three — that is locked by a test. What a tourbillon buys in a real watch (averaging the balanceʼs positional error) is not reproduced here: only its cost is.',
    'variants.lever.desc': 'The escape wheel sits directly on the escape arbor; fork and balance beside it on the plate. The wheel turns by exactly the drive angle.',
    'variants.tourbillon.desc': 'The whole escapement inside a cage that itself turns around a fixed wheel. The escape wheel rides the cage, so it turns both with it and relative to it — twice as fast.',
    'variants.doubleAxis.desc': 'A cage within a cage: a second axis at an angle to the first. Not built yet.',
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
    'app.subtitle': 'watch movement explorer',
    'mode.lesson': 'Explore',
    'mode.free': 'Free mode',
    'mode.showcase': 'Escapement model',
    'mode.back': '← Explore',
    // ── showcase: motion controls ──
    'show.play': 'Play',
    'show.pause': 'Pause',
    'show.step': 'Step',
    'show.home': 'Home view',
    'show.exag': 'lock and drop shown at',
    'show.speed': 'Speed',
    'show.phase.lock': 'Locked',
    'show.phase.unlock': 'Unlock',
    'show.phase.impulse': 'Impulse',
    'show.phase.drop': 'Drop',
    'show.pallet.entry': 'entry pallet',
    'show.pallet.exit': 'exit pallet',
    'rail.title': 'The energy chain',
    'rail.subtitle': 'Six stops: from your finger on the crown to the angle of a hand.',
    'rail.collected': 'COLLECTED SO FAR',
    'rail.more': '+ %n earlier',
    'rail.empty': 'Empty — this is the first stop. Each one leaves a sentence behind, and together they add up to a description of the going.',
    'card.station': 'STATION %n OF 6',
    'card.soon': 'Card content lands in the next phase: the key idea, a formula with live numbers, and one control to turn.',
    'card.start': 'start',
    'card.resume': 'Some stops are already behind you — the rail on the left holds their sentences. From here you can begin again or return to any of them.',
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

// The lesson's copy lives separately (`lesson/content.js`) — the chrome stays here.
for (const l of Object.keys(DICT)) Object.assign(DICT[l], CONTENT[l]);

export const LANGS = Object.keys(DICT);
const listeners = new Set();
let lang = 'ua';

/** Translate a key; an unknown key comes back as itself — so a gap is visible. */
export function t(key) {
  return DICT[lang][key] ?? DICT.ua[key] ?? key;
}

/** Translate with a number substituted for `%n`. */
export const tn = (key, n) => t(key).replace('%n', String(n));

/** Translate with `%1`, `%2`, … substituted — every occurrence of each. */
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

/** Subscribe to a language change; returns the unsubscribe function. */
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** For the tests: the key sets must match across the languages. */
export const dictKeys = (l) => Object.keys(DICT[l]);
