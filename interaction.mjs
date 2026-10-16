import {Capture} from './capture-landmarks.mjs';
import {HoldGate,HOLD_DURATION_MS,captureDepthAt,landmarksToMask} from './hand-shape.mjs';
import {demoMask,bounds} from './relief.mjs';
import {STORYBOARD_COPY,REVEAL_COPY_TIMING,lossCopyAt,revealCopyAt,demoCopy} from './reveal-copy.mjs';

function drawMaskComparison(canvas, mask, { mode = 'effort' } = {}) {
  if (!canvas || !mask) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height, size = Math.round(Math.sqrt(mask.length));
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = mode === 'grace' ? '#1c2625' : '#161f20';
  ctx.fillRect(0, 0, w, h);
  const b = bounds(mask, size, size);
  if (!b) return;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(size - 1, Math.floor((y / h) * size));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(size - 1, Math.floor((x / w) * size));
      const v = mask[sy * size + sx];
      const idx = (y * w + x) * 4;
      if (v > 0.5) {
        if (mode === 'effort') {
          // Faint, faded shallow trace with a hint of residual warmth
          img.data[idx] = 188;
          img.data[idx + 1] = 166;
          img.data[idx + 2] = 158;
          img.data[idx + 3] = 78;
        } else {
          // Deep, crisp, eternal imprint
          img.data[idx] = 242;
          img.data[idx + 1] = 231;
          img.data[idx + 2] = 208;
          img.data[idx + 3] = 235;
        }
      } else {
        img.data[idx] = mode === 'grace' ? 28 : 22;
        img.data[idx + 1] = mode === 'grace' ? 38 : 31;
        img.data[idx + 2] = mode === 'grace' ? 37 : 32;
        img.data[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function mountInteraction({
  setMask,
  setDepth,
  getDepth,
  setEffortTint = () => {},
  getEffortTint = () => 0,
  setPerspective = () => {}
}) {
  const $ = id => document.getElementById(id), params = new URLSearchParams(location.search);
  const debug = params.get('debug') === '1', reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
  let mode = 'home', state = 'HOME', entered = performance.now(), lastTick = entered;
  let target = 0, targetTint = 0, epoch = 0, waiting = false;
  let since = null, absent = null, result = null;
  let lastEffortMask = demoMask(257), lastGraceMask = demoMask(257);

  const hold = new HoldGate(HOLD_DURATION_MS);
  const capture = new Capture($('preview'), () => {
    if (mode === 'camera' && state === 'CONNECT') {
      setCopy(STORYBOARD_COPY.stage1Title, STORYBOARD_COPY.stage1SubtitleHtml, true);
    }
  });

  function setCopy(title, message = '', isHtml = false, scripture = '') {
    const h = $('headline'), m = $('message'), s = $('scripture');
    if (h && h.textContent !== title) h.textContent = title;
    if (m) {
      if (isHtml) {
        if (m.innerHTML !== message) m.innerHTML = message;
      } else if (m.textContent !== message) {
        m.textContent = message;
      }
      m.hidden = !message;
    }
    if (s) {
      if (s.textContent !== scripture) s.textContent = scripture;
      s.hidden = !scripture;
    }
  }

  function updateStageAttributes(next) {
    document.body.dataset.stage = next;
    const isGraceView = ['INVITE', 'REVEAL', 'END', 'REPLAY'].includes(next);
    document.body.classList.toggle('grace-perspective', isGraceView);
    setPerspective(isGraceView ? 'grace' : 'effort');
    const palmGuide = $('palm-guide');
    if (palmGuide) {
      palmGuide.hidden = !(mode === 'camera' && (next === 'READY' || next === 'INVITE'));
      palmGuide.dataset.guideMode = next === 'INVITE' ? 'gentle' : 'effort';
    }
    const veil = $('perspective-veil');
    if (veil) {
      veil.classList.toggle('active', next === 'INVITE');
    }
  }

  function enter(next, now = performance.now()) {
    state = next;
    entered = now;
    since = absent = null;
    hold.reset();
    updateStageAttributes(next);

    $('headline').style.opacity = '1';
    $('message').style.opacity = '1';
    if ($('scripture')) $('scripture').style.opacity = '1';

    $('meter').hidden = next !== 'CAPTURE';
    $('bar').style.width = '0%';
    $('preview-panel').hidden = mode !== 'camera';
    $('stop').hidden = mode !== 'camera';
    // Action Item 2: Never show replay button in demo mode; only show in Stage 5 (END) or REPLAY
    $('replay').hidden = !(next === 'END' || next === 'REPLAY');
    if ($('journey-replay') && next !== 'REPLAY' && next !== 'END') {
      $('journey-replay').hidden = true;
    }
  }

  function stop() {
    epoch++;
    capture.stop();
    waiting = false;
    $('camera').disabled = false;
    mode = 'home';
    result = null;
    target = 0;
    targetTint = 0;
    enter('HOME');
    setCopy(STORYBOARD_COPY.stage1Title, STORYBOARD_COPY.stage1SubtitleHtml, true);
  }

  // Action Item 2 & 3: Demo mode removes replay button and uses strictly spoiler-free instruction
  function demo() {
    epoch++;
    capture.stop();
    waiting = false;
    $('camera').disabled = false;
    mode = 'demo';
    result = null;
    setMask(demoMask(257));
    target = .45;
    targetTint = 0;
    $('mode').textContent = '互動流程演示';
    $('replay').hidden = true;
    enter('DEMO');
    const copy = demoCopy();
    setCopy(copy.title, copy.message);
  }

  async function start() {
    if (waiting) return;
    const token = ++epoch;
    waiting = true;
    mode = 'camera';
    result = null;
    target = 0;
    targetTint = 0;
    $('camera').disabled = true;
    $('replay').hidden = true;
    if ($('journey-replay')) $('journey-replay').hidden = true;
    enter('CONNECT');
    setCopy(STORYBOARD_COPY.stage1Title, STORYBOARD_COPY.stage1SubtitleHtml, true);
    try {
      await capture.start();
      if (token !== epoch) return;
      $('mode').textContent = '力度測試 · 階段一';
      enter('READY');
      setCopy(STORYBOARD_COPY.stage1Title, STORYBOARD_COPY.stage1SubtitleHtml, true);
    } catch {
      if (token !== epoch) return;
      mode = 'home';
      enter('ERROR');
      setCopy(STORYBOARD_COPY.stage1Title, STORYBOARD_COPY.stage1SubtitleHtml, true);
    } finally {
      if (token === epoch) {
        waiting = false;
        $('camera').disabled = false;
      }
    }
  }

  function finishEffort(now, points) {
    if (points) {
      lastEffortMask = landmarksToMask(points);
    }
    setMask(lastEffortMask, null, false);
    target = .12;
    targetTint = 0;
    $('mode').textContent = '階段二 · 痕跡消退';
    enter('LOSS', now);
    setCopy('', '');
    $('headline').style.opacity = '0';
  }

  function startGraceReveal(now, points) {
    if (points) {
      lastGraceMask = landmarksToMask(points);
    }
    // Stage 4: Immediate, crystal-clear, deep, non-flickering imprint (pressure = null)
    setMask(lastGraceMask, null, false);
    target = 1.18;
    targetTint = 0;
    $('mode').textContent = '階段四 · 永恆印記';
    enter('REVEAL', now);
    const copy = revealCopyAt(0, reduced);
    setCopy(copy.title, copy.message, false, copy.scripture);
  }

  function startJourneyReplay() {
    const now = performance.now();
    if ($('journey-replay')) {
      $('journey-replay').hidden = false;
      drawMaskComparison($('replay-effort-canvas'), lastEffortMask, { mode: 'effort' });
      drawMaskComparison($('replay-grace-canvas'), lastGraceMask, { mode: 'grace' });
    }
    setMask(lastEffortMask, { phase: 400, progress: .8 }, true);
    setDepth(.82);
    setEffortTint(.85);
    target = .82;
    targetTint = .85;
    $('mode').textContent = '歷程回放 · 努力與恩典對比';
    enter('REPLAY', now);
  }

  function process(now, det) {
    const valid = det.valid, present = det.present;
    $('tracking-status').textContent = det.reason;

    if (state === 'READY') {
      // Stage 1: Misdirection & Lure
      setCopy(STORYBOARD_COPY.stage1Title, STORYBOARD_COPY.stage1SubtitleHtml, true);
      if (valid) {
        since ??= now;
        if (now - since > 350) {
          $('mode').textContent = '階段二 · 用力按壓';
          enter('CAPTURE', now);
          lastEffortMask = landmarksToMask(det.points);
          setMask(lastEffortMask, { phase: 0, progress: 0 }, false);
          target = captureDepthAt(0, 0, hold.required);
          targetTint = .55;
          setCopy(STORYBOARD_COPY.stage2Pressing, '');
        }
      } else {
        since = null;
      }
    } else if (state === 'CAPTURE') {
      // Stage 2A: Pressing in progress -> reddish trace on plaster + pressing copy
      const steady = valid && det.motion < .14;
      const status = hold.update(now, steady);
      $('bar').style.width = `${status.progress * 100}%`;
      setCopy(STORYBOARD_COPY.stage2Pressing, '');

      if (det.points) {
        lastEffortMask = landmarksToMask(det.points);
        setMask(lastEffortMask, { phase: now - entered, progress: status.progress }, false);
      }
      if (present) {
        absent = null;
        target = captureDepthAt(hold.elapsed, now - entered, hold.required);
        targetTint = Math.min(1, .48 + .52 * Math.max(status.progress, Math.min(1, (now - entered) / 3000)));
      } else {
        absent ??= now;
        target = .18;
        targetTint = .15;
      }

      const stoppedAfterEffort = hold.elapsed >= 1500 && !present && absent !== null && (now - absent > 600);
      if (status.complete || stoppedAfterEffort) {
        finishEffort(now, det.points);
      } else if (now - entered > 45000) {
        target = 0;
        targetTint = 0;
        enter('READY', now);
      }
    } else if (state === 'INVITE') {
      // Stage 3: Perspective Shift -> low threshold ("輕輕放置", no hard press needed)
      setCopy(STORYBOARD_COPY.stage3Title, STORYBOARD_COPY.stage3Subtitle);
      const transitionDone = (now - entered) >= REVEAL_COPY_TIMING.perspectiveTransitionMs;
      const gentleHandReady = present && Array.isArray(det.points) && det.points.length === 21;
      if (transitionDone && gentleHandReady) {
        since ??= now;
        if (now - since > 260) {
          startGraceReveal(now, det.points);
        }
      } else {
        since = null;
      }
    }
  }

  function tick(now) {
    const dt = Math.min(50, now - lastTick);
    lastTick = now;
    if (document.hidden) return;

    if (mode === 'camera') {
      try {
        const fresh = capture.frame(now);
        if (fresh && !waiting) {
          result = fresh;
          process(now, fresh);
        }
        if (!waiting && now - capture.lastAt > 6000) throw Error('No fresh inference results');
      } catch {
        stop();
      }
    }

    if (state === 'CAPTURE' && result?.present) {
      target = captureDepthAt(hold.elapsed, now - entered, hold.required);
    }

    if (state === 'LOSS') {
      // Stage 2B: Red tint fades out, palm print shrinks to shallow, waits 3s then shows futility copy
      const elapsed = now - entered;
      const copy = lossCopyAt(elapsed, reduced);
      setCopy(copy.title, copy.message);
      $('headline').style.opacity = String(copy.titleOpacity);
      if (elapsed >= REVEAL_COPY_TIMING.lossTotalDuration) {
        $('mode').textContent = '階段三 · 視角切換';
        enter('INVITE', now);
        setCopy(STORYBOARD_COPY.stage3Title, STORYBOARD_COPY.stage3Subtitle);
      }
    } else if (state === 'REVEAL') {
      // Stage 4: Hold clear, deep, steady imprint for >= 4s before Stage 5
      const elapsed = now - entered;
      const copy = revealCopyAt(elapsed, reduced);
      setCopy(copy.title, copy.message, false, copy.scripture);
      $('headline').style.opacity = String(copy.titleOpacity);
      if (copy.stage === 'STAGE_5_END') {
        $('mode').textContent = '階段五 · 啟示與結束';
        enter('END', now);
      }
    } else if (state === 'END') {
      // Stage 5: Release prompt + Psalm 139:16 + Journey Replay button
      const copy = revealCopyAt(REVEAL_COPY_TIMING.graceHoldDuration + (now - entered), reduced);
      setCopy(copy.title, copy.message, false, copy.scripture);
      $('headline').style.opacity = String(copy.titleOpacity);
      if ($('scripture')) $('scripture').style.opacity = String(copy.scriptureOpacity);
    } else if (state === 'REPLAY') {
      // Sequential + split-screen comparison replay of Effort (Stage 2) vs Grace (Stage 4/5)
      const elapsed = now - entered;
      const effortCard = $('replay-card-effort'), graceCard = $('replay-card-grace');
      if (elapsed < 1800) {
        target = .82;
        targetTint = .85;
        setCopy(STORYBOARD_COPY.stage2Pressing, '');
        effortCard?.classList.add('active');
        graceCard?.classList.remove('active');
      } else if (elapsed < 4200) {
        target = .12;
        targetTint = 0;
        setCopy(STORYBOARD_COPY.stage2Faded, '');
        effortCard?.classList.add('active');
        graceCard?.classList.remove('active');
      } else if (elapsed < 5600) {
        target = .12;
        targetTint = 0;
        setCopy(STORYBOARD_COPY.stage3Title, STORYBOARD_COPY.stage3Subtitle);
        effortCard?.classList.remove('active');
        graceCard?.classList.remove('active');
      } else if (elapsed < 8800) {
        if (target < 1) {
          setMask(lastGraceMask, null, false);
        }
        target = 1.18;
        targetTint = 0;
        setCopy(STORYBOARD_COPY.stage4Grace, '');
        effortCard?.classList.remove('active');
        graceCard?.classList.add('active');
      } else {
        target = 1.18;
        targetTint = 0;
        effortCard?.classList.add('active');
        graceCard?.classList.add('active');
        enter('END', now);
      }
    } else if (state === 'DEMO') {
      const copy = demoCopy();
      setCopy(copy.title, copy.message);
      $('headline').style.opacity = '1';
    }

    const tau = state === 'CAPTURE' ? 160 : state === 'REVEAL' ? 220 : 650;
    const nextDepth = reduced ? target : getDepth() + (target - getDepth()) * (1 - Math.exp(-dt / tau));
    setDepth(Math.abs(nextDepth - target) < .001 ? target : nextDepth);

    const currentTint = getEffortTint();
    const nextTint = reduced ? targetTint : currentTint + (targetTint - currentTint) * (1 - Math.exp(-dt / 420));
    setEffortTint(Math.abs(nextTint - targetTint) < .001 ? targetTint : nextTint);

    if (debug) {
      $('debug').textContent = `${state} | depth ${getDepth().toFixed(2)} | tint ${getEffortTint().toFixed(2)} | ${result?.valid ? '21 landmarks' : 'waiting'} | v5`;
    }
  }

  $('camera').onclick = start;
  $('demo').onclick = demo;
  $('stop').onclick = stop;
  $('replay').onclick = startJourneyReplay;
  $('fs').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* ignore fullscreen restriction */
    }
  };
  addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'camera') stop();
  });

  $('debug').hidden = !debug;
  $('camera').disabled = $('demo').disabled = false;
  setCopy(STORYBOARD_COPY.stage1Title, STORYBOARD_COPY.stage1SubtitleHtml, true);
  if (params.get('demo') === '1') demo();
  return { tick, stop };
}
