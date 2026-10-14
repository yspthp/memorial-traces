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
export function distance(mask, w, h, inside = true, b = null) {
  const d = new Float32Array(w * h);
  const inf = w + h;
  const x0 = b ? Math.max(0, b.x0 - 8) : 0, x1 = b ? Math.min(w - 1, b.x1 + 8) : w - 1;
  const y0 = b ? Math.max(0, b.y0 - 8) : 0, y1 = b ? Math.min(h - 1, b.y1 + 8) : h - 1;
  for (let y = y0; y <= y1; y++) {
    const row = y * w;
    for (let x = x0; x <= x1; x++) {
      const i = row + x;
      d[i] = (mask[i] > .5) === inside ? inf : 0;
    }
  }
  const SQRT2 = Math.SQRT2;
  for (let y = y0; y <= y1; y++) {
    const row = y * w;
    for (let x = x0; x <= x1; x++) {
      const i = row + x;
      let v = d[i];
      if (v === 0) continue;
      if (x > x0 && d[i - 1] + 1 < v) v = d[i - 1] + 1;
      if (y > y0) {
        if (d[i - w] + 1 < v) v = d[i - w] + 1;
        if (x > x0 && d[i - w - 1] + SQRT2 < v) v = d[i - w - 1] + SQRT2;
        if (x < x1 && d[i - w + 1] + SQRT2 < v) v = d[i - w + 1] + SQRT2;
      }
      d[i] = v;
    }
  }
  for (let y = y1; y >= y0; y--) {
    const row = y * w;
    for (let x = x1; x >= x0; x--) {
      const i = row + x;
      let v = d[i];
      if (v === 0) continue;
      if (x < x1 && d[i + 1] + 1 < v) v = d[i + 1] + 1;
      if (y < y1) {
        if (d[i + w] + 1 < v) v = d[i + w] + 1;
        if (x < x1 && d[i + w + 1] + SQRT2 < v) v = d[i + w + 1] + SQRT2;
        if (x > x0 && d[i + w - 1] + SQRT2 < v) v = d[i + w - 1] + SQRT2;
      }
      d[i] = v;
    }
  }
  return d;
}
function segment(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}
function segmentSq(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
  const rx = x - ax - t * dx, ry = y - ay - t * dy;
  return rx * rx + ry * ry;
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
const flatCreases = [];
for (const path of creases) for (let k = 1; k < path.length; k++)
  flatCreases.push([path[k - 1][0], path[k - 1][1], path[k][0], path[k][1]]);

export function makeRelief(mask, size, pressure = null) {
  const field = new Float32Array(size * size), b = bounds(mask, size, size);
  if (!b) return field;
  const di = distance(mask, size, size, true, b), dout = distance(mask, size, size, false, b);
  const gaussian = (u, v, x, y, rx, ry) => Math.exp(-(((u - x) / rx) ** 2 + ((v - y) / ry) ** 2));
  const yMin = Math.max(1, b.y0 - 7), yMax = Math.min(size - 2, b.y1 + 7);
  const xMin = Math.max(1, b.x0 - 7), xMax = Math.min(size - 2, b.x1 + 7);
  const hasPressure = pressure !== null && typeof pressure === 'object';
  const ph = hasPressure ? (pressure.phase ?? 0) * .001 : 0;
  for (let y = yMin; y <= yMax; y++) for (let x = xMin; x <= xMax; x++) {
    const i = y * size + x;
    if (!mask[i] && dout[i] > 6) continue;
    const u = (x - b.x0) / b.width, v = (y - b.y0) / b.height;
    const edge = smooth(0, 5.5 * size / 257, di[i]);
    let depth = .044 + .025 * (1 - Math.exp(-di[i] / (7 * size / 257))) + .043 * gaussian(u, v, .34, .78, .20, .22)
      + .027 * gaussian(u, v, .66, .83, .17, .18) - .018 * gaussian(u, v, .53, .66, .16, .16);
    let rimMul = 1;
    if (hasPressure) {
      // Uneven, shifting real-time pressure across fingertips, knuckles, and palm mounds
      const tipPress = v < .48 ? (.42 + .28 * Math.sin(ph * 2.7 + u * 6.4)) * Math.exp(-(((v - .22) / .19) ** 2)) : 0;
      const palmWave = .34 * Math.sin(ph * 2.2 + u * 4.8 - v * 3.6) + .20 * Math.cos(ph * 3.5 - u * 5.4 + v * 4.2);
      const hollow = -.36 * gaussian(u, v, .50, .66, .18, .17);
      const localMul = clamp(1 + tipPress + palmWave + hollow, .30, 1.55);
      depth *= localMul;
      rimMul = .7 + .3 * localMul;
    }
    let lineSq = 1;
    for (let s = 0; s < flatCreases.length; s++) {
      const c = flatCreases[s];
      const dSq = segmentSq(u, v, c[0], c[1], c[2], c[3]);
      if (dSq < lineSq) lineSq = dSq;
    }
    // Transverse folds are restricted to the fingers, never drawn over empty plaster.
    const s14 = .018 * Math.sin(u * 14);
    const folds = v < .49 ? .0035 * (
      Math.exp(-(((v - .20 + s14) / .006) ** 2)) +
      Math.exp(-(((v - .36 + s14) / .006) ** 2)) +
      Math.exp(-(((v - .48 + s14) / .006) ** 2))
    ) : 0;
    const detail = .007 * Math.exp(-(lineSq / (.008 * .008))) + folds;
    const irregularity = Math.sin(x * .83 + Math.sin(y * .37)) * Math.sin(y * .65 + x * .13);
    const rim = .010 * rimMul * Math.exp(-(((di[i] + dout[i]) / (2.4 * size / 257)) ** 2)) * (.8 + .2 * irregularity);
    field[i] = -depth * edge + detail * edge + rim + .0003 * irregularity * edge;
  }
  // A small geometric filter removes pixel stair-steps, without enlarging the mask.
  const source = field.slice();
  for (let y = yMin; y <= yMax; y++) for (let x = xMin; x <= xMax; x++) {
    const i = y * size + x;
    field[i] = (source[i] * 4 + (source[i - 1] + source[i + 1] + source[i - size] + source[i + size]) * 2
      + source[i - size - 1] + source[i - size + 1] + source[i + size - 1] + source[i + size + 1]) / 16;
  }
  return field;
}
