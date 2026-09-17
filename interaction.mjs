import {Capture} from './capture-landmarks.mjs';
import {HoldGate,landmarksToMask} from './hand-shape.mjs';
import {demoMask} from './relief.mjs';
import {revealCopyAt} from './reveal-copy.mjs';
export function mountInteraction({setMask,setDepth,getDepth}){
  const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
  const debug=params.get('debug')==='1',reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  let mode='home',state='HOME',entered=performance.now(),lastTick=entered,target=0,epoch=0,waiting=false;
  let since=null,absent=null,result=null;
  const hold=new HoldGate(),capture=new Capture($('preview'),message=>{if(mode==='camera')text('正在準備手部辨識。',message);});
  function text(title,message){if($('headline').textContent!==title)$('headline').textContent=title;if($('message').textContent!==message)$('message').textContent=message;}
  function enter(next,now=performance.now()){
    state=next;entered=now;since=absent=null;hold.reset();
    const delayed=next==='REVEAL'||next==='DEMO';
    $('headline').style.opacity=$('message').style.opacity=delayed?'0':'1';
    if(delayed)text('','');
    $('meter').hidden=next!=='CAPTURE';$('bar').style.width='0%';
    $('preview-panel').hidden=mode!=='camera';$('stop').hidden=mode!=='camera';
  }
  function stop(){epoch++;capture.stop();waiting=false;$('camera').disabled=false;mode='home';result=null;target=0;enter('PAUSED');text('體驗已暫停。','鏡頭已關閉。你可以重新開始，或觀看示範。');}
  function demo(){
    epoch++;capture.stop();waiting=false;$('camera').disabled=false;mode='demo';result=null;
    setMask(demoMask(257));target=1;$('mode').textContent='示範 · 藝術化掌紋';$('replay').hidden=false;
    enter('DEMO');
  }
  async function start(){
    if(waiting)return;
    const token=++epoch;waiting=true;mode='camera';result=null;target=0;$('camera').disabled=true;$('replay').hidden=true;
    enter('CONNECT');text('讓你的手掌，留下痕跡。','請允許鏡頭；模型只在本機辨識，不會上傳影像。');
    try{
      await capture.start();if(token!==epoch)return;
      $('mode').textContent='掌形預覽 · v4.1';enter('READY');
      text('請把手掌放入框內。','看見綠色骨架後，自然停留三秒。');
    }catch(error){
      if(token!==epoch)return;
      mode='home';enter('ERROR');
      text(error.code==='MODEL_LOAD'?'手部模型暫時未能載入。':'暫時未能開啟鏡頭。',
        error.code==='MODEL_LOAD'?'請檢查網絡後重新開始；你亦可觀看示範。':error.name==='NotAllowedError'?'請允許鏡頭權限，或先觀看示範。':'請檢查鏡頭是否可用，再試一次。');
    }finally{if(token===epoch){waiting=false;$('camera').disabled=false;}}
  }
  function process(now,det){
    const valid=det.valid,present=det.present;
    $('tracking-status').textContent=det.reason;
    if(state==='READY'){
      text('請自然張開五指。',det.reason);
      if(valid){since??=now;if(now-since>350)enter('CAPTURE',now);}else since=null;
    }else if(state==='CAPTURE'){
      const steady=valid&&det.motion<.14,status=hold.update(now,steady);
      $('bar').style.width=`${status.progress*100}%`;
      text(steady?'請將手掌放下。用力一點。':'慢慢來，進度會暫時保留。',
        steady?`自然停留即可，尚餘 ${Math.max(0,Math.ceil(3*(1-status.progress)))} 秒。`:valid?'手掌移動較大，請稍稍停留。':det.reason);
      if(status.complete){setMask(landmarksToMask(det.points));target=.12;enter('LOSS',now);}
      else if(now-entered>30000)enter('READY',now);
    }else if(state==='REMOVE'){
      text('請先把手掌移開。','讓這一道淡淡的痕跡，停留片刻。');
      if(!present){absent??=now;if(now-absent>700)enter('INVITE',now);}else absent=null;
    }else if(state==='INVITE'){
      text('現在，再輕輕放上去一次。',valid?'不需要用力。':det.reason);
      if(valid){since??=now;if(now-since>500){target=1;enter('REVEAL',now);}}else since=null;
    }
  }
  function tick(now){
    const dt=Math.min(50,now-lastTick);lastTick=now;
    if(document.hidden)return;
    if(mode==='camera'){
      try{
        const fresh=capture.frame(now);
        if(fresh&&!waiting){result=fresh;process(now,fresh);}
        if(!waiting&&now-capture.lastAt>6000)throw Error('No fresh inference results');
      }catch{stop();text('手部辨識已暫停。','鏡頭或辨識程序中斷；請重新開始，或觀看示範。');}
    }
    if(state==='LOSS'){text('這麼用力，卻只有淡淡的痕跡嗎？','請慢慢移開手掌。');if(now-entered>4000)enter('REMOVE',now);}
    if(state==='REVEAL'||state==='DEMO'){
      const copy=revealCopyAt(now-entered,reduced);
      text(copy.title,copy.message);
      $('headline').style.opacity=String(copy.titleOpacity);
      $('message').style.opacity=String(copy.messageOpacity);
      if(state==='REVEAL'&&now-entered>14000){target=0;enter('FADE',now);}
    }
    if(state==='FADE'&&now-entered>3500)enter('READY',now);
    if(['REMOVE','INVITE'].includes(state)&&now-entered>60000){target=0;enter('READY',now);}
    const next=reduced?target:getDepth()+(target-getDepth())*(1-Math.exp(-dt/650));
    setDepth(Math.abs(next-target)<.001?target:next);
    if(debug)$('debug').textContent=`${state} | depth ${getDepth().toFixed(2)} | ${result?.valid?'21 landmarks':'waiting'} | v4.1`;
  }
  $('camera').onclick=start;$('demo').onclick=demo;$('stop').onclick=stop;
  $('replay').onclick=()=>{setDepth(0);target=1;enter('DEMO');};
  $('fs').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('message').textContent='此瀏覽器未能切換全螢幕；仍可繼續體驗。';}};
  addEventListener('pagehide',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='camera')stop();});
  $('debug').hidden=!debug;$('camera').disabled=$('demo').disabled=false;
  text('每一道痕跡，都值得被留下。','開始鏡頭體驗，或先觀看石膏掌印示範。');
  if(params.get('demo')==='1')demo();
  return {tick,stop};
}
