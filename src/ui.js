import * as THREE from 'three';
import { t } from './i18n.js';

/** Sprite label: text on a canvas, always facing the camera, drawn over the geometry. */
function makeLabel(text) {
  const font = '600 30px system-ui, sans-serif';
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const tw = Math.ceil(measure.measureText(text).width);
  const pad = 12, h = 46;

  const canvas = document.createElement('canvas');
  canvas.width = tw + pad * 2;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(12, 14, 18, 0.6)';
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, h, 10);
  ctx.fill();
  ctx.font = font;
  ctx.fillStyle = '#e8eaf0';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, pad, h / 2 + 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  );
  sprite.renderOrder = 10;
  const sh = 1.5;
  sprite.scale.set((sh * canvas.width) / h, sh, 1);
  return sprite;
}

/** Group of labels above the focus points (coordinates local to the movement root). */
export function buildLabels(focusPoints) {
  const group = new THREE.Group();
  for (const fp of focusPoints) {
    const label = makeLabel(t(fp.nameKey));
    label.position.set(fp.pos.x, fp.pos.y + fp.r + 1.4, fp.z + 1.2);
    group.add(label);
  }
  return group;
}

/** Smooth camera flight: create it, then call update() in the loop. */
/**
 * What the camera owes a change of mode.
 *
 * Only one transition owes anything: LEAVING the escapement model. The exhibit flies the
 * camera in close and switches off the frame fitting that would otherwise pull it back —
 * and both of those outlive the mode unless something answers them. Left unanswered, the
 * movement returns inside a camera framed for a lever escapement that is no longer on
 * screen, and the fitting stays off for the rest of the session.
 *
 * A rule rather than a line inside the mode switch, because this is the kind of thing that
 * regresses in silence: nothing looks wrong in the code that forgets it.
 */
export const cameraOnMode = (from, to) =>
  (from === 'showcase' && to !== 'showcase' ? 'overview' : null);

export function createCameraFly(camera, controls) {
  let anim = null;
  const smooth = (k) => k * k * (3 - 2 * k);

  function flyTo(pos, target, dur = 0.9) {
    anim = {
      p0: camera.position.clone(),
      t0: controls.target.clone(),
      p1: pos.clone(),
      t1: target.clone(),
      start: performance.now(),
      dur: dur * 1000,
    };
  }

  function update() {
    if (!anim) return;
    const k = Math.min(1, (performance.now() - anim.start) / anim.dur);
    const e = smooth(k);
    camera.position.lerpVectors(anim.p0, anim.p1, e);
    controls.target.lerpVectors(anim.t0, anim.t1, e);
    if (k >= 1) anim = null;
  }

  function cancel() {
    anim = null;
  }

  return { flyTo, update, cancel };
}
