import { t, onLangChange } from '../i18n.js';
import { phaseName, activePallet } from './motion.js';

/**
 * Панель керування вітриною — живе в сцені (`#showcase-bar`), бо в режимі
 * вітрини CSS ховає все крім сцени. Рядки лише через `t()`: паритет мов
 * тестований, як і в уроці.
 *
 * Панель не володіє часом: вона пише в переданий стан `{ t, playing, speed }`
 * (одиниця `t` — удар), а накопичує його цикл у `main.js`. Крок — це ручне
 * просування на ⅛ удару: посередині вікна перекидання видно зрив.
 */
export function mountShowcaseBar(root, state) {
  const play = document.createElement('button');
  const step = document.createElement('button');
  const speedLabel = document.createElement('label');
  const speed = document.createElement('input');
  speed.type = 'range';
  speed.min = '0.1';
  speed.max = '2';
  speed.step = '0.05';
  speed.value = String(state.speed);
  const phase = document.createElement('span');
  phase.className = 'phase';

  speedLabel.append(document.createTextNode(''), speed);

  play.addEventListener('click', () => {
    state.playing = !state.playing;
    paint();
  });
  step.addEventListener('click', () => { state.t += 0.125; paint(); });
  speed.addEventListener('input', () => { state.speed = Number(speed.value); });

  function paint() {
    play.textContent = t(state.playing ? 'show.pause' : 'show.play');
    step.textContent = t('show.step');
    speedLabel.firstChild.nodeValue = `${t('show.speed')} `;
  }

  let lastPhase = '';
  /** Підпис фази — з циклу рендеру, але текст чіпаємо лише на зміні. */
  function update() {
    const key = `${phaseName(state.t)}.${activePallet(state.t)}`;
    if (key === lastPhase) return;
    lastPhase = key;
    const [ph, pal] = key.split('.');
    phase.textContent = `${t(`show.phase.${ph}`)} · ${t(`show.pallet.${pal}`)}`;
  }

  root.append(play, step, speedLabel, phase);
  paint();
  update();
  onLangChange(() => { paint(); lastPhase = ''; update(); });

  return { update };
}
