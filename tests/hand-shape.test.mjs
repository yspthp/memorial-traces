import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessHands,HoldGate,motionBetween,landmarksToMask} from '../hand-shape.mjs';
import {bounds,makeRelief} from '../relief.mjs';
import {hand} from './hand-fixture.mjs';
test('one open hand accepted; absent, two hands, clipped, tiny and closed rejected',()=>{
 assert.equal(assessHands([hand]).valid,true);
 assert.equal(assessHands([]).present,false);
 assert.equal(assessHands([hand,hand]).valid,false);
 assert.equal(assessHands([hand.map(p=>({...p,x:p.x-.3}))]).valid,false);
 assert.equal(assessHands([hand.map(p=>({x:.5+(p.x-.5)*.2,y:.5+(p.y-.5)*.2}))]).valid,false);
 const closed=hand.map(p=>({...p}));for(const i of [8,12,16,20])closed[i]={...closed[i-3]};
 assert.equal(assessHands([closed]).valid,false);
});
test('hold needs three seconds of fresh good samples; 600ms loss pauses; long loss resets',()=>{
 const gate=new HoldGate();for(let t=0;t<=1000;t+=100)gate.update(t,true);
 assert.equal(gate.elapsed,1000);
 for(let t=1100;t<=1600;t+=100)gate.update(t,false);
 assert.equal(gate.elapsed,1000);gate.update(1700,true);assert.equal(gate.elapsed,1000);
 let status;for(let t=1800;t<=3700;t+=100)status=gate.update(t,true);
 assert.equal(status.complete,true);
 gate.update(5000,false);assert.equal(gate.elapsed,0);
 const stalled=new HoldGate();stalled.update(0,true);assert.equal(stalled.update(5000,true).complete,false);
});
test('jitter is tolerated; large translation flagged',()=>{
 assert.ok(motionBetween(hand,hand.map(p=>({...p,x:p.x+.002})))<.14);
 assert.ok(motionBetween(hand,hand.map(p=>({...p,x:p.x+.15})))>.14);
});
test('left/right landmark shapes fit inside slab and make a recessed impression',()=>{
 for(const points of [hand,hand.map(p=>({...p,x:1-p.x}))]){
  const mask=landmarksToMask(points),b=bounds(mask,257,257);
  assert.ok(b.area>5000);assert.ok(b.x0>10&&b.x1<247&&b.y0>10&&b.y1<247);
  assert.ok(Math.min(...makeRelief(mask,257))<-.04);
 }
});
