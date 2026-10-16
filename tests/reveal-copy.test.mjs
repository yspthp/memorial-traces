import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  STORYBOARD_COPY,
  REVEAL_COPY_TIMING,
  lossCopyAt,
  revealCopyAt,
  demoCopy
} from '../reveal-copy.mjs';

test('storyboard copy constants match the exact specification strings', () => {
  assert.equal(STORYBOARD_COPY.headerTitle, '《被紀念的痕跡》');
  assert.equal(STORYBOARD_COPY.stage1Title, '留下你的痕跡');
  assert.equal(
    STORYBOARD_COPY.stage1SubtitleHtml,
    '這是一個關於你存在的測試。請將手掌貼近鏡頭，並<strong>盡你所能，用力按壓</strong>。'
  );
  assert.equal(STORYBOARD_COPY.stage2Pressing, '再用力一點... 試圖留住它...');
  assert.equal(STORYBOARD_COPY.stage2Faded, '無論多努力，靠自己力留下的痕跡，始終都會淡去...');
  assert.equal(STORYBOARD_COPY.stage3Title, '但如果，換一個視角看呢？');
  assert.equal(STORYBOARD_COPY.stage3Subtitle, '請輕輕將手放在鏡頭前... 不需要再用力。');
  assert.equal(STORYBOARD_COPY.stage4Grace, '你在世上每一個微小的片段，都在衪心上留下永恆的印記。');
  assert.equal(STORYBOARD_COPY.stage5Release, '你可以放手了。你不需要再用力證明什麼，因為你一直被看見。');
  assert.equal(
    STORYBOARD_COPY.stage5Scripture,
    '我未成形的體質，你的眼早已看見了；你所定的日子，我尚未度一日，都在你的冊子寫上了。（詩篇 139:16）'
  );
  assert.equal(STORYBOARD_COPY.demoInstruction, '此為互動流程演示，請依畫面指示操作鏡頭。');
  assert.equal(STORYBOARD_COPY.replayButton, '觀看完整歷程回放');
});

test('Stage 2 fade waits three full seconds before showing the futility message', () => {
  for (const elapsed of [0, 500, 1800, 2999]) {
    assert.deepEqual(lossCopyAt(elapsed), {
      title: '',
      message: '',
      titleOpacity: 0,
      messageOpacity: 0
    });
  }
  const at3s = lossCopyAt(3000);
  assert.equal(at3s.title, '無論多努力，靠自己力留下的痕跡，始終都會淡去...');
  assert.equal(at3s.titleOpacity, 0);
  assert.equal(lossCopyAt(3000 + REVEAL_COPY_TIMING.fadeDuration).titleOpacity, 1);
  assert.equal(lossCopyAt(3000, true).titleOpacity, 1);
});

test('Stage 4 immediately reveals grace copy and holds for 4 seconds before Stage 5 scripture', () => {
  const start = revealCopyAt(0, true);
  assert.equal(start.stage, 'STAGE_4_GRACE');
  assert.equal(start.title, '你在世上每一個微小的片段，都在衪心上留下永恆的印記。');
  assert.equal(start.scripture, '');
  assert.equal(start.canReplayJourney, false);

  const mid = revealCopyAt(3500, true);
  assert.equal(mid.stage, 'STAGE_4_GRACE');
  assert.equal(mid.title, '你在世上每一個微小的片段，都在衪心上留下永恆的印記。');

  const end = revealCopyAt(4000, true);
  assert.equal(end.stage, 'STAGE_5_END');
  assert.equal(end.title, '你可以放手了。你不需要再用力證明什麼，因為你一直被看見。');
  assert.equal(
    end.scripture,
    '我未成形的體質，你的眼早已看見了；你所定的日子，我尚未度一日，都在你的冊子寫上了。（詩篇 139:16）'
  );
  assert.equal(end.canReplayJourney, true);
});

test('Demo copy contains no spoilers of God perspective or scripture', () => {
  const copy = demoCopy();
  assert.equal(copy.title, '此為互動流程演示，請依畫面指示操作鏡頭。');
  assert.equal(copy.message, '');
  assert.equal(copy.scripture, '');
});
