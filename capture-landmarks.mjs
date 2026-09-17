import {assessHands,smoothPoints,motionBetween} from './hand-shape.mjs';
import {drawHandPreview} from './hand-preview.mjs';
export const WIDTH=480,HEIGHT=360;
export class Capture {
  constructor(canvas,onStatus=()=>{}) {
    this.canvas=canvas;canvas.width=WIDTH;canvas.height=HEIGHT;
    this.ctx=canvas.getContext('2d');this.input=document.createElement('canvas');
    this.input.width=WIDTH;this.input.height=HEIGHT;this.ictx=this.input.getContext('2d');
    this.video=document.createElement('video');this.video.muted=true;this.video.playsInline=true;
    this.onStatus=onStatus;this.generation=0;
    drawHandPreview(this.ctx,null);
  }
  async start(){
    this.stop();const generation=this.generation;
    if(!navigator.mediaDevices?.getUserMedia)throw Error('需要 HTTPS 及支援鏡頭的瀏覽器。');
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false});
      if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());throw new DOMException('Cancelled','AbortError');}
      this.stream=stream;this.video.srcObject=stream;
      let playTimer;
      try{await Promise.race([this.video.play(),new Promise((_,reject)=>{playTimer=setTimeout(()=>reject(Error('鏡頭未能提供畫面')),8000);})]);}
      finally{clearTimeout(playTimer);}
      if(generation!==this.generation)throw new DOMException('Cancelled','AbortError');
      this.onStatus('鏡頭已開啟；首次使用需要下載手部辨識模型，請稍候。');
      await new Promise((resolve,reject)=>{
        const worker=new Worker(new URL('./hand-worker.js',import.meta.url));this.worker=worker;
        const timer=setTimeout(()=>fail(Error('模型下載逾時')),45000);
        const fail=error=>{clearTimeout(timer);error.code='MODEL_LOAD';reject(error);};
        this.cancelLoad=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));};
        worker.onerror=e=>{this.failure=Error(e.message||'辨識程序無法啟動');fail(this.failure);};
        worker.onmessage=({data})=>{
          if(generation!==this.generation)return;
          if(data.type==='ready'){clearTimeout(timer);this.cancelLoad=null;this.ready=true;this.lastAt=performance.now();resolve();}
          if(data.type==='error'){this.failure=Error(data.message);fail(this.failure);}
          if(data.type==='result'){
            this.busy=false;this.lastAt=performance.now();
            const hands=data.hands.map(hand=>hand.map(p=>({x:1-p.x,y:p.y})));
            const result=assessHands(hands);
            if(result.points){
              result.motion=motionBetween(result.points,this.raw);
              this.points=smoothPoints(this.points,result.points);this.raw=result.points;
              result.points=this.points;
            }else{this.raw=this.points=null;}
            this.latest=result;this.unread=true;
          }
        };
        worker.postMessage({type:'init'});
      });
    }catch(error){if(generation===this.generation)this.stop();throw error;}
  }
  frame(now){
    if(this.failure)throw this.failure;
    drawHandPreview(this.ctx,now-this.lastAt<450?this.points:null,this.latest?.valid);
    if(this.video.readyState<2)return null;
    if(this.ready&&!this.busy&&now-(this.sentAt||0)>100&&this.video.currentTime!==this.videoTime){
      this.busy=true;this.sentAt=now;this.videoTime=this.video.currentTime;
      // Raw pixels only enter the detached inference canvas, never the visible one.
      const vw=this.video.videoWidth,vh=this.video.videoHeight,sw=Math.min(vw,vh*4/3),sh=sw*3/4;
      this.ictx.drawImage(this.video,(vw-sw)/2,(vh-sh)/2,sw,sh,0,0,WIDTH,HEIGHT);
      const generation=this.generation;
      createImageBitmap(this.input).then(bitmap=>{
        if(generation!==this.generation){bitmap.close();return;}
        this.ictx.clearRect(0,0,WIDTH,HEIGHT);
        this.worker.postMessage({type:'frame',time:now,bitmap},[bitmap]);
      }).catch(error=>{if(generation===this.generation){this.failure=error;this.busy=false;}});
    }
    if(this.unread){this.unread=false;return this.latest;}
    return null;
  }
  stop(){
    this.generation++;this.cancelLoad?.();this.cancelLoad=null;
    this.worker?.terminate();this.worker=null;
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.srcObject=null;
    this.ready=this.busy=this.unread=false;this.failure=this.latest=this.points=this.raw=null;this.videoTime=-1;
    drawHandPreview(this.ctx,null);this.ictx.clearRect(0,0,WIDTH,HEIGHT);
  }
}
