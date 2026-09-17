// Signed surface offsets in world units. No webcam pixels or biometric data are stored.
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export function bounds(mask, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1, area = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x] > .5) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); area++;
  }
  return area ? { x0, y0, x1, y1, area, width: x1 - x0 + 1, height: y1 - y0 + 1 } : null;
}
// Crop once, centre once, and use ONE scale for both axes.
export function fitMask(mask, w, h, size = 257) {
  const out = new Float32Array(size * size), b = bounds(mask, w, h);
  if (!b) return out;
  const scale = .76 * (size - 1) / Math.max(b.width, b.height);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = Math.round((x - (size - 1) / 2) / scale + (b.x0 + b.x1) / 2);
    const sy = Math.round((y - (size - 1) / 2) / scale + (b.y0 + b.y1) / 2);
    if (sx >= 0 && sx < w && sy >= 0 && sy < h) out[y * size + x] = mask[sy * w + sx];
  }
  return out;
}
export function distance(mask, w, h, inside = true) {
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = (mask[i] > .5) === inside ? w + h : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (x) d[i] = Math.min(d[i], d[i - 1] + 1);
    if (y) d[i] = Math.min(d[i], d[i - w] + 1);
    if (x && y) d[i] = Math.min(d[i], d[i - w - 1] + Math.SQRT2);
    if (x < w - 1 && y) d[i] = Math.min(d[i], d[i - w + 1] + Math.SQRT2);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (x < w - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
    if (y < h - 1) d[i] = Math.min(d[i], d[i + w] + 1);
    if (x < w - 1 && y < h - 1) d[i] = Math.min(d[i], d[i + w + 1] + Math.SQRT2);
    if (x && y < h - 1) d[i] = Math.min(d[i], d[i + w - 1] + Math.SQRT2);
  }
  return d;
}
function segment(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}
export function demoMask(size = 257) {
  const m = new Float32Array(size * size);
  const fingers = [
    [.365, .55, .325, .22, .047], [.48, .51, .48, .135, .05],
    [.59, .53, .625, .22, .047], [.68, .60, .757, .355, .039],
    [.35, .735, .225, .525, .064]
  ];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / (size - 1), v = y / (size - 1);
    const palm = ((u - .505) / .207) ** 2 + ((v - .675) / .225) ** 2 < 1;
    m[y * size + x] = palm || fingers.some(([a, b, c, d, r]) => segment(u, v, a, b, c, d) < r) ? 1 : 0;
  }
  return fitMask(m, size, size, size);
}
// Artistic crease template, not a reconstruction of a participant's palm lines.
const creases = [
  [[.25, .60], [.37, .57], [.52, .59], [.68, .63], [.79, .61]],
  [[.30, .64], [.40, .68], [.50, .74], [.63, .77], [.74, .77]],
  [[.34, .60], [.40, .68], [.42, .78], [.37, .89], [.30, .94]],
  [[.56, .63], [.54, .73], [.58, .83], [.53, .95]]
];
export function makeRelief(mask, size) {
  const field = new Float32Array(size * size), b = bounds(mask, size, size);
  if (!b) return field;
  const di = distance(mask, size, size), dout = distance(mask, size, size, false);
  const gaussian = (u, v, x, y, rx, ry) => Math.exp(-(((u - x) / rx) ** 2 + ((v - y) / ry) ** 2));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    if (!mask[i] && dout[i] > 6) continue;
    const u = (x - b.x0) / b.width, v = (y - b.y0) / b.height;
    const edge = smooth(0, 5.5 * size / 257, di[i]);
    const depth = .044 + .025 * (1 - Math.exp(-di[i] / (7 * size / 257))) + .043 * gaussian(u, v, .34, .78, .20, .22)
      + .027 * gaussian(u, v, .66, .83, .17, .18) - .018 * gaussian(u, v, .53, .66, .16, .16);
    let line = 1;
    for (const path of creases) for (let k = 1; k < path.length; k++)
      line = Math.min(line, segment(u, v, ...path[k - 1], ...path[k]));
    // Transverse folds are restricted to the fingers, never drawn over empty plaster.
    const folds = v < .49 ? [.20, .36, .48].reduce((sum, joint) =>
      sum + .0035 * Math.exp(-(((v - joint + .018 * Math.sin(u * 14)) / .006) ** 2)), 0) : 0;
    const detail = .007 * Math.exp(-((line / .008) ** 2)) + folds;
    const irregularity = Math.sin(x * .83 + Math.sin(y * .37)) * Math.sin(y * .65 + x * .13);
    const rim = .010 * Math.exp(-(((di[i] + dout[i]) / (2.4 * size / 257)) ** 2)) * (.8 + .2 * irregularity);
    field[i] = -depth * edge + detail * edge + rim + .0003 * irregularity * edge;
  }
  // A small geometric filter removes pixel stair-steps, without enlarging the mask.
  const source = field.slice();
  for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
    const i = y * size + x;
    field[i] = (source[i] * 4 + (source[i - 1] + source[i + 1] + source[i - size] + source[i + size]) * 2
      + source[i - size - 1] + source[i - size + 1] + source[i + size - 1] + source[i + size + 1]) / 16;
  }
  return field;
}
