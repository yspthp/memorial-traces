import {handGeometry,CONNECTIONS} from './hand-shape.mjs';
// Deliberately accepts ONLY landmarks and state, never a video or source canvas.
export function drawHandPreview(ctx,points,valid=false){
  const width=ctx.canvas.width,height=ctx.canvas.height;
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.setLineDash([]);
  ctx.fillStyle='#132021';ctx.fillRect(0,0,width,height);
  ctx.strokeStyle='#627b73';ctx.lineWidth=1;ctx.setLineDash([6,5]);
  ctx.strokeRect(width*.05,height*.05,width*.9,height*.9);ctx.setLineDash([]);
  if(!points)return;
  const {palm,capsules}=handGeometry(points,width,height);
  ctx.fillStyle=valid?'#285e50':'#665333';
  ctx.beginPath();palm.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();
  for(const[a,b,ra,rb]of capsules){
    const length=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;
    ctx.beginPath();ctx.moveTo(a.x+nx*ra,a.y+ny*ra);ctx.lineTo(b.x+nx*rb,b.y+ny*rb);
    ctx.lineTo(b.x-nx*rb,b.y-ny*rb);ctx.lineTo(a.x-nx*ra,a.y-ny*ra);ctx.closePath();ctx.fill();
    for(const[p,r]of [[a,ra],[b,rb]]){ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();}
  }
  ctx.strokeStyle=ctx.fillStyle=valid?'#71f0bc':'#ffd086';ctx.lineWidth=2;
  for(const[a,b]of CONNECTIONS){
    ctx.beginPath();ctx.moveTo(points[a].x*width,points[a].y*height);ctx.lineTo(points[b].x*width,points[b].y*height);ctx.stroke();
  }
  for(const p of points){ctx.beginPath();ctx.arc(p.x*width,p.y*height,2.5,0,Math.PI*2);ctx.fill();}
}
