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
import { t, setLang } from '../src/i18n.js';

function mount(state) {
  const root = document.createElement('div');
  document.body.append(root);
  const bar = mountShowcaseBar(root, state);
  return { bar, name: root.querySelector('.ph-name'), pal: root.querySelector('.ph-pal') };
}

describe('showcase bar caption (jsdom)', () => {
  beforeEach(() => { document.body.innerHTML = ''; setLang('en'); });

  it('names the phase and the pallet in their own cells', () => {
    const state = { t: 2.5, playing: true, speed: 1 };
    const { bar, name, pal } = mount(state);
    bar.update();
    expect(name.textContent).toBe(t('show.phase.lock'));
    expect(pal.textContent).toBe(t('show.pallet.entry'));
  });

  it('a phase change moves only the phase cell, a pallet change only the pallet cell', () => {
    const state = { t: 2.5, playing: true, speed: 1 };
    const { bar, name, pal } = mount(state);
    bar.update();
    // 2.9 is inside the unlocking window on the same pallet.
    state.t = 2.9;
    bar.update();
    expect(name.textContent).toBe(t('show.phase.unlock'));
    expect(pal.textContent).toBe(t('show.pallet.entry'));
    // 3.5 is a lock on the other pallet: the phase name returns, the pallet flips.
    state.t = 3.5;
    bar.update();
    expect(name.textContent).toBe(t('show.phase.lock'));
    expect(pal.textContent).toBe(t('show.pallet.exit'));
  });

  it('both cells render in Ukrainian too', () => {
    setLang('ua');
    const state = { t: 3, playing: false, speed: 1 };
    const { bar, name, pal } = mount(state);
    bar.update();
    expect(name.textContent).toBe(t('show.phase.impulse'));
    expect(pal.textContent).toBe(t('show.pallet.exit'));
  });
});
