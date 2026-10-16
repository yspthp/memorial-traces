import {Capture} from './capture-landmarks.mjs';
import {HoldGate,HOLD_DURATION_MS,captureDepthAt,landmarksToMask} from './hand-shape.mjs';
import {demoMask,bounds} from './relief.mjs';
import {
  STORYBOARD_COPY,
  REVEAL_COPY_TIMING,
  graceDepthAt,
  lossCopyAt,
  revealCopyAt,
  demoCopy
} from './reveal-copy.mjs';

function renderSnapshotToCanvas(targetCanvas, snapshot, mask, { mode = 'effort', fadeProgress = 1 } = {}) {
  if (!targetCanvas) return;
  const ctx = targetCanvas.getContext('2d');
  const w = targetCanvas.width, h = targetCanvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = mode === 'grace' ? '#1c2625' : '#161f20';
  ctx.fillRect(0, 0, w, h);

  if (snapshot instanceof ImageData) {
    const temp = document.createElement('canvas');
    temp.width = snapshot.width;
    temp.height = snapshot.height;
    temp.getContext('2d').putImageData(snapshot, 0, 0);
    ctx.save();
    ctx.globalAlpha = mode === 'effort' ? Math.max(0.28, 1 - 0.65 * fadeProgress) : 1;
    ctx.drawImage(temp, 0, 0, w, h);
    ctx.restore();
    return;
  }

  if (!mask) return;
  const size = Math.round(Math.sqrt(mask.length));
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
          const alpha = Math.round(190 * (1 - 0.62 * fadeProgress));
          img.data[idx] = 206;
          img.data[idx + 1] = 152;
          img.data[idx + 2] = 146;
          img.data[idx + 3] = alpha;
        } else {
          img.data[idx] = 242;
          img.data[idx + 1] = 231;
          img.data[idx + 2] = 208;
          img.data[idx + 3] = 240;
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
  let graceHoldTimer = null, graceHoldUnlocked = false;

  const journeyState = {
    effortMask: demoMask(257),
    graceMask: demoMask(257),
    effortSnapshot: null,
    graceSnapshot: null,
    effortFrames: [],
    graceFrames: []
  };

  const hold = new HoldGate(HOLD_DURATION_MS);
  const capture = new Capture($('preview'), () => {
    if (mode === 'camera' && state === 'CONNECT') {
      setCopy(STORYBOARD_COPY.stage1Title, STORYBOARD_COPY.stage1SubtitleHtml, true);
    }
  });

  function capturePreviewSnapshot() {
    const previewCanvas = $('preview');
    if (!previewCanvas || !previewCanvas.width || !previewCanvas.height) return null;
    try {
      const ctx = previewCanvas.getContext('2d');
      return ctx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
    } catch {
      return null;
    }
  }

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

  function syncReplayButtonDOM(next) {
    const controlsEl = $('controls');
    if (!controlsEl) return;
    let replayBtn = $('replay');
    const shouldRenderInDOM = next === 'END' || next === 'REPLAY';
    if (shouldRenderInDOM) {
      if (!replayBtn) {
        replayBtn = document.createElement('button');
        replayBtn.id = 'replay';
        replayBtn.type = 'button';
        replayBtn.textContent = STORYBOARD_COPY.replayButton;
        replayBtn.onclick = startJourneyReplay;
        const stopBtn = $('stop');
        if (stopBtn && stopBtn.parentNode === controlsEl) {
          controlsEl.insertBefore(replayBtn, stopBtn);
        } else {
          controlsEl.appendChild(replayBtn);
        }
      }
    } else if (replayBtn) {
      replayBtn.remove();
    }
  }

  function syncPreviewOverlay(next) {
    const panel = $('preview-panel');
    const overlay = $('preview-complete-overlay');
    const isComplete = next === 'END' || next === 'REPLAY';
    if (panel) {
      panel.classList.toggle('saved-complete', isComplete);
    }
    if (overlay) {
      overlay.hidden = !isComplete;
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
    syncReplayButtonDOM(next);
    syncPreviewOverlay(next);
  }

  function enter(next, now = performance.now()) {
    if (graceHoldTimer && next !== 'REVEAL') {
      clearTimeout(graceHoldTimer);
      graceHoldTimer = null;
    }
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
    journeyState.effortFrames = [];
    journeyState.graceFrames = [];
    $('camera').disabled = true;
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
      journeyState.effortMask = landmarksToMask(points);
    }
    journeyState.effortSnapshot = capturePreviewSnapshot() || journeyState.effortSnapshot;
    setMask(journeyState.effortMask, null, false);
    target = .12;
    targetTint = 0;
    $('mode').textContent = '階段二 · 痕跡消退';
    enter('LOSS', now);
    setCopy('', '');
    $('headline').style.opacity = '0';
  }

  // Stage 4: Slowly emerge palm print over 5500ms (>= 5s) and hold for 10000ms with setTimeout lock
  function startGraceReveal(now, points) {
    if (points) {
      journeyState.graceMask = landmarksToMask(points);
    }
    journeyState.graceSnapshot = capturePreviewSnapshot();
    journeyState.graceFrames.push({
      mask: journeyState.graceMask,
      snapshot: journeyState.graceSnapshot,
      depth: 1.18
    });
    setMask(journeyState.graceMask, null, false);
    setDepth(.08);
    target = .08;
    targetTint = 0;
    graceHoldUnlocked = false;
    $('mode').textContent = '階段四 · 永恆印記';
    enter('REVEAL', now);
    setCopy('', '');
    $('headline').style.opacity = '0';
    graceHoldTimer = setTimeout(() => {
      graceHoldUnlocked = true;
    }, REVEAL_COPY_TIMING.graceHoldDuration);
  }

  function startJourneyReplay() {
    const now = performance.now();
    if ($('journey-replay')) {
      $('journey-replay').hidden = false;
      renderSnapshotToCanvas($('replay-effort-canvas'), journeyState.effortSnapshot, journeyState.effortMask, {
        mode: 'effort',
        fadeProgress: 0
      });
      renderSnapshotToCanvas($('replay-grace-canvas'), journeyState.graceSnapshot, journeyState.graceMask, {
        mode: 'grace',
        fadeProgress: 0
      });
    }
    setMask(journeyState.effortMask, { phase: 400, progress: .8 }, true);
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
      setCopy(STORYBOARD_COPY.stage1Title, STORYBOARD_COPY.stage1SubtitleHtml, true);
      if (valid) {
        since ??= now;
        if (now - since > 350) {
          $('mode').textContent = '階段二 · 用力按壓';
          enter('CAPTURE', now);
          journeyState.effortMask = landmarksToMask(det.points);
          journeyState.effortSnapshot = capturePreviewSnapshot();
          setMask(journeyState.effortMask, { phase: 0, progress: 0 }, false);
          target = captureDepthAt(0, 0, hold.required);
          targetTint = .55;
          setCopy(STORYBOARD_COPY.stage2Pressing, '');
        }
      } else {
        since = null;
      }
    } else if (state === 'CAPTURE') {
      const steady = valid && det.motion < .14;
      const status = hold.update(now, steady);
      $('bar').style.width = `${status.progress * 100}%`;
      setCopy(STORYBOARD_COPY.stage2Pressing, '');

      if (det.points) {
        journeyState.effortMask = landmarksToMask(det.points);
        setMask(journeyState.effortMask, { phase: now - entered, progress: status.progress }, false);
        if (journeyState.effortFrames.length < 24) {
          journeyState.effortFrames.push({
            elapsed: now - entered,
            progress: status.progress,
            depth: target,
            tint: targetTint
          });
        }
        journeyState.effortSnapshot = capturePreviewSnapshot() || journeyState.effortSnapshot;
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
      const elapsed = now - entered;
      // Palm print slowly emerges over 5.5 seconds (>= 5 seconds)
      target = graceDepthAt(elapsed, 1.18, REVEAL_COPY_TIMING.graceDevelopDuration);
      const copy = revealCopyAt(elapsed, reduced);
      setCopy(copy.title, copy.message, false, copy.scripture);
      $('headline').style.opacity = String(copy.titleOpacity);
      if (
        copy.stage === 'STAGE_5_END' &&
        graceHoldUnlocked &&
        elapsed >= REVEAL_COPY_TIMING.graceHoldDuration
      ) {
        $('mode').textContent = '階段五 · 啟示與結束';
        enter('END', now);
      }
    } else if (state === 'END') {
      target = 1.18;
      const copy = revealCopyAt(REVEAL_COPY_TIMING.graceHoldDuration + (now - entered), reduced);
      setCopy(copy.title, copy.message, false, copy.scripture);
      $('headline').style.opacity = String(copy.titleOpacity);
      if ($('scripture')) $('scripture').style.opacity = String(copy.scriptureOpacity);
    } else if (state === 'REPLAY') {
      const elapsed = now - entered;
      const effortCard = $('replay-card-effort'), graceCard = $('replay-card-grace');
      if (elapsed < 2200) {
        target = .82;
        targetTint = .85;
        setCopy(STORYBOARD_COPY.stage2Pressing, '');
        renderSnapshotToCanvas($('replay-effort-canvas'), journeyState.effortSnapshot, journeyState.effortMask, {
          mode: 'effort',
          fadeProgress: 0.15
        });
        effortCard?.classList.add('active');
        graceCard?.classList.remove('active');
      } else if (elapsed < 5200) {
        const fadeP = Math.min(1, (elapsed - 2200) / 2500);
        target = .12;
        targetTint = 0;
        setCopy(STORYBOARD_COPY.stage2Faded, '');
        renderSnapshotToCanvas($('replay-effort-canvas'), journeyState.effortSnapshot, journeyState.effortMask, {
          mode: 'effort',
          fadeProgress: fadeP
        });
        effortCard?.classList.add('active');
        graceCard?.classList.remove('active');
      } else if (elapsed < 7200) {
        target = .12;
        targetTint = 0;
        setCopy(STORYBOARD_COPY.stage3Title, STORYBOARD_COPY.stage3Subtitle);
        effortCard?.classList.remove('active');
        graceCard?.classList.remove('active');
      } else if (elapsed < 13500) {
        const graceElapsed = elapsed - 7200;
        if (graceElapsed < 100) {
          setMask(journeyState.graceMask, null, false);
        }
        target = graceDepthAt(graceElapsed, 1.18, REVEAL_COPY_TIMING.graceDevelopDuration);
        targetTint = 0;
        setCopy(STORYBOARD_COPY.stage4Grace, '');
        renderSnapshotToCanvas($('replay-grace-canvas'), journeyState.graceSnapshot, journeyState.graceMask, {
          mode: 'grace',
          fadeProgress: 0
        });
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

    const tau = state === 'CAPTURE' ? 160 : state === 'REVEAL' ? 260 : 650;
    const nextDepth = reduced ? target : getDepth() + (target - getDepth()) * (1 - Math.exp(-dt / tau));
    setDepth(Math.abs(nextDepth - target) < .001 ? target : nextDepth);

    const currentTint = getEffortTint();
    const nextTint = reduced ? targetTint : currentTint + (targetTint - currentTint) * (1 - Math.exp(-dt / 420));
    setEffortTint(Math.abs(nextTint - targetTint) < .001 ? targetTint : nextTint);

    if (debug) {
      $('debug').textContent = `${state} | depth ${getDepth().toFixed(2)} | tint ${getEffortTint().toFixed(2)} | ${result?.valid ? '21 landmarks' : 'waiting'} | v5.2`;
    }
  }

  $('camera').onclick = start;
  $('demo').onclick = demo;
  $('stop').onclick = stop;
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
