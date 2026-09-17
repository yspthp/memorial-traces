import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bounds,fitMask,makeRelief,demoMask} from '../relief.mjs';
import {segmentFrame,overlap} from '../capture.mjs';
test('blank input stays flat',()=>{
  assert.ok(makeRelief(new Float32Array(257*257),257).every(v=>v===0));
});
test('relief is recessed, has a modest raised rim, stays inside the slab',()=>{
  const n=257,h=makeRelief(demoMask(n),n);
  assert.ok(h.every(Number.isFinite));
  assert.ok(Math.min(...h)<-.05);
  assert.ok(Math.max(...h)>0 && Math.max(...h)<.02);
  assert.ok(Math.min(...h)>-.20);
  for(let i=0;i<n;i++) for(const k of [i,(n-1)*n+i,i*n,i*n+n-1]) assert.equal(h[k],0);
});
test('normalization centres and preserves aspect ratio',()=>{
  const m=new Float32Array(160*120);
  for(let y=10;y<90;y++)for(let x=70;x<110;x++)m[y*160+x]=1;
  const b=bounds(fitMask(m,160,120,257),257,257);
  assert.ok(Math.abs(b.width/b.height-.5)<.02);
  assert.ok(Math.abs((b.x0+b.x1)/2-128)<=1);
  assert.ok(Math.abs((b.y0+b.y1)/2-128)<=1);
});
test('dark image is absent, solid bright region is not a valid hand',()=>{
  assert.equal(segmentFrame(new Uint8ClampedArray(256*192*4)).present,false);
  const image=new Uint8ClampedArray(256*192*4);
  for(let y=25;y<170;y++)for(let x=70;x<160;x++)for(let c=0;c<3;c++)image[(y*256+x)*4+c]=255;
  const result=segmentFrame(image);
  assert.equal(result.present,true);assert.equal(result.valid,false);
});
test('overlap rejects motion and missing frames',()=>{
  assert.equal(overlap(null,null),0);
  assert.equal(overlap([1,0],[0,1]),0);
  assert.equal(overlap([1,0],[1,0]),1);
});
