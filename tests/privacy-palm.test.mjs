import {test} from 'node:test';
import assert from 'node:assert/strict';
import {landmarksToMask,handGeometry} from '../hand-shape.mjs';
import {hand} from './hand-fixture.mjs';
import {bounds} from '../relief.mjs';
import {drawHandPreview} from '../hand-preview.mjs';
test('palm silhouette is fuller than the MCP-only envelope',()=>{
  const b=bounds(landmarksToMask(hand),257,257);
  assert.ok(b.width/b.height>.48);
  assert.ok(b.area>8500);
});
test('finger pads stay centred on joints and are not tapered to thin spikes',()=>{
  const shape=handGeometry(hand);
  const width=Math.hypot((hand[5].x-hand[17].x)*4/3,hand[5].y-hand[17].y);
  const indexTip=shape.capsules[5];
  assert.equal(indexTip[1].x,hand[8].x*4/3);
  assert.equal(indexTip[1].y,hand[8].y);
  assert.ok(indexTip[3]>=width*.10);
});
test('rotating or mirroring the hand preserves fullness',()=>{
  const base=bounds(landmarksToMask(hand),257,257);
  const mirrored=hand.map(p=>({x:1-p.x,y:p.y}));
  const rotated=hand.map(p=>({x:.5-(p.y-.5)*3/4,y:.5+(p.x-.5)*4/3}));
  for(const points of [mirrored,rotated]){
    const b=bounds(landmarksToMask(points),257,257);
    assert.ok(Math.abs(b.area/base.area-1)<.02);
  }
});
test('preview draws vectors only for valid, invalid and missing hands',()=>{
  let fills=0;
  const ctx={canvas:{width:480,height:360},setTransform(){},setLineDash(){},strokeRect(){},
    beginPath(){},moveTo(){},lineTo(){},closePath(){},arc(){},stroke(){},fill(){fills++;},fillRect(){fills++;},
    drawImage(){assert.fail('Preview must not draw any source image');},
    putImageData(){assert.fail('Preview must not copy camera pixels');}};
  drawHandPreview(ctx,hand,true);drawHandPreview(ctx,hand,false);drawHandPreview(ctx,null);
  assert.ok(fills>3);
  assert.equal(ctx.fillStyle,'#132021');
});
