// Ground-space geometry projected through the battle camera, so previews track
// camera zoom and match the simulation even on a narrow touch viewport.
export function skillPreview(game, options) {
 const p=game.player,key=options.armed||options.previewSkill;
 if(options.state!=='playing'||p.dead||!['q','w','e','r'].includes(key))return null;
 const world=options.world,aim=options.pointer;
 const target={x:Math.max(65,Math.min(world.w-65,aim.x)),y:Math.max(world.top+20,Math.min(world.bottom-20,aim.y))};
 const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy),angle=d>.001?Math.atan2(dy,dx):0;
 const range=key==='q'?p.qRange:key==='e'?p.dashRange:key==='r'?options.skills.r.range:45;
 const length=Math.min(d,range),end={x:Math.max(65,Math.min(world.w-65,p.x+Math.cos(angle)*length)),y:Math.max(world.top+25,Math.min(world.bottom-25,p.y+Math.sin(angle)*length))};
 return {key,p,angle,range,end,length,blocked:p.cool[key]>0||!p.ranks[key]||p.mana<options.skills[key].cost,outOfRange:d>range+.5};
}
export function drawSkillIndicators(renderer,game,options){
 const preview=skillPreview(game,options);renderer.skillPreview=preview;if(!preview)return;
 const {key,p,angle,range,end,blocked,outOfRange}=preview,c=renderer.labelCtx,time=performance.now()/1000;
 const color=blocked?'#ff8b94':key==='r'?'#f5d491':'#88f5e0';
 const project=(x,y)=>renderer.worldToScreen(x,y,5);
 const path=(points,{fill=false,dash=false,width=1.5,alpha=1,close=false}={})=>{c.save();c.beginPath();points.forEach((p,i)=>{const s=project(p.x,p.y);i?c.lineTo(s.x,s.y):c.moveTo(s.x,s.y);});if(close)c.closePath();c.globalAlpha=alpha;c.strokeStyle=color;c.fillStyle=color;c.lineWidth=width;c.lineJoin='round';if(dash){c.setLineDash([6,7]);c.lineDashOffset=-time*15;}if(fill){c.globalAlpha=alpha*.12;c.fill();c.globalAlpha=alpha;}c.shadowColor=color;c.shadowBlur=5;c.stroke();c.restore();};
 const arc=(center,r,start=0,span=Math.PI*2,n=80)=>Array.from({length:n+1},(_,i)=>({x:center.x+Math.cos(start+span*i/n)*r,y:center.y+Math.sin(start+span*i/n)*r}));
 const point=(forward,side)=>({x:p.x+Math.cos(angle)*forward-Math.sin(angle)*side,y:p.y+Math.sin(angle)*forward+Math.cos(angle)*side});
 c.save();
 if(key==='q'){
  const edge=arc(p,range,angle-1.15,2.3,48);path([p,...edge],{fill:true,close:true,width:2});path(arc(p,range*.78,angle-1.15,2.3,48),{dash:true,alpha:.45});
  path([point(24,0),point(range-10,0)],{dash:true,alpha:.6});path([point(range-26,-10),point(range-10,0),point(range-26,10)],{width:2});
 }else if(key==='e'){
  path(arc(p,range),{dash:true,alpha:.3});
  const nx=-Math.sin(angle)*28,ny=Math.cos(angle)*28;
  path([{x:p.x+nx,y:p.y+ny},{x:end.x+nx,y:end.y+ny},{x:end.x-nx,y:end.y-ny},{x:p.x-nx,y:p.y-ny}],{close:true,fill:true,width:2});
  path([p,end],{dash:true,alpha:.7});path(arc(end,21),{width:2});
  for(let i=0;i<3;i++){const f=Math.max(0,preview.length-22-i*32);if(f<12)continue;path([point(f-12,-10),point(f,0),point(f-12,10)],{alpha:.5+.4*Math.sin(time*4-i)**2,width:2});}
 }else if(key==='r'){
  path(arc(p,range),{dash:true,alpha:.35});path([p,end],{dash:true,alpha:.65});
  path(arc(end,p.ultRadius),{fill:true,width:2.5});path(arc(end,p.ultRadius*.86),{dash:true,alpha:.45});
  path(arc(end,p.ultRadius*(.3+(time*.4)% .6)),{alpha:.2});
  for(let i=0;i<4;i++){const a=i*Math.PI/2;path([{x:end.x+Math.cos(a)*18,y:end.y+Math.sin(a)*18},{x:end.x+Math.cos(a)*34,y:end.y+Math.sin(a)*34}],{width:2});}
 }else{path(arc(p,45),{fill:true,width:2});path(arc(p,55),{dash:true,alpha:.45});}
 const at=project(key==='q'?point(range+24,0).x:end.x,key==='q'?point(range+24,0).y:end.y);
 const reason=!p.ranks[key]?'尚未学习':p.cool[key]>0?`冷却 ${Math.ceil(p.cool[key])} 秒`:p.mana<options.skills[key].cost?'法力不足':key==='r'&&outOfRange?'超出距离 · 将在边界施放':options.armed?'左键施放 · Esc 取消':'点击技能进入瞄准';
 c.font='600 11px system-ui';const text=`${key.toUpperCase()} · ${options.skills[key].name}  ${reason}`,w=c.measureText(text).width+20;
 const x=Math.max(w/2+8,Math.min(renderer.width-w/2-8,at.x)),y=Math.max(24,Math.min(renderer.height-28,at.y+34));
 c.fillStyle='#071722ed';c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.roundRect(x-w/2,y-13,w,26,4);c.fill();c.globalAlpha=.7;c.stroke();c.globalAlpha=1;c.textAlign='center';c.fillStyle=color;c.fillText(text,x,y+4);c.restore();
}
