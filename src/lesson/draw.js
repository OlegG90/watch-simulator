/**
 * Small drawing toolkit shared by the three diagrams of the Explore layer:
 * the developed section, the silhouettes in the variants modal, and the chain in
 * the footer.
 *
 * Only what is genuinely the same lives here. The diagrams themselves stay their
 * own: they are three different drawings, and collapsing them into one would move
 * the complexity around rather than remove it.
 */

const SVG = 'http://www.w3.org/2000/svg';

/** An HTML element with a class and text. */
export const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/** An SVG element with attributes. */
export const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};

/**
 * Linear mapping: a movement quantity → a pixel.
 *
 * `from` lands exactly on `at`, then everything scales by `k`. For the vertical
 * axis `k` is taken negative — in SVG the Y axis points down, while the heights of
 * the movement grow upwards.
 *
 * It is shared precisely because the promise the modal's silhouettes make («all
 * three at one scale, so comparing heights is honest») rests on all of them being
 * projected by one function with one set of numbers.
 */
export const linear = ({ from, at, k }) => (v) => at + (v - from) * k;
