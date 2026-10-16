export const STORYBOARD_COPY = Object.freeze({
  headerTitle: '《被紀念的痕跡》',
  stage1Title: '留下你的痕跡',
  stage1SubtitleHtml: '這是一個關於你存在的測試。請將手掌貼近鏡頭，並<strong>盡你所能，用力按壓</strong>。',
  stage1SubtitleText: '這是一個關於你存在的測試。請將手掌貼近鏡頭，並盡你所能，用力按壓。',
  stage2Pressing: '再用力一點... 試圖留住它...',
  stage2Faded: '無論多努力，靠自己力留下的痕跡，始終都會淡去...',
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
  lossTotalDuration: 7200,
  perspectiveTransitionMs: 1500,
  graceHoldDuration: 4000,
  fadeDuration: 1200
});

const ease = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

// Stage 2 fade-out copy: waits a full 3 seconds while the red trace and palm print fade,
// then displays the futility message.
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

// Stage 4 -> Stage 5 copy progression:
// - Stage 4 (0 <= elapsed < graceHoldDuration, minimum >= 3500ms): Instant display upon gentle placement, forced hold for 4000ms.
// - Stage 5 (elapsed >= graceHoldDuration): Displays the release message, Psalm 139:16 scripture, and enables journey replay.
export function revealCopyAt(elapsed, reducedMotion = false) {
  const { graceHoldDuration, fadeDuration } = REVEAL_COPY_TIMING;
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
    const titleOpacity = reducedMotion ? 1 : ease(elapsed / Math.min(600, fadeDuration));
    return {
      stage: 'STAGE_4_GRACE',
      title: STORYBOARD_COPY.stage4Grace,
      message: '',
      scripture: '',
      titleOpacity: Math.max(reducedMotion ? 1 : 0.01, titleOpacity),
      messageOpacity: 0,
      scriptureOpacity: 0,
      canReplayJourney: false
    };
  }
  const stage5Elapsed = elapsed - graceHoldDuration;
  const titleOpacity = reducedMotion ? 1 : ease(stage5Elapsed / fadeDuration);
  const scriptureOpacity = reducedMotion ? 1 : ease((stage5Elapsed - 400) / fadeDuration);
  return {
    stage: 'STAGE_5_END',
    title: STORYBOARD_COPY.stage5Release,
    message: '',
    scripture: STORYBOARD_COPY.stage5Scripture,
    titleOpacity,
    messageOpacity: 0,
    scriptureOpacity,
    canReplayJourney: true
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
