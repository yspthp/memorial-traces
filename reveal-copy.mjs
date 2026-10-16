export const STORYBOARD_COPY = Object.freeze({
  headerTitle: '《被紀念的痕跡》',
  stage1Title: '留下你的痕跡',
  stage1SubtitleHtml: '這是一個關於你存在的測試。請將手掌放在亞克力膠板上，並<strong>盡你所能，用力按壓</strong>。',
  stage1SubtitleText: '這是一個關於你存在的測試。請將手掌放在亞克力膠板上，並盡你所能，用力按壓。',
  stage2Pressing: '再用力一點... 試圖留住它...',
  stage2Faded: '無論多努力，靠自己努力留下的痕跡，始終都會消去...',
  stage3Title: '但如果，換一個視角看呢？',
  stage3Subtitle: '請輕輕將手放在鏡頭前... 不需要再用力。',
  stage4Grace: '你在世上每一個微小的片段，都在衪心上留下永恆的印記。',
  stage5Release: '你可以放手了。你不需要再用力證明什麼，因為你一直被看見。',
  stage5Scripture: '我未成形的體質，你的眼早已看見了；你所定的日子，我尚未度一日，都在你的冊子寫上了。（詩篇 139:16）',
  demoInstruction: '此為互動流程演示，請依畫面指示操作鏡頭。',
  replayButton: '觀看完整歷程回放'
});

export const REVEAL_COPY_TIMING = Object.freeze({
  lossCopyDelay: 3000,
  lossTotalDuration: 8500,
  perspectiveTransitionMs: 1500,
  graceDevelopDuration: 5500,
  stage4TextDelay: 1800,
  graceHoldDuration: 10000,
  stage5TitleDelay: 1200,
  stage5ScriptureDelay: 4800,
  fadeDuration: 2800
});

const ease = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

// Stage 4 palm print depth slowly develops over at least 5 seconds (5500ms)
export function graceDepthAt(
  elapsed,
  maxDepth = 1.18,
  duration = REVEAL_COPY_TIMING.graceDevelopDuration
) {
  const t = Math.max(0, Math.min(1, elapsed / Math.max(1, duration)));
  const eased = t * t * (3 - 2 * t);
  return 0.08 + (maxDepth - 0.08) * eased;
}

// Stage 2 fade-out copy: waits a full 3 seconds while the red trace and palm print fade,
// then slowly fades in the futility message.
export function lossCopyAt(elapsed, reducedMotion = false) {
  const { lossCopyDelay, fadeDuration } = REVEAL_COPY_TIMING;
  const visible = elapsed >= lossCopyDelay;
  const titleOpacity = !visible ? 0 : reducedMotion ? 1 : ease((elapsed - lossCopyDelay) / fadeDuration);
  return {
    title: visible ? STORYBOARD_COPY.stage2Faded : '',
    message: '',
    titleOpacity,
    messageOpacity: 0
  };
}

// Stage 4 -> Stage 5 slow, meditative copy progression (>2x slower fade and pacing):
// - Stage 4 (0 <= elapsed < graceHoldDuration [10000ms]):
//   Palm print slowly develops over 5500ms; text begins gently fading in at 1800ms over 2800ms, then holds for quiet contemplation.
// - Stage 5 (elapsed >= graceHoldDuration [10000ms]):
//   Waits 1200ms then slowly fades in release copy over 2800ms; scripture fades in at 4800ms into Stage 5 over 2800ms.
export function revealCopyAt(elapsed, reducedMotion = false) {
  const {
    stage4TextDelay,
    graceHoldDuration,
    stage5TitleDelay,
    stage5ScriptureDelay,
    fadeDuration
  } = REVEAL_COPY_TIMING;

  if (elapsed < 0) {
    return {
      stage: 'STAGE_4_GRACE',
      title: '',
      message: '',
      scripture: '',
      titleOpacity: 0,
      messageOpacity: 0,
      scriptureOpacity: 0,
      canReplayJourney: false
    };
  }

  if (elapsed < graceHoldDuration) {
    const visible = elapsed >= stage4TextDelay;
    const titleOpacity = !visible
      ? 0
      : reducedMotion
        ? 1
        : ease((elapsed - stage4TextDelay) / fadeDuration);
    return {
      stage: 'STAGE_4_GRACE',
      title: visible ? STORYBOARD_COPY.stage4Grace : '',
      message: '',
      scripture: '',
      titleOpacity,
      messageOpacity: 0,
      scriptureOpacity: 0,
      canReplayJourney: false
    };
  }

  const stage5Elapsed = elapsed - graceHoldDuration;
  const titleVisible = stage5Elapsed >= stage5TitleDelay;
  const scriptureVisible = stage5Elapsed >= stage5ScriptureDelay;
  const titleOpacity = !titleVisible
    ? 0
    : reducedMotion
      ? 1
      : ease((stage5Elapsed - stage5TitleDelay) / fadeDuration);
  const scriptureOpacity = !scriptureVisible
    ? 0
    : reducedMotion
      ? 1
      : ease((stage5Elapsed - stage5ScriptureDelay) / fadeDuration);

  return {
    stage: 'STAGE_5_END',
    title: titleVisible ? STORYBOARD_COPY.stage5Release : '',
    message: '',
    scripture: scriptureVisible ? STORYBOARD_COPY.stage5Scripture : '',
    titleOpacity,
    messageOpacity: 0,
    scriptureOpacity,
    canReplayJourney: scriptureVisible
  };
}

export function demoCopy() {
  return {
    title: STORYBOARD_COPY.demoInstruction,
    message: '',
    scripture: '',
    titleOpacity: 1,
    messageOpacity: 0,
    scriptureOpacity: 0
  };
}
