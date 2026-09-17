import * as THREE from 'three';
import { clamp, smooth, demoMask, makeRelief } from './relief.mjs';
import { mountInteraction } from './interaction.mjs';

const $ = id => document.getElementById(id);
let controls;

const N = 257, SEG = N - 1, HALF = 1.12, FRONT = .13, BACK = -.15;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setClearColor(0x172122);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('gl').appendChild(renderer.domElement);
renderer.domElement.addEventListener('webglcontextlost', event => {
  event.preventDefault(); controls?.stop();
  $('headline').textContent='立體畫面暫時中斷'; $('message').textContent='請重新載入頁面，再開始體驗。';
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

let field = makeRelief(demoMask(N), N), amount = -1;
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
setDepth(0);
controls=mountInteraction({
  setMask(mask){field=makeRelief(mask,N);amount=-1;setDepth(0);},
  setDepth,getDepth:()=>amount
});
function tick(now){
  requestAnimationFrame(tick);
  controls.tick(now);
  if(!document.hidden)renderer.render(scene,camera);
}
requestAnimationFrame(tick);
if('serviceWorker' in navigator && isSecureContext)
  navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Offline cache unavailable',e));
