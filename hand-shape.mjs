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
function convexHull(points){
  const sorted=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y);
  const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const half=list=>{const h=[];for(const p of list){while(h.length>1&&cross(h[h.length-2],h[h.length-1],p)<=0)h.pop();h.push(p);}h.pop();return h;};
  return [...half(sorted),...half(sorted.slice().reverse())];
}
// One anatomical approximation shared by the screen-space preview and sculpture.
// All radii describe soft tissue around the tracked joint centres, not measured skin.
function shapeFromJoints(p){
  const wrist=p[0],dx=p[9].x-wrist.x,dy=p[9].y-wrist.y;
  const length=Math.max(1e-6,Math.hypot(dx,dy)),ux=dx/length,uy=dy/length;
  const span=Math.max(1e-6,Math.hypot(p[5].x-p[17].x,p[5].y-p[17].y));
  // MCP centres can substantially understate palm width in an oblique view.
  // Use palm length as a bounded second estimate; never move the joint centres.
  const width=Math.max(span,Math.min(span*1.5,length*.95));
  const centre={x:wrist.x+ux*length*.51,y:wrist.y+uy*length*.51};
  const cloud=[];
  // A rounded heel and full palm sides replace the triangular wrist envelope.
  for(let i=0;i<32;i++){
    const a=i*Math.PI/16,across=Math.cos(a)*width*.59,along=Math.sin(a)*length*.56;
    cloud.push({x:centre.x-uy*across+ux*along,y:centre.y+ux*across+uy*along});
  }
  for(const index of [5,9,13,17])for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    cloud.push({x:p[index].x+Math.cos(a)*width*.09,y:p[index].y+Math.sin(a)*width*.09});
  }
  const palm=convexHull(cloud),capsules=[];
  const radii={1:.18,5:.17,9:.18,13:.17,17:.14};
  for(const base of [1,5,9,13,17]){
    const r=width*radii[base],tip=p[base+3];
    const nearest=Math.min(...[1,5,9,13,17].filter(b=>b!==base).map(b=>Math.hypot(tip.x-p[b+3].x,tip.y-p[b+3].y)));
    const tipRadius=Math.min(r*.82,nearest*.44),sizes=[r,r*.95,Math.min(r*.88,tipRadius*1.1),tipRadius];
    for(let j=0;j<3;j++)capsules.push([p[base+j],p[base+j+1],sizes[j],sizes[j+1]]);
  }
  // Thenar mound: join thumb root to the palm without extending the finger tips.
  const thumbRoot={x:(wrist.x+p[1].x)*.5,y:(wrist.y+p[1].y)*.5};
  capsules.push([thumbRoot,p[2],width*.25,width*.17]);
  return {palm,capsules};
}
export function handGeometry(points,width=4/3,height=1){
  return shapeFromJoints(points.map(p=>({x:p.x*width,y:p.y*height})));
}
// Orient and fit the complete soft-tissue outline, not only the joint bounds.
export function landmarksToMask(points,size=257){
  const source=points.map(p=>({x:p.x*4/3,y:p.y}));
  const wrist=source[0],middle=source[9],angle=-Math.PI/2-Math.atan2(middle.y-wrist.y,middle.x-wrist.x);
  const cs=Math.cos(angle),sn=Math.sin(angle);
  const joints=source.map(q=>({x:(q.x-wrist.x)*cs-(q.y-wrist.y)*sn,y:(q.x-wrist.x)*sn+(q.y-wrist.y)*cs}));
  const shape=shapeFromJoints(joints),extents=shape.palm.slice();
  for(const[a,b,ra,rb]of shape.capsules)for(const[p,r]of [[a,ra],[b,rb]])
    extents.push({x:p.x-r,y:p.y-r},{x:p.x+r,y:p.y+r});
  const x0=Math.min(...extents.map(p=>p.x)),x1=Math.max(...extents.map(p=>p.x));
  const y0=Math.min(...extents.map(p=>p.y)),y1=Math.max(...extents.map(p=>p.y));
  const scale=.76*(size-1)/Math.max(x1-x0,y1-y0);
  const fit=p=>({x:(p.x-(x0+x1)/2)*scale+(size-1)/2,y:(p.y-(y0+y1)/2)*scale+(size-1)/2});
  const palm=shape.palm.map(fit),capsules=shape.capsules.map(([a,b,ra,rb])=>[fit(a),fit(b),ra*scale,rb*scale]);
  const mask=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)
    if(inPolygon(x,y,palm)||capsules.some(args=>inCapsule(x,y,...args)))mask[y*size+x]=1;
  return mask;
}
