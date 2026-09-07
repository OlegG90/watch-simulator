/**
 * Оснастка для перевірок шару дослідження в jsdom.
 *
 * Сітка береться зі СПРАВЖНЬОГО `index.html`: розмітка й код мають розходитися
 * в тесті, а не в браузері. Механізм і підсвітка теж справжні — підроблені
 * тільки камера (політ камери не має чим летіти без рендерера) і час.
 *
 * Не `*.test.js`, тож vitest її не збирає як набір.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { buildMovement } from '../src/movement.js';
import { createHighlighter } from '../src/lesson/highlight.js';
import { mountLesson } from '../src/lesson/panel.js';
import { setLang } from '../src/i18n.js';
import { createSettings } from '../src/settings.js';

/** Тіло `index.html` без скрипта — та сама сітка, що й у застосунку. */
export function mountStage() {
  // Шлях від кореня проєкту, а не від `import.meta.url`: у середовищі jsdom
  // модулі мають http-адреси, і `new URL(...)` там не файловий.
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  document.body.innerHTML = body;
}

/**
 * Підняти урок над справжнім механізмом.
 *
 * @returns `{ lesson, cam, params, movement, ui }` — `cam` збирає, куди
 *          просили летіти камеру: політ це подія, і перевіряти його треба як
 *          подію, а не як стан.
 */
export function mountTestLesson({ lang = 'ua' } = {}) {
  setLang(lang);
  mountStage();

  const mat = () => new THREE.MeshStandardMaterial();
  const movement = buildMovement({
    brass: mat(), steel: mat(), axleMat: mat(), ruby: mat(),
    plateMat: mat(), bluedMat: mat(), springSteel: mat(),
  });
  const highlighter = createHighlighter(movement.root);

  const settings = createSettings();
  const params = settings.values;
  const statusOut = { real: false, speed: 1, charge: 0.75, time: 0 };
  const cam = { calls: [], key: null };

  const lesson = mountLesson({
    highlighter,
    camera: {
      presets: [['cam.overview', () => cam.calls.push('overview')],
                ['part.balance', () => cam.calls.push('part.balance')]],
      overview: () => { cam.calls.push('overview'); cam.key = null; },
      toKey: (key) => { cam.calls.push(key); cam.key = key; },
    },
    status: () => {
      statusOut.speed = params.speed;
      statusOut.real = params.timeMode === 'real';
      return statusOut;
    },
    onMode: () => {},
    settings,
    run: (action) => cam.calls.push(`run:${action}`),
    escapement: movement.escapement,
    planned: ['doubleAxis'],
  });

  return { lesson, cam, settings, params, statusOut, movement, highlighter, ui: document.getElementById('ui') };
}

/**
 * Знімок усього, що видно: класи оболонки, розмітка кожної області, скільки
 * мешів приглушено підсвіткою і куди просили камеру. Три речі, що складають
 * «стан екрана», в одному рядку — щоб перебудову рендеру можна було довести
 * порівнянням, а не вірою.
 */
export function domSnapshot(scene = {}) {
  const ui = document.getElementById('ui');
  const part = (id) => `<<${id} hidden=${document.getElementById(id).hidden}>>\n${document.getElementById(id).innerHTML}`;
  return [
    `ui.class=${ui.className}`,
    `dim=${scene.highlighter ? scene.highlighter.dimCount() : '-'} cam=${scene.cam ? scene.cam.calls.join(',') : '-'}`,
    ...['hdr', 'rail', 'card', 'chain', 'finish', 'section', 'stage-chrome', 'variants', 'hint'].map(part),
  ].join('\n');
}
