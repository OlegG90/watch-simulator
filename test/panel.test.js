// @vitest-environment jsdom
/**
 * Панель уроку — через її власний інтерфейс.
 *
 * Досі набір перевіряв усе НАВКОЛО панелі (`STATIONS`, `readouts()`,
 * `lineText()`), а найбільший файл проєкту не виконувався в жодному тесті.
 * Помилки ж жили не в чистих функціях, а в тому, як їх кличуть.
 *
 * Тут піднімається справжня панель над справжнім механізмом, і перевіряється
 * те, що видно: рейка, картка, ланцюг і розріз мають говорити одне й те саме.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mountTestLesson } from './lessonHarness.js';
import { STATIONS } from '../src/lesson/stations.js';
import { t, setLang } from '../src/i18n.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const btn = (sel, text) => $$(`${sel} button`).find((b) => b.textContent.includes(text));

/** Що зараз показує кожна область — одним об'єктом, щоб звіряти їх між собою. */
function screen() {
  const railCurrent = $$('#rail .stop').findIndex((b) => b.getAttribute('aria-current') === 'true');
  const chainActive = $$('#chain rect')
    .map((r, i) => [i, r.getAttribute('fill')])
    .filter(([, fill]) => fill === '#caa84a').length;
  return {
    railCurrent,
    cardTitle: $('#card .card-title')?.textContent ?? null,
    chainActive,
    finishVisible: $('#ui').classList.contains('mode-finish'),
    sectionHidden: $('#section').hidden,
    ui: $('#ui').className,
  };
}

describe('панель уроку (jsdom)', () => {
  beforeEach(() => { setLang('ua'); });

  it('відкривається стартовим екраном, і назад із нього нікуди', () => {
    mountTestLesson();
    expect($('#card .eyebrow').textContent).toBe(t('card.start').toUpperCase());
    expect($('#card .placeholder').textContent).toBe(t('rail.empty'));
    // Порожня рейка: жодна станція ще не поточна.
    expect(screen().railCurrent).toBe(-1);
    // «Назад» на старті вимкнена — і лишається такою на першій станції (#26).
    expect($$('#card .nav button')[0].disabled).toBe(true);
  });

  it('одна дія — один екран: рейка, картка й ланцюг згодні між собою', () => {
    const { lesson } = mountTestLesson();
    for (let i = 0; i < STATIONS.length; i++) {
      lesson.go(i);
      const s = screen();
      expect(s.railCurrent).toBe(i);
      expect(s.cardTitle).toBe(t(STATIONS[i].nameKey));
      // Ланцюг підсвічує рівно одну коробку — ту, де зараз станція.
      expect(s.chainActive).toBe(1);
    }
  });

  it('кожна станція наводить камеру на СВІЙ вузол', () => {
    // Тут і була вада: половина станцій називала точку, якої не було в списку
    // пресетів камери, і переліт мовчки підмінявся загальним видом — картка
    // казала «Заведення», а камера показувала весь механізм.
    const { lesson, cam } = mountTestLesson();
    for (let i = 0; i < STATIONS.length; i++) {
      lesson.go(i);
      expect(cam.calls.at(-1), `станція ${STATIONS[i].id}`).toBe(STATIONS[i].focus ?? 'overview');
    }
  });

  it('хром позначає той вид, на якому камера справді стоїть', () => {
    const { lesson, cam } = mountTestLesson();
    const pressed = () => $$('#stage-chrome .cams button')
      .find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent ?? null;

    lesson.go(3);                                  // спуск — є серед пресетів
    expect(cam.key).toBe('escapement');
    expect(pressed()).toBe(t('part.escapement'));

    lesson.go(2);                                  // колісна передача — загальний вид
    expect(pressed()).toBe(t('cam.overview'));

    lesson.go(0);                                  // заведення — пресета немає…
    expect(cam.key).toBe('part.winding');          // …але камера все одно там
    expect(pressed(), 'жодна кнопка не бреше').toBe(null);
  });

  it('кожна пройдена станція лишає по реченню в рейці', () => {
    const { lesson } = mountTestLesson();
    expect($('#rail .collected p').textContent).toBe(t('rail.empty'));
    lesson.go(0); lesson.go(1); lesson.go(2);
    expect($$('#rail .bars i.on, #rail .bars i.now')).toHaveLength(3);
    expect($('#rail .collected p').textContent).toContain(t('st.train.line'));
  });

  it('заміна модуля спуску перемальовує і картку, і розріз', () => {
    const { lesson, cam, movement } = mountTestLesson();
    lesson.go(3);
    btn('#card', t('variants.open')).click();
    expect($('#variants').hidden).toBe(false);

    const rows = $$('#variants .v-row');
    rows[1].click();                                  // турбійон
    btn('#variants', t('variants.apply')).click();

    expect(movement.escapement.installed).toBe('tourbillon');
    expect($('#variants').hidden).toBe(true);
    // Камера ведеться до гнізда — це подія, а не стан, тож і перевіряємо як подію.
    expect(cam.calls.at(-1)).toBe('escapement');
    // Розріз мусить піти за встановленим варіантом, а не лишитися старим.
    btn('#stage-chrome', t('view.side')).click();
    expect($('#section').hidden).toBe(false);
    expect($('#section').innerHTML).not.toBe('');
  });

  it('останній крок веде на підсумок, а «ще раз» повертає на першу станцію', () => {
    const { lesson } = mountTestLesson();
    lesson.go(STATIONS.length - 1);
    btn('#card', t('card.summary')).click();

    const fin = screen();
    expect(fin.finishVisible).toBe(true);
    expect(fin.sectionHidden).toBe(true);
    // Шість зібраних речень — по одному на станцію.
    expect($$('#finish .line')).toHaveLength(STATIONS.length);

    btn('#finish', t('finish.again')).click();
    const after = screen();
    expect(after.finishVisible).toBe(false);
    expect(after.railCurrent).toBe(0);
    // Пройдене скинуто: лишилася сама перша станція.
    expect($$('#rail .bars i.on, #rail .bars i.now')).toHaveLength(1);
  });

  it('вільний режим і назад не втрачають станцію', () => {
    const { lesson } = mountTestLesson();
    lesson.go(2);
    lesson.setMode('free');
    expect($('#ui').classList.contains('mode-free')).toBe(true);
    expect($('#to-lesson').hidden).toBe(false);

    lesson.setMode('lesson');
    expect(screen().railCurrent).toBe(2);
    expect(screen().cardTitle).toBe(t(STATIONS[2].nameKey));
  });

  it('перемикання мови перемальовує весь екран', () => {
    const { lesson } = mountTestLesson();
    lesson.go(1);
    $$('#hdr .seg.lang button')[1].click();   // EN
    expect(screen().cardTitle).toBe(t(STATIONS[1].nameKey));
    // Жодної кирилиці не лишилося ні в рейці, ні в картці, ні в ланцюзі.
    // Виняток — зелена позначка: вона цитує НАЗВУ реального тесту з набору, а
    // назва тесту це ідентифікатор, не текст інтерфейсу. Перекласти її означало
    // б розірвати звʼязок, який мета-тест і перевіряє.
    for (const id of ['rail', 'card', 'chain']) {
      const node = document.getElementById(id).cloneNode(true);
      node.querySelectorAll('.marker.ok i').forEach((n) => n.remove());
      expect(node.textContent).not.toMatch(/[а-яіїєґ]/i);
    }
    setLang('ua');
  });

  it('update() оновлює числа, не перебудовуючи картку', () => {
    const { lesson, statusOut } = mountTestLesson();
    lesson.go(4);
    const card = $('#card');
    const before = card.firstChild;
    statusOut.time = 125;
    statusOut.charge = 0.5;
    lesson.update();
    // Той самий вузол: перемальовка щокадру вибила б повзунок з-під курсора.
    expect(card.firstChild).toBe(before);
    expect($('#chain .clock b').textContent).toBe('02:05');
  });

  it('розріз показується лише збоку, лише в уроці й не на підсумку', () => {
    const { lesson } = mountTestLesson();
    lesson.go(0);
    expect($('#section').hidden).toBe(true);

    btn('#stage-chrome', t('view.side')).click();
    expect($('#section').hidden).toBe(false);
    expect($('#hint').hidden).toBe(true);

    lesson.setMode('free');
    expect($('#section').hidden).toBe(true);

    lesson.setMode('lesson');
    expect($('#section').hidden).toBe(false);
    lesson.go(STATIONS.length - 1);
    btn('#card', t('card.summary')).click();
    expect($('#section').hidden).toBe(true);
  });

  it('підсвітка йде за станцією і гасне поза уроком', () => {
    const { lesson, highlighter } = mountTestLesson();
    expect(highlighter.dimCount()).toBe(0);   // старт — усе в повну силу

    lesson.go(0);
    expect(highlighter.dimCount()).toBeGreaterThan(0);

    lesson.setMode('free');
    expect(highlighter.dimCount()).toBe(0);   // вільний режим нічого не глушить

    lesson.setMode('lesson');
    expect(highlighter.dimCount()).toBeGreaterThan(0);

    lesson.go(STATIONS.length - 1);
    btn('#card', t('card.summary')).click();
    expect(highlighter.dimCount()).toBe(0);   // підсумок показує механізм цілком
  });
});
