import { t, onLangChange } from '../i18n.js';
import { phaseName, activePallet } from './motion.js';

/**
 * Showcase control panel — it lives inside the scene (`#showcase-bar`), because in
 * showcase mode CSS hides everything but the scene. Strings go through `t()` only:
 * language parity is tested here as it is in the lesson.
 *
 * The panel does not own time: it writes into the state it was handed
 * (`{ t, playing, speed }`, where `t` counts beats) and the loop in `main.js`
 * advances it. A step is a manual advance of ⅛ of a beat: in the middle of the
 * unlocking window the drop is visible.
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
  // Two fixed cells, not one caption: the phase and the pallet have different
  // lengths («Drop» against «Impulse», entry against exit), and in a single
  // centered span each change moved both names. Left-aligned cells of fixed
  // width keep the first word of each name at the same x.
  const phaseNameEl = document.createElement('span');
  phaseNameEl.className = 'ph-name';
  const phaseSep = document.createElement('span');
  phaseSep.className = 'ph-sep';
  phaseSep.textContent = '·';
  const palletEl = document.createElement('span');
  palletEl.className = 'ph-pal';
  phase.append(phaseNameEl, phaseSep, palletEl);

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
  /** Phase caption — driven from the render loop, but the text is touched only on change. */
  function update() {
    const key = `${phaseName(state.t)}.${activePallet(state.t)}`;
    if (key === lastPhase) return;
    lastPhase = key;
    const [ph, pal] = key.split('.');
    phaseNameEl.textContent = t(`show.phase.${ph}`);
    palletEl.textContent = t(`show.pallet.${pal}`);
  }

  root.append(play, step, speedLabel, phase);
  paint();
  update();
  onLangChange(() => { paint(); lastPhase = ''; update(); });

  return { update };
}
