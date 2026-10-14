import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessHands,HoldGate,HOLD_DURATION_MS,captureDepthAt,motionBetween,landmarksToMask} from '../hand-shape.mjs';
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
test('hold needs ten seconds of fresh good samples; 600ms loss pauses; long loss resets',()=>{
 assert.equal(HOLD_DURATION_MS,10000);
 const gate=new HoldGate();for(let t=0;t<=3000;t+=100)gate.update(t,true);
 assert.equal(gate.elapsed,3000);
 assert.equal(gate.update(3000,true).complete,false);
 for(let t=3100;t<=3600;t+=100)gate.update(t,false);
 assert.equal(gate.elapsed,3000);gate.update(3700,true);assert.equal(gate.elapsed,3000);
 let status;for(let t=3800;t<=10700;t+=100)status=gate.update(t,true);
 assert.equal(status.complete,true);
 gate.update(12000,false);assert.equal(gate.elapsed,0);
 const stalled=new HoldGate();stalled.update(0,true);assert.equal(stalled.update(12000,true).complete,false);
});
test('capture depth fluctuates dynamically across 10s and pressure relief produces uneven depth',()=>{
 const samples=[];
 for(let t=0;t<=10000;t+=250)samples.push(captureDepthAt(t,t));
 const minD=Math.min(...samples),maxD=Math.max(...samples);
 assert.ok(minD>=.12&&minD<.50);
 assert.ok(maxD>.75&&maxD<=.95);
 assert.ok(maxD-minD>.35);
 const mask=landmarksToMask(hand,257);
 const f1=makeRelief(mask,257,{phase:500,progress:.05});
 const f2=makeRelief(mask,257,{phase:2200,progress:.22});
 let diff=0;
 for(let i=0;i<f1.length;i++)diff=Math.max(diff,Math.abs(f1[i]-f2[i]));
 assert.ok(diff>.01);
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
