import * as THREE from 'three';
import { clamp, smooth, fitMask, demoMask, makeRelief } from './relief.mjs';
import { Capture, WIDTH, HEIGHT, overlap } from './capture.mjs';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search), debug = params.get('debug') === '1';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const N = 257, SEG = N - 1, HALF = 1.12, FRONT = .13, BACK = -.15;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setClearColor(0x172122);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('gl').appendChild(renderer.domElement);
renderer.domElement.addEventListener('webglcontextlost', event => {
  event.preventDefault(); capture.stop();
  text('立體畫面暫時中斷', '請重新載入頁面，再開始體驗。');
});
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .1, 35);
scene.fog = new THREE.Fog(0x172122, 10, 23);
scene.add(new THREE.HemisphereLight(0xe5edf1, 0x41443d, 1.15));
const key = new THREE.DirectionalLight(0xffefd5, 3.1);
key.position.set(-3.5, 4.8, 3); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -2.8, right: 2.8, top: 3.2, bottom: -2.8, near: .5, far: 14 });
key.shadow.bias = -.00015; key.shadow.normalBias = .008;
scene.add(key);
const fill = new THREE.DirectionalLight(0xcbdde6, .5); fill.position.set(3, 1, 4); scene.add(fill);

// Subtle, deterministic pores. The hand is geometry, not this bump texture.
const textureCanvas = document.createElement('canvas'); textureCanvas.width = textureCanvas.height = 512;
const tc = textureCanvas.getContext('2d'), image = tc.createImageData(512, 512);
let seed = 713;
for (let i = 0; i < 512 * 512; i++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296, v = r < .018 ? 60 : 170 + r * 28;
  image.data[4 * i] = image.data[4 * i + 1] = image.data[4 * i + 2] = v; image.data[4 * i + 3] = 255;
}
tc.putImageData(image, 0, 0);
const bump = new THREE.CanvasTexture(textureCanvas); bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
const material = new THREE.MeshStandardMaterial({ color: 0xece3d2, roughness: .94, metalness: 0, bumpMap: bump, bumpScale: .004, vertexColors: true });
material.shadowSide = THREE.DoubleSide;
const group = new THREE.Group(); group.rotation.set(-.025, -.14, -.018); scene.add(group);
const geometry = new THREE.PlaneGeometry(HALF * 2, HALF * 2, SEG, SEG);
const pos = geometry.attributes.position, base = new Float32Array(pos.count);
const color = new Float32Array(pos.count * 3); color.fill(1);
geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
// Square-to-rounded-square mapping keeps a complete front surface without an underlying cap.
for (let i = 0; i < pos.count; i++) {
  let x = pos.getX(i), y = pos.getY(i);
  const r = Math.max(Math.abs(x), Math.abs(y)) / HALF, a = HALF - .11;
  if (r > 0) {
    const dx = x / r, dy = y / r;
    if (Math.abs(dx) > a && Math.abs(dy) > a) {
      const vx = Math.abs(dx) - a, vy = Math.abs(dy) - a, f = .11 / Math.hypot(vx, vy);
      x = Math.sign(x) * (a + vx * f) * r; y = Math.sign(y) * (a + vy * f) * r;
    }
  }
  const bevel = .035 * smooth(.943, 1, r);
  base[i] = FRONT - bevel + .0015 * Math.sin(x * 13) * Math.sin(y * 11) * (1 - smooth(.9, 1, r));
  pos.setXYZ(i, x, y, base[i]);
}
const face = new THREE.Mesh(geometry, material); face.castShadow = face.receiveShadow = true; group.add(face);
// Only side wall and back. There is deliberately NO solid front behind the recess.
const boundary = [];
for (let x = 0; x < SEG; x++) boundary.push(x);
for (let y = 0; y < SEG; y++) boundary.push(y * N + SEG);
for (let x = SEG; x > 0; x--) boundary.push(SEG * N + x);
for (let y = SEG; y > 0; y--) boundary.push(y * N);
const sideVertices = [], sideIndices = [];
for (const i of boundary) {
  sideVertices.push(pos.getX(i), pos.getY(i), base[i], pos.getX(i), pos.getY(i), BACK);
}
for (let k = 0; k < boundary.length; k++) {
  const a = k * 2, b = ((k + 1) % boundary.length) * 2;
  sideIndices.push(a, a + 1, b, b, a + 1, b + 1);
}
const wall = new THREE.BufferGeometry();
wall.setAttribute('position', new THREE.Float32BufferAttribute(sideVertices, 3)); wall.setIndex(sideIndices); wall.computeVertexNormals();
const sideMaterial = new THREE.MeshStandardMaterial({ color: 0xe4dbc9, roughness: .97, side: THREE.DoubleSide });
const sides = new THREE.Mesh(wall, sideMaterial); sides.castShadow = sides.receiveShadow = true; group.add(sides);
const backPositions = [0, 0, BACK], backIndices = [];
for (const i of boundary) backPositions.push(pos.getX(i), pos.getY(i), BACK);
for (let i = 0; i < boundary.length; i++) backIndices.push(0, i + 1, (i + 1) % boundary.length + 1);
const backGeometry = new THREE.BufferGeometry();
backGeometry.setAttribute('position', new THREE.Float32BufferAttribute(backPositions, 3));
backGeometry.setIndex(backIndices); backGeometry.computeVertexNormals();
const back = new THREE.Mesh(backGeometry, sideMaterial);
back.castShadow = true; group.add(back);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x273432, roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -1.155; floor.receiveShadow = true; scene.add(floor);
geometry.computeVertexNormals();
function resize() {
  const aspect = innerWidth / innerHeight;
  camera.aspect = aspect;
  const distance = Math.max(5.5, 3.05 / (2 * Math.tan(THREE.MathUtils.degToRad(17)) * aspect));
  camera.position.set(0, .32, distance);
  camera.lookAt(0, -.36, 0); camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize); resize();

const capture = new Capture($('preview'));
let field = makeRelief(demoMask(N), N), amount = -1, target = 0;
let state = 'HOME', entered = performance.now(), lastProcess = 0, lastTick = entered;
let stableSince = null, absentSince = null, previous = null, anchor = null, best = null, bestScore = -1;
let result = null, mode = 'home', cameraEpoch = 0, waitingCamera = false, lastFrameAt = entered;
function text(title, message) {
  if ($('headline').textContent !== title) $('headline').textContent = title;
  if ($('message').textContent !== message) $('message').textContent = message;
}
function enter(next, now = performance.now()) {
  state = next; entered = now; stableSince = null; absentSince = null;
  $('meter').hidden = next !== 'CAPTURE';
  $('bar').style.width = '0%';
  $('preview').hidden = mode !== 'camera' || !['READY', 'CAPTURE', 'REMOVE', 'INVITE'].includes(next);
}
function setDepth(value) {
  if (value === amount) return;
  amount = value;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, base[i] + field[i] * value);
    // Restrained cavity darkening, never orange emission or a rectangular decal.
    const shade = 1 - clamp(-field[i] / .11) * .12 * value;
    color[i * 3] = shade; color[i * 3 + 1] = shade; color[i * 3 + 2] = shade;
  }
  pos.needsUpdate = true; geometry.attributes.color.needsUpdate = true;
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
}
function clearCapture() { previous = anchor = best = result = null; bestScore = -1; stableSince = null; }
function showDemo() {
  cameraEpoch++; capture.stop(); waitingCamera = false; $('camera').disabled = false;
  clearCapture(); mode = 'demo'; field = makeRelief(demoMask(N), N); amount = -1; setDepth(0); target = 1;
  $('mode').textContent = '示範 · 藝術化掌紋'; $('replay').hidden = false;
  enter('DEMO'); text('你一直被看見。', '你的每一個痕跡，在神眼中都是最寶貴的。');
}
async function startCamera() {
  if (waitingCamera) return;
  const epoch = ++cameraEpoch; waitingCamera = true; $('camera').disabled = true; $('replay').hidden = true;
  clearCapture(); target = 0; mode = 'camera'; enter('CONNECT');
  text('讓你的手掌，留下痕跡。', '正在等待鏡頭授權；亦可選擇觀看示範。');
  try {
    await capture.start();
    if (epoch !== cameraEpoch) return;
    $('mode').textContent = '鏡頭體驗 · 本機處理'; lastFrameAt = performance.now();
    enter('READY');
  } catch (e) {
    if (epoch !== cameraEpoch) return;
    mode = 'home'; enter('ERROR');
    text('暫時未能開啟鏡頭。', e.name === 'NotAllowedError' ? '請允許鏡頭權限，或先觀看示範。' : '請檢查鏡頭是否可用；亦可先觀看示範。');
  } finally { if (epoch === cameraEpoch) { waitingCamera = false; $('camera').disabled = false; } }
}
function processInteraction(now, det) {
  const valid = !!det?.valid, present = !!det?.present;
  if (state === 'READY') {
    text('請張開五指，讓痕跡完整。', det?.reason || '等待鏡頭畫面…');
    if (valid) { stableSince ??= now; if (now - stableSince >= 500) { clearCapture(); enter('CAPTURE', now); } }
    else stableSince = null;
  } else if (state === 'CAPTURE') {
    const steady = valid && (!previous || overlap(previous, det.mask) > .90) && (!anchor || overlap(anchor, det.mask) > .85);
    if (steady) {
      stableSince ??= now; anchor ??= det.mask.slice();
      const score = det.runs + det.area;
      if (score > bestScore) { best = det.mask.slice(); bestScore = score; }
      const progress = clamp((now - stableSince) / 3000);
      $('bar').style.width = `${progress * 100}%`;
      text('請將手掌放下。用力一點。', `保持三秒，讓痕跡留下來。${Math.ceil((1 - progress) * 3) || ''}`);
      if (progress >= 1 && best) {
        field = makeRelief(fitMask(best, WIDTH, HEIGHT, N), N); amount = -1; setDepth(0);
        clearCapture(); target = .12; enter('LOSS', now);
      }
    } else {
      stableSince = null; anchor = best = null; bestScore = -1; $('bar').style.width = '0%';
      text('慢慢來，讓手掌停留片刻。', valid ? '手掌剛才移動了，請保持不動三秒。' : det?.reason || '等待鏡頭畫面…');
    }
    previous = valid ? det.mask : null;
    if (now - entered > 20000) { clearCapture(); enter('READY', now); }
  } else if (state === 'REMOVE') {
    text('請先把手掌移開。', '讓這一道淡淡的痕跡，停留片刻。');
    if (!present) { absentSince ??= now; if (now - absentSince > 650) enter('INVITE', now); }
    else absentSince = null;
  } else if (state === 'INVITE') {
    text('現在，再輕輕放上去一次。', '不需要用力。五指張開，掌心朝向鏡頭。');
    if (valid) {
      stableSince ??= now;
      if (now - stableSince > 600) { target = 1; enter('REVEAL', now); }
    } else stableSince = null;
  }
}
$('camera').onclick = startCamera; $('demo').onclick = showDemo;
$('replay').onclick = () => { setDepth(0); target = 1; };
$('fs').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { $('message').textContent = '此瀏覽器未能切換全螢幕；仍可繼續體驗。'; }
};
addEventListener('pagehide', () => { cameraEpoch++; capture.stop(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'camera') {
    cameraEpoch++; capture.stop(); clearCapture(); waitingCamera = false; $('camera').disabled = false;
    mode = 'home'; enter('PAUSED'); text('體驗已暫停。', '鏡頭已關閉。返回後，請按「開始鏡頭體驗」。');
  }
});
$('debug').hidden = !debug;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(50, now - lastTick); lastTick = now;
  if (document.hidden) return;
  if (mode === 'camera' && !waitingCamera && now - lastProcess > 85) {
    lastProcess = now; result = capture.frame();
    if (result) { lastFrameAt = now; processInteraction(now, result); }
    else {
      // A stalled camera must never complete a hold using an old mask.
      clearCapture();
      if (now - lastFrameAt > 4000) {
        capture.stop(); mode = 'home'; enter('ERROR');
        text('鏡頭畫面已中斷。', '請重新開始鏡頭體驗，或觀看示範。');
      }
    }
  }
  if (state === 'LOSS') {
    text('這麼用力，卻只有淡淡的痕跡嗎？', '請慢慢移開手掌。');
    if (now - entered > 4000) enter('REMOVE', now);
  }
  if (state === 'REVEAL') {
    text('你一直被看見。', '你的每一個痕跡，在神眼中都是最寶貴的。');
    if (now - entered > 14000) { target = 0; enter('FADE', now); }
  }
  if (state === 'FADE' && now - entered > 3500) { clearCapture(); enter('READY', now); }
  if (['REMOVE', 'INVITE'].includes(state) && now - entered > 60000) { target = 0; clearCapture(); enter('READY', now); }
  const next = reduced ? target : amount + (target - amount) * (1 - Math.exp(-dt / 650));
  setDepth(Math.abs(next - target) < .001 ? target : next);
  renderer.render(scene, camera);
  if (debug) $('debug').textContent = `${state} | depth ${amount.toFixed(2)} | ${result?.valid ? 'valid silhouette' : 'waiting'} | v2`;
}
setDepth(0); $('camera').disabled = $('demo').disabled = false;
text('每一道痕跡，都值得被留下。', '開始鏡頭體驗，或先觀看石膏掌印示範。');
requestAnimationFrame(tick);
if (params.get('demo') === '1') showDemo();
// Versioned, network-first documents; bypass cache entirely for debug sessions.
if ('serviceWorker' in navigator && isSecureContext)
  navigator.serviceWorker.register('./sw.js').catch(e => console.warn('Offline cache unavailable', e));
