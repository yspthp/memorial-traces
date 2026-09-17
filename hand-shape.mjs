import { clamp } from './relief.mjs';
export const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
const dist = (a,b) => Math.hypot((a.x-b.x)*4/3,a.y-b.y);
export function assessHands(hands) {
  if (!hands?.length) return {present:false,valid:false,reason:'請把一隻手放入框內，掌心朝向鏡頭。'};
  if (hands.length !== 1) return {present:true,valid:false,reason:'請一次只放入一隻手。'};
  const p=hands[0];
  if(p.length!==21||p.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y)))
    return {present:false,valid:false,reason:'手部暫時被遮擋，請重新放入框內。'};
  const width=dist(p[5],p[17]);
  let reason='';
  if(p.some(q=>q.x<.035||q.x>.965||q.y<.035||q.y>.965)) reason='請退後少少，讓手掌及所有指尖完整入鏡。';
  else if(width<.12) reason='請把手掌移近一點。';
  else {
    const open=[5,9,13,17].filter(i=>dist(p[i+3],p[0])>dist(p[i+1],p[0])*1.12).length;
    const spread=Math.min(dist(p[8],p[12]),dist(p[12],p[16]),dist(p[16],p[20]))/width;
    if(open<4||dist(p[4],p[5])<width*.5||spread<.17) reason='請自然張開五指，不需要用力伸直。';
    else if(width/dist(p[0],p[9])<.55) reason='請把掌心轉向鏡頭，避免側着手掌。';
  }
  return {present:true,valid:!reason,points:p,reason:reason||'已找到手掌，保持自然停留即可。'};
}
export function motionBetween(a,b) {
  if(!a||!b)return 0;
  return Math.sqrt(a.reduce((sum,p,i)=>sum+dist(p,b[i])**2,0)/21)/Math.max(.12,dist(b[5],b[17]));
}
export function smoothPoints(previous,points) {
  return points.map((p,i)=>({x:previous?previous[i].x*.55+p.x*.45:p.x,y:previous?previous[i].y*.55+p.y*.45:p.y}));
}
// Only fresh, stable samples count. Brief losses PAUSE; they never count as held time.
export class HoldGate {
  constructor(required=3000,grace=900){this.required=required;this.grace=grace;this.reset();}
  reset(){this.elapsed=0;this.last=null;this.lastGood=null;this.wasGood=false;}
  update(now,good){
    const dt=this.last===null?0:Math.min(200,Math.max(0,now-this.last));
    if(this.lastGood!==null&&now-this.lastGood>this.grace){this.elapsed=0;this.wasGood=false;}
    if(good){if(this.wasGood)this.elapsed+=dt;this.lastGood=now;}
    this.wasGood=good;this.last=now;
    return {progress:clamp(this.elapsed/this.required),complete:this.elapsed>=this.required};
  }
}
function inPolygon(x,y,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
function inCapsule(x,y,a,b,ra,rb){
  const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1));
  return Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<ra+(rb-ra)*t;
}
// Approximate shape from joints, not pixel segmentation or biometric palm detail.
export function landmarksToMask(points,size=257){
  const source=points.map(p=>({x:p.x*4/3,y:p.y}));
  const wrist=source[0],middle=source[9],angle=-Math.PI/2-Math.atan2(middle.y-wrist.y,middle.x-wrist.x);
  const cs=Math.cos(angle),sn=Math.sin(angle);
  let p=source.map(q=>({x:(q.x-wrist.x)*cs-(q.y-wrist.y)*sn,y:(q.x-wrist.x)*sn+(q.y-wrist.y)*cs}));
  const pw=Math.hypot(p[5].x-p[17].x,p[5].y-p[17].y);
  const x0=Math.min(...p.map(q=>q.x))-.15*pw,x1=Math.max(...p.map(q=>q.x))+.15*pw;
  const y0=Math.min(...p.map(q=>q.y))-.15*pw,y1=Math.max(...p.map(q=>q.y))+.15*pw;
  const scale=.76*(size-1)/Math.max(x1-x0,y1-y0);
  p=p.map(q=>({x:(q.x-(x0+x1)/2)*scale+(size-1)/2,y:(q.y-(y0+y1)/2)*scale+(size-1)/2}));
  const width=pw*scale,w=p[0],left={x:w.x-width*.28,y:w.y},right={x:w.x+width*.28,y:w.y};
  const mcps=[p[5],p[9],p[13],p[17]].sort((a,b)=>a.x-b.x);
  const palm=[left,...mcps,right],capsules=[];
  for(const base of [1,5,9,13,17]) for(let j=0;j<3;j++)
    capsules.push([p[base+j],p[base+j+1],width*(base===1?.13:.105)*(1-j*.13),width*(base===1?.13:.105)*(1-(j+1)*.13)]);
  capsules.push([p[0],p[2],width*.23,width*.13]);
  const mask=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)
    if(inPolygon(x,y,palm)||capsules.some(args=>inCapsule(x,y,...args)))mask[y*size+x]=1;
  return mask;
}
