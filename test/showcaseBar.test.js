// @vitest-environment jsdom
/**
 * The showcase bar's phase caption — through its own interface.
 *
 * The caption names two things (the phase and the active pallet), and both
 * change length as the mechanism runs («Drop» against «Impulse», entry against
 * exit). In a single centered span every change moved both names, so each now
 * has its own fixed cell: this suite mounts the real bar and checks that each
 * cell shows only its own name and updates independently of the other.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mountShowcaseBar } from '../src/showcase/bar.js';
import { stages } from '../src/showcase/motion.js';
import { t, setLang } from '../src/i18n.js';

function mount(state, opts) {
  const root = document.createElement('div');
  document.body.append(root);
  const bar = mountShowcaseBar(root, state, opts);
  return { bar, root, name: root.querySelector('.ph-name'), pal: root.querySelector('.ph-pal') };
}

const button = (root, key) => [...root.querySelectorAll('button')]
  .find((b) => b.textContent === t(key));

describe('showcase bar caption (jsdom)', () => {
  beforeEach(() => { document.body.innerHTML = ''; setLang('en'); });

  it('names the phase and the pallet in their own cells', () => {
    const state = { t: 2.5, playing: true, speed: 1 };
    const { bar, name, pal } = mount(state);
    bar.update();
    expect(name.textContent).toBe(t('show.phase.lock'));
    // Between beats the stone named is the one HOLDING the lock — the one the next beat
    // will escape on, because it caught the tooth at the last drop.
    expect(pal.textContent).toBe(t('show.pallet.exit'));
  });

  it('a phase change moves only the phase cell, a pallet change only the pallet cell', () => {
    const state = { t: 2.5, playing: true, speed: 1 };
    const { bar, name, pal } = mount(state);
    bar.update();
    // The stages are solved now, not cut out of a window, so the instants come from the
    // model itself rather than from a number picked to be inside one.
    const at = (phase) => stages().find((m) => m.phase === phase).at + 2.5;
    state.t = at('unlock');
    bar.update();
    expect(name.textContent).toBe(t('show.phase.unlock'));
    expect(pal.textContent).toBe(t('show.pallet.exit'));
    // A lock on the other pallet: the phase name returns, the pallet flips.
    state.t = 3.5;
    bar.update();
    expect(name.textContent).toBe(t('show.phase.lock'));
    expect(pal.textContent).toBe(t('show.pallet.entry'));
  });

  it('the home button reports the press, and is named in both languages', () => {
    // Showcase mode has no camera presets: without this button one orbit leaves the
    // exhibit off-screen with no way back (issue #39). The bar knows nothing of cameras.
    let pressed = 0;
    const { root } = mount({ t: 2.5, playing: true, speed: 1 }, { onHome: () => { pressed += 1; } });
    const home = button(root, 'show.home');
    expect(home, 'no button carries the home label').toBeTruthy();
    home.click();
    expect(pressed).toBe(1);
    setLang('ua');
    expect(home.textContent).toBe(t('show.home'));
  });

  it('a press of Step advances the state to the next stage', () => {
    const state = { t: 2.9, playing: false, speed: 1 };
    const { bar, root } = mount(state);
    button(root, 'show.step').click();
    bar.update();
    expect(root.querySelector('.ph-name').textContent).toBe(t('show.phase.unlock'));
  });

  it('the bar mounts without an onHome and the press is harmless', () => {
    const { root } = mount({ t: 2.5, playing: true, speed: 1 });
    expect(() => button(root, 'show.home').click()).not.toThrow();
  });

  it('both cells render in Ukrainian too', () => {
    setLang('ua');
    const state = { t: 3, playing: false, speed: 1 };
    const { bar, name, pal } = mount(state);
    bar.update();
    expect(name.textContent).toBe(t('show.phase.impulse'));
    // The exit stone: u = 3 is mid-impulse on the one unlocked at the 2.5 lock, and the
    // pallets change hands at the drop that follows, not at the beat.
    expect(pal.textContent).toBe(t('show.pallet.exit'));
  });
});
