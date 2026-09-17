import {test} from 'node:test';
import assert from 'node:assert/strict';
import {revealCopyAt} from '../reveal-copy.mjs';
test('no reveal text exists before the first three seconds',()=>{
  for(const elapsed of [0,500,2000,2999]){
    assert.deepEqual(revealCopyAt(elapsed),{title:'',message:'',titleOpacity:0,messageOpacity:0});
  }
});
test('title fades in at 3s; second line starts two seconds later',()=>{
  assert.equal(revealCopyAt(3000).title,'你一直被看見。');
  assert.equal(revealCopyAt(3000).titleOpacity,0);
  assert.equal(revealCopyAt(3750).titleOpacity,.5);
  assert.equal(revealCopyAt(4500).titleOpacity,1);
  assert.equal(revealCopyAt(4999).message,'');
  assert.equal(revealCopyAt(5000).message,'你的每一個痕跡，在神眼中都是最寶貴的。');
  assert.equal(revealCopyAt(5000).messageOpacity,0);
  assert.equal(revealCopyAt(5750).messageOpacity,.5);
  assert.equal(revealCopyAt(6500).messageOpacity,1);
});
test('a new round or replay starts blank, independent of the last round',()=>{
  revealCopyAt(14000);
  assert.equal(revealCopyAt(0).title,'');
  assert.equal(revealCopyAt(0).message,'');
});
test('reduced motion skips fades but preserves both delays',()=>{
  assert.equal(revealCopyAt(2999,true).titleOpacity,0);
  assert.equal(revealCopyAt(3000,true).titleOpacity,1);
  assert.equal(revealCopyAt(4999,true).messageOpacity,0);
  assert.equal(revealCopyAt(5000,true).messageOpacity,1);
});
