import { t, onLangChange } from '../i18n.js';
import { phaseName, activePallet, stepFrom } from './motion.js';
import { EXAGGERATION } from './design.js';

/**
 * Showcase control panel — it lives inside the scene (`#showcase-bar`), because in
 * showcase mode CSS hides everything but the scene. Strings go through `t()` only:
 * language parity is tested here as it is in the lesson.
 *
 * The panel does not own time: it writes into the state it was handed
 * (`{ t, playing, speed }`, where `t` counts beats) and the loop in `main.js`
 * advances it. A step asks the phase machine for the middle of the next stage
 * (`stepFrom`), so the four stages of a beat are visited one press at a time.
 *
 * `onHome` flies the camera back to the exhibit's home point. The panel does not
 * know what a camera is; it only reports the press.
 */
export function mountShowcaseBar(root, state, { onHome } = {}) {
  const play = document.createElement('button');
  const step = document.createElement('button');
  const home = document.createElement('button');
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
  // The exhibit magnifies two things and says so. A real lock and a real drop are
  // fractions of a degree; at this size they would be nothing at all. The factor is read
  // from the design, so the note cannot drift away from what the geometry does.
  const note = document.createElement('span');
  note.className = 'ph-note';

  speedLabel.append(document.createTextNode(''), speed);

  play.addEventListener('click', () => {
    state.playing = !state.playing;
    paint();
  });
  step.addEventListener('click', () => { state.t = stepFrom(state.t); paint(); });
  home.addEventListener('click', () => onHome?.());
  speed.addEventListener('input', () => { state.speed = Number(speed.value); });

  function paint() {
    play.textContent = t(state.playing ? 'show.pause' : 'show.play');
    step.textContent = t('show.step');
    home.textContent = t('show.home');
    speedLabel.firstChild.nodeValue = `${t('show.speed')} `;
    note.textContent = `${t('show.exag')} ×${EXAGGERATION}`;
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

  root.append(play, step, home, speedLabel, phase, note);
  paint();
  update();
  onLangChange(() => { paint(); lastPhase = ''; update(); });

  return { update };
}
