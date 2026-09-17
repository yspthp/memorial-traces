import { bounds } from './relief.mjs';
export const WIDTH = 256, HEIGHT = 192;
// Conservative dark-field segmentation, NOT a trained hand recognizer.
export function segmentFrame(rgba, w = WIDTH, h = HEIGHT) {
  const n = w * h, l = new Float32Array(n), hist = new Uint32Array(128);
  for (let i = 0; i < n; i++) {
    l[i] = (rgba[4 * i] * .299 + rgba[4 * i + 1] * .587 + rgba[4 * i + 2] * .114) / 255;
    hist[Math.min(127, Math.floor(l[i] * 127))]++;
  }
  function percentile(p) { let sum = 0; for (let i = 0; i < 128; i++) { sum += hist[i]; if (sum >= n * p) return i / 127; } return 1; }
  const lo = percentile(.5), span = percentile(.995) - lo;
  const no = { present: false, valid: false, reason: '請在深色背景前張開手掌，手掌朝向鏡頭。' };
  if (span < .13) return no;
  const threshold = lo + .43 * span, seen = new Uint8Array(n), queue = new Int32Array(n);
  let best = [];
  for (let s = 0; s < n; s++) {
    if (seen[s] || l[s] <= threshold) continue;
    let head = 0, tail = 1; queue[0] = s; seen[s] = 1;
    while (head < tail) {
      const i = queue[head++], x = i % w, y = Math.floor(i / w);
      for (const j of [x ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !seen[j] && l[j] > threshold) { seen[j] = 1; queue[tail++] = j; }
      }
    }
    if (tail > best.length) best = queue.slice(0, tail);
  }
  if (best.length < n * .035) return no;
  const mask = new Float32Array(n); for (const i of best) mask[i] = 1;
  const b = bounds(mask, w, h), area = b.area / n;
  // Finger separation heuristic across several rows, in the instructed upright pose.
  let runs = 0;
  for (const fraction of [.24, .32, .40]) {
    const y = Math.floor(b.y0 + b.height * fraction); let count = 0, width = 0;
    for (let x = b.x0; x <= b.x1 + 1; x++) {
      if (x <= b.x1 && mask[y * w + x]) width++;
      else { if (width >= 2) count++; width = 0; }
    }
    runs = Math.max(runs, count);
  }
  const clipped = b.x0 < 3 || b.y0 < 3 || b.x1 > w - 4 || b.y1 > h - 4;
  const valid = !clipped && area < .46 && b.height > h * .34 && runs >= 3 && b.height / b.width > .8 && b.height / b.width < 2.6;
  return { present: true, valid, mask, b, area, runs,
    reason: clipped ? '請退後少少，讓指尖、拇指及掌根完整入鏡。' :
      valid ? '保持不動，正在留下痕跡。' : '請五指向上張開、掌心朝鏡頭；背景保持深色及均勻。' };
}
export function overlap(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let union = 0, intersection = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] || b[i]) union++; if (a[i] && b[i]) intersection++; }
  return union ? intersection / union : 0;
}
export class Capture {
  constructor(canvas) {
    this.canvas = canvas; canvas.width = WIDTH; canvas.height = HEIGHT;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.video = document.createElement('video'); this.video.muted = true; this.video.playsInline = true;
  }
  async start() {
    this.stop();
    const generation = this.generation;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('需要 HTTPS 及支援鏡頭的瀏覽器。');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (generation !== this.generation) {
        stream.getTracks().forEach(t => t.stop());
        throw new DOMException('Camera request cancelled', 'AbortError');
      }
      this.stream = stream;
      this.video.srcObject = this.stream;
      await this.video.play();
    } catch (e) { if (generation === this.generation) this.stop(); throw e; }
  }
  frame() {
    if (this.video.readyState < 2) return null;
    const vw = this.video.videoWidth, vh = this.video.videoHeight;
    const sw = Math.min(vw, vh * WIDTH / HEIGHT), sh = sw * HEIGHT / WIDTH;
    this.ctx.setTransform(-1, 0, 0, 1, WIDTH, 0);
    this.ctx.drawImage(this.video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, WIDTH, HEIGHT);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    const result = segmentFrame(this.ctx.getImageData(0, 0, WIDTH, HEIGHT).data);
    if (result.mask) {
      const image = this.ctx.createImageData(WIDTH, HEIGHT);
      for (let i = 0; i < result.mask.length; i++) {
        const v = result.mask[i] ? 224 : 20;
        image.data[4 * i] = v; image.data[4 * i + 1] = v; image.data[4 * i + 2] = v; image.data[4 * i + 3] = 255;
      }
      this.ctx.putImageData(image, 0, 0);
    }
    return result;
  }
  stop() {
    this.generation = (this.generation || 0) + 1;
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null; this.video.srcObject = null;
    this.ctx.clearRect(0, 0, WIDTH, HEIGHT);
  }
}
