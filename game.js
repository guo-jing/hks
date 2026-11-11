/* Hex Arena — standalone, dependency-free survival game. */
'use strict';
const $ = id => document.getElementById(id);
const canvas = $('arena'), ctx = canvas.getContext('2d');
const W = 1000, H = 650, keys = new Set();
let state = 'ready', game, last = 0, animation = 0, toastTimer;
let best = 0;
try { best = Number(localStorage.getItem('hex-arena-best')) || 0; } catch {}
$('record').textContent = String(best).padStart(3, '0');
const augments = [
  {id:'power',name:'超载核心',symbol:'ϟ',desc:'攻击力提升 35%，让每一次命中更具威力。',apply:p=>p.damage*=1.35},
  {id:'rapid',name:'极速扳机',symbol:'»',desc:'攻击速度提升 30%，持续压制敌人。',apply:p=>p.rate*=1.3},
  {id:'multi',name:'分裂弹幕',symbol:'⋔',desc:'每次攻击额外发射一枚散射弹。',apply:p=>p.shots++},
  {id:'vital',name:'巨像之心',symbol:'♡',desc:'最大生命增加 40，并立即回复 60 生命。',apply:p=>{p.maxHp+=40;p.hp=Math.min(p.maxHp,p.hp+60);}},
  {id:'leech',name:'生命汲取',symbol:'♧',desc:'每击败一个敌人，回复 2 点生命值。',apply:p=>p.leech+=2},
  {id:'stride',name:'相位行者',symbol:'➶',desc:'移动速度提升 18%，冲刺冷却缩短 15%。',apply:p=>{p.speed*=1.18;p.dashMax*=.85;}},
  {id:'nova',name:'星界爆发',symbol:'✧',desc:'能量新星伤害提升 60%，冷却缩短 20%。',apply:p=>{p.novaDamage*=1.6;p.novaMax*=.8;}},
  {id:'magnet',name:'能量虹吸',symbol:'◎',desc:'晶体拾取范围扩大 65%，立即回复 20 生命。',apply:p=>{p.magnet*=1.65;p.hp=Math.min(p.maxHp,p.hp+20);}},
  {id:'pierce',name:'贯穿协议',symbol:'⟡',desc:'子弹额外贯穿一个目标，攻击力提升 10%。',apply:p=>{p.pierce++;p.damage*=1.1;}}
];
function reset(){
  game={time:0,kills:0,wave:1,spawn:0,fire:0,bossSpawned:false,bossDead:false,enemies:[],bullets:[],gems:[],particles:[],rings:[],chosen:{},
    player:{x:W/2,y:H/2,r:14,hp:100,maxHp:100,damage:18,rate:1.8,speed:205,shots:1,pierce:0,leech:0,magnet:85,xp:0,need:8,level:1,inv:0,dash:0,dashLeft:0,dashMax:3,nova:0,novaMax:9,novaDamage:65,dx:1,dy:0}};
  keys.clear(); stick.x=stick.y=0;
}
function start(){reset();state='playing';$('overlay').classList.add('hidden');$('pause').textContent='Ⅱ 暂停';updateHUD();toast('试炼开始 · 保持移动，收集能量');}
function toast(message){$('toast').textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').textContent='',2600);}
function updateHUD(){const p=game.player;
  $('clock').textContent=`${String(Math.floor(game.time/60)).padStart(2,'0')}:${String(Math.floor(game.time%60)).padStart(2,'0')}`;
  $('hp-text').textContent=`${Math.ceil(Math.max(0,p.hp))} / ${p.maxHp}`;$('hp-bar').style.width=`${Math.max(0,p.hp)/p.maxHp*100}%`;
  $('xp-text').textContent=`${p.xp} / ${p.need}`;$('xp-bar').style.width=`${p.xp/p.need*100}%`;
  $('level').textContent=`LV. ${p.level}`;$('damage').textContent=Math.round(p.damage);$('speed').innerHTML=`${p.rate.toFixed(1)} <small>/ 秒</small>`;
  $('kills').textContent=game.kills;$('wave').textContent=String(game.wave).padStart(2,'0');
  $('mobile-q').textContent=p.nova>0?`新星 ${Math.ceil(p.nova)}s`:'Q 新星';$('mobile-dash').textContent=p.dash>0?`冲刺 ${Math.ceil(p.dash)}s`:'冲刺';
}
function renderAugments(){const entries=Object.entries(game.chosen);$('augment-count').textContent=`${entries.reduce((n,[,v])=>n+v,0)} 已激活`;
  $('augment-list').innerHTML=entries.map(([id,count])=>{const a=augments.find(a=>a.id===id);return `<div class="augment"><span>${a.symbol}</span><div>${a.name}<small>已叠加 ${count} 层</small></div></div>`;}).join('') || '<div class="empty-aug"><span>⬡</span><p>你的传奇，从第一次强化开始</p><small>收集能量晶体，升级获得强化</small></div>';
}
function levelUp(){const p=game.player;if(p.xp<p.need)return;p.xp-=p.need;p.level++;p.need=Math.floor(p.need*1.25+3);p.hp=Math.min(p.maxHp,p.hp+12);state='choosing';keys.clear();
  const choices=[...augments].sort(()=>Math.random()-.5).slice(0,3);
  $('overlay').innerHTML=`<div class="choices"><p class="eyebrow">HEXTECH AUGMENT / LEVEL ${p.level}</p><h2>选择你的进化</h2><p>获得强化，构筑属于你的战斗方式</p><div class="choice-grid">${choices.map((a,i)=>`<button class="choice" data-choice="${i}"><small>海克斯强化 · 可叠加</small><span class="symbol">${a.symbol}</span><strong>${a.name}</strong><p>${a.desc}</p></button>`).join('')}</div></div>`;
  $('overlay').classList.remove('hidden');$('overlay').querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{const a=choices[Number(b.dataset.choice)];a.apply(p);game.chosen[a.id]=(game.chosen[a.id]||0)+1;renderAugments();state='playing';$('overlay').classList.add('hidden');updateHUD();levelUp();});updateHUD();
}
function pause(){if(state==='playing'){state='paused';keys.clear();$('pause').textContent='▶ 继续';$('overlay').innerHTML='<div class="start-content"><div class="sigil">Ⅱ</div><h2>稍作休息</h2><p>你的试炼仍在继续。</p><button class="primary" id="resume">继续战斗 →</button></div>';$('overlay').classList.remove('hidden');$('resume').onclick=pause;}else if(state==='paused'){state='playing';$('pause').textContent='Ⅱ 暂停';$('overlay').classList.add('hidden');}}
function finish(win){state='ended';best=Math.max(best,game.kills);try{localStorage.setItem('hex-arena-best',String(best));}catch{}$('record').textContent=String(best).padStart(3,'0');
  $('overlay').innerHTML=`<div class="start-content"><div class="sigil">${win?'♛':'⬡'}</div><p class="eyebrow">${win?'TRIAL COMPLETE':'ONE MORE EXPERIMENT'}</p><h2>${win?'试炼完成，传奇诞生。':'倒下，也是进化的一部分。'}</h2><p>存活 ${Math.floor(game.time)} 秒 · 击败 ${game.kills} 名敌人 · ${game.player.level} 级</p><button id="restart" class="primary">再来一局 →</button><small>尝试不同的强化组合，发现新的可能</small></div>`;$('overlay').classList.remove('hidden');$('restart').onclick=()=>{start();renderAugments();};keys.clear();
}
function burst(x,y,color,n=8){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=30+Math.random()*130;game.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.3+Math.random()*.3,color});}}
function hit(e,damage){if(e.hp<=0)return;e.hp-=damage;e.flash=.12;if(e.hp<=0){game.kills++;game.player.hp=Math.min(game.player.maxHp,game.player.hp+game.player.leech);burst(e.x,e.y,e.boss?'#e6bd76':'#a77aff',e.boss?35:8);game.gems.push({x:e.x,y:e.y,value:e.boss?25:e.tank?3:1});if(e.boss)game.bossDead=true;}}
function spawn(boss=false){const edge=Math.floor(Math.random()*4),t=Math.random();let x,y;if(edge<2){x=edge===0?-25:W+25;y=t*H;}else{x=t*W;y=edge===2?-25:H+25;}
  const tank=!boss&&Math.random()<.17,fast=!tank&&!boss&&Math.random()<.23;
  game.enemies.push({x,y,r:boss?38:tank?22:fast?10:15,hp:boss?2200:tank?65+game.wave*12:26+game.wave*6,maxHp:boss?2200:tank?65+game.wave*12:26+game.wave*6,speed:boss?58:fast?135+game.wave*4:65+game.wave*5,damage:boss?36:tank?20:12,boss,tank,fast,flash:0});
}
function dash(){if(state!=='playing')return;const p=game.player;if(p.dash>0)return;p.dash=p.dashMax;p.dashLeft=.18;p.inv=.3;burst(p.x,p.y,'#53e0d0');}
function nova(){if(state!=='playing')return;const p=game.player;if(p.nova>0)return;p.nova=p.novaMax;game.rings.push({x:p.x,y:p.y,r:0,max:185,life:.5});for(const e of game.enemies){const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<185+e.r){hit(e,p.novaDamage);if(d>0){e.x+=((e.x-p.x)/d)*45;e.y+=((e.y-p.y)/d)*45;}}}}
const stick={x:0,y:0};
function update(dt){const p=game.player;game.time+=dt;const wave=Math.min(7,1+Math.floor(game.time/30));if(wave!==game.wave){game.wave=wave;toast(`第 ${wave} 波 · 敌人正在变强`);p.hp=Math.min(p.maxHp,p.hp+15);}
  if(game.time>=180&&!game.bossSpawned){game.bossSpawned=true;spawn(true);toast('最终守卫降临 · 击败它完成试炼！');}
  if(game.bossDead){finish(true);return;}
  p.inv=Math.max(0,p.inv-dt);p.dash=Math.max(0,p.dash-dt);p.nova=Math.max(0,p.nova-dt);p.dashLeft=Math.max(0,p.dashLeft-dt);
  let mx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+stick.x,my=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+stick.y;
  const length=Math.hypot(mx,my);if(length>.05){mx/=Math.max(1,length);my/=Math.max(1,length);p.dx=mx/(Math.hypot(mx,my)||1);p.dy=my/(Math.hypot(mx,my)||1);}
  if(p.dashLeft>0){mx=p.dx*3.8;my=p.dy*3.8;}p.x=Math.max(p.r,Math.min(W-p.r,p.x+mx*p.speed*dt));p.y=Math.max(p.r,Math.min(H-p.r,p.y+my*p.speed*dt));
  game.spawn-=dt;if(game.spawn<=0&&game.enemies.length<110){spawn();game.spawn=Math.max(.22,.95-game.wave*.1);}
  game.fire-=dt;const alive=game.enemies.filter(e=>e.hp>0);if(game.fire<=0&&alive.length){const target=alive.reduce((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)<Math.hypot(b.x-p.x,b.y-p.y)?a:b);const angle=Math.atan2(target.y-p.y,target.x-p.x);for(let i=0;i<Math.min(p.shots,15);i++){const a=angle+(i-(Math.min(p.shots,15)-1)/2)*.16;game.bullets.push({x:p.x,y:p.y,vx:Math.cos(a)*520,vy:Math.sin(a)*520,life:2,hits:new Set(),left:1+p.pierce});}game.fire=1/p.rate;}
  for(const e of alive){e.flash=Math.max(0,e.flash-dt);const d=Math.hypot(p.x-e.x,p.y-e.y)||1;e.x+=(p.x-e.x)/d*e.speed*dt;e.y+=(p.y-e.y)/d*e.speed*dt;if(d<e.r+p.r&&p.inv<=0){p.hp-=e.damage;p.inv=.65;burst(p.x,p.y,'#ff7791');if(p.hp<=0){updateHUD();finish(false);return;}}}
  for(const b of game.bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;for(const e of alive){if(e.hp>0&&b.left>0&&!b.hits.has(e)&&Math.hypot(b.x-e.x,b.y-e.y)<e.r+5){b.hits.add(e);hit(e,p.damage);b.left--;if(b.left<=0)b.life=0;}}}
  game.bullets=game.bullets.filter(b=>b.life>0);game.enemies=game.enemies.filter(e=>e.hp>0);
  for(const g of game.gems){const d=Math.hypot(g.x-p.x,g.y-p.y);if(d<p.magnet&&d>0){const step=Math.min(d,350*dt);g.x+=(p.x-g.x)/d*step;g.y+=(p.y-g.y)/d*step;}if(Math.hypot(g.x-p.x,g.y-p.y)<p.r+8){p.xp+=g.value;g.collected=true;}}
  game.gems=game.gems.filter(g=>!g.collected);if(game.gems.length>450){const g=game.gems.shift();game.gems[0].value+=g.value;}
  for(const f of game.particles){f.x+=f.vx*dt;f.y+=f.vy*dt;f.life-=dt;}game.particles=game.particles.filter(f=>f.life>0);for(const r of game.rings){r.life-=dt;r.r=r.max*(1-r.life/.5);}game.rings=game.rings.filter(r=>r.life>0);levelUp();updateHUD();
}
function polygon(x,y,r,sides,rotation=0){ctx.beginPath();for(let i=0;i<sides;i++){const a=i*Math.PI*2/sides+rotation;ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}ctx.closePath();}
function draw(){const sx=canvas.width/W,sy=canvas.height/H;ctx.setTransform(sx,0,0,sy,0,0);ctx.fillStyle='#0c1724';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#233448';ctx.lineWidth=.65;for(let x=-30;x<W+50;x+=60){for(let y=-30;y<H+50;y+=52){polygon(x+(Math.round(y/52)%2)*30,y,34,6,Math.PI/6);ctx.stroke();}}
  const grad=ctx.createRadialGradient(W/2,H/2,100,W/2,H/2,600);grad.addColorStop(0,'#102c351f');grad.addColorStop(1,'#030914d9');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#55747845';ctx.lineWidth=2;ctx.strokeRect(24,24,W-48,H-48);for(const [x,y] of [[24,24],[W-24,24],[24,H-24],[W-24,H-24]]){ctx.fillStyle='#ba9c64';polygon(x,y,7,4);ctx.fill();}
  if(!game)return;
  for(const g of game.gems){ctx.fillStyle='#53e0d0';polygon(g.x,g.y,5,4);ctx.fill();}
  for(const r of game.rings){ctx.globalAlpha=r.life*2;ctx.strokeStyle='#65f5df';ctx.lineWidth=5;ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
  for(const e of game.enemies){ctx.fillStyle=e.flash>0?'#ffffff':e.boss?'#8d5939':e.tank?'#554b7c':e.fast?'#904761':'#654c91';ctx.strokeStyle=e.boss?'#ffce85':e.fast?'#fa8ea1':'#b39adf';ctx.lineWidth=e.boss?3:1.5;polygon(e.x,e.y,e.r,e.boss?6:e.tank?4:3,Math.atan2(game.player.y-e.y,game.player.x-e.x));ctx.fill();ctx.stroke();ctx.fillStyle='#f3b8d4';ctx.beginPath();ctx.arc(e.x,e.y,3,0,Math.PI*2);ctx.fill();if(e.hp<e.maxHp||e.boss){ctx.fillStyle='#263144';ctx.fillRect(e.x-e.r,e.y-e.r-10,e.r*2,4);ctx.fillStyle=e.boss?'#e6bd76':'#bd85c8';ctx.fillRect(e.x-e.r,e.y-e.r-10,e.r*2*Math.max(0,e.hp/e.maxHp),4);}}
  ctx.shadowColor='#58e2db';ctx.shadowBlur=12;for(const b of game.bullets){ctx.fillStyle='#aaffec';ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;
  const p=game.player;ctx.globalAlpha=p.inv>0?.5+Math.sin(performance.now()/40)*.25:1;ctx.fillStyle='#173844';ctx.strokeStyle='#69f0de';ctx.lineWidth=2;polygon(p.x,p.y,19,6,Math.PI/6);ctx.fill();ctx.stroke();ctx.fillStyle='#c1fff0';polygon(p.x,p.y,10,4);ctx.fill();ctx.globalAlpha=1;
  for(const f of game.particles){ctx.globalAlpha=Math.min(1,f.life*3);ctx.fillStyle=f.color;ctx.fillRect(f.x-2,f.y-2,4,4);}ctx.globalAlpha=1;
  if(state!=='ready'){drawSkill(40,H-40,'冲刺',p.dash,p.dashMax);drawSkill(165,H-40,'Q 新星',p.nova,p.novaMax);if(game.bossSpawned){ctx.fillStyle='#e6bd76';ctx.font='14px sans-serif';ctx.textAlign='right';ctx.fillText('最终试炼 · 击败守卫',W-40,50);}}
}
function drawSkill(x,y,label,cool,max){ctx.fillStyle='#091321d9';ctx.fillRect(x,y-16,112,30);ctx.fillStyle=cool>0?'#6c7f94':'#80e5d3';ctx.font='12px sans-serif';ctx.textAlign='left';ctx.fillText(`${label}  ${cool>0?Math.ceil(cool)+'s':'就绪'}`,x+8,y+3);ctx.fillStyle='#53e0d0';ctx.fillRect(x,y+13,112*(1-cool/max),2);}
function frame(now){const dt=Math.min((now-last)/1000,.033);last=now;if(state==='playing')update(dt);draw();animation=requestAnimationFrame(frame);}
function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);}
window.addEventListener('keydown',e=>{if($('help-dialog').open)return;const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(e.repeat)return;keys.add(k);if(k==='p'||k==='escape')pause();if(k===' ')dash();if(k==='q')nova();});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();stick.x=stick.y=0;if(state==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();});
$('start').onclick=()=>{start();renderAugments();};$('pause').onclick=pause;$('help').onclick=()=>{if(state==='playing')pause();$('help-dialog').showModal();};$('close-help').onclick=()=>$('help-dialog').close();$('mobile-q').onclick=nova;$('mobile-dash').onclick=dash;
let pointer=null;const stickEl=$('stick');function moveStick(e){if(e.pointerId!==pointer)return;const r=stickEl.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,d=Math.max(35,Math.hypot(x,y));stick.x=x/d;stick.y=y/d;stickEl.firstElementChild.style.transform=`translate(${stick.x*27}px,${stick.y*27}px)`;}
stickEl.addEventListener('pointerdown',e=>{pointer=e.pointerId;stickEl.setPointerCapture(pointer);moveStick(e);});stickEl.addEventListener('pointermove',moveStick);function releaseStick(){pointer=null;stick.x=stick.y=0;stickEl.firstElementChild.style.transform='';}stickEl.addEventListener('pointerup',releaseStick);stickEl.addEventListener('pointercancel',releaseStick);
new ResizeObserver(resize).observe(canvas);resize();animation=requestAnimationFrame(frame);
