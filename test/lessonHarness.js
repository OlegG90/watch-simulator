/**
 * The rig for testing the Explore layer in jsdom.
 *
 * The grid comes from the REAL `index.html`: markup and code should part ways in a test
 * rather than in the browser. The movement and the highlighter are real too — only the
 * camera (a camera flight has nothing to fly without a renderer) and time are faked.
 *
 * Not a `*.test.js`, so vitest does not collect it as a suite.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { buildMovement } from '../src/movement.js';
import { createHighlighter } from '../src/lesson/highlight.js';
import { mountLesson } from '../src/lesson/panel.js';
import { setLang } from '../src/i18n.js';
import { createSettings } from '../src/settings.js';

/** The body of `index.html` without its script — the same grid as in the app. */
export function mountStage() {
  // A path from the project root rather than from `import.meta.url`: in a jsdom
  // environment modules have http addresses, and `new URL(...)` there is not a file one.
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  document.body.innerHTML = body;
}

/**
 * Mount the lesson over the real movement.
 *
 * @returns `{ lesson, cam, params, movement, ui }` — `cam` collects where the camera was
 *          asked to fly: a flight is an event, and must be tested as an event rather than
 *          as state.
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
    // The camera is faked — there is nothing to fly without a renderer — but with the
    // same interface: it takes its points from the movement, and an unknown id throws.
    camera: {
      targets: () => movement.focusPoints.filter((f) => f.preset)
        .map(({ id, nameKey }) => ({ id, nameKey })),
      goto: (id) => {
        if (!movement.focusPoints.some((f) => f.id === id)) throw new Error(`unknown focus point: ${id}`);
        cam.calls.push(id);
        cam.key = id;
      },
      overview: () => { cam.calls.push('overview'); cam.key = null; },
      get current() { return cam.key; },
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
 * A snapshot of everything visible: the shell's classes, the markup of every region, how
 * many meshes the highlighter dimmed and where the camera was asked to go. The three
 * things that make up «the state of the screen» in one string — so that rebuilding the
 * render can be proven by comparison rather than believed.
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
