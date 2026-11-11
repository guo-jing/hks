'use strict';
// Original single-lane MOBA: click orders, melee combat, allied waves and objectives.
const $ = id => document.getElementById(id);
const canvas=$('arena'),ctx=canvas.getContext('2d'),mini=$('minimap'),mc=mini.getContext('2d');
const WORLD={w:2400,h:1200,top:325,bottom:875},pointer={x:700,y:600,sx:null,sy:null},view={w:1200,h:650,scale:1,x:0,y:0};
let state='ready',game,last=0,animation,uid=0,toastTimer,selected=null,armed=null,coarse=matchMedia('(pointer:coarse)').matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),living=u=>u&&u.hp>0&&!u.dead;
const skills={q:{name:'破风斩',icon:'⚔',cost:35,cd:4,range:145,desc:'朝鼠标挥剑，扇形伤害'},w:{name:'坚毅壁垒',icon:'⬡',cost:45,cd:10,range:0,desc:'获得 3 秒护盾'},e:{name:'逐影突进',icon:'➶',cost:40,cd:8,range:220,desc:'向鼠标突进，伤害沿途敌人'},r:{name:'天坠裁决',icon:'✦',cost:90,cd:25,range:390,desc:'跃向指定区域，范围伤害与减速'}};
const augments=[
 {id:'edge',name:'无尽锋芒',symbol:'⚔',desc:'攻击力提升 25%，普攻与技能同步增强。',apply:p=>p.damage*=1.25},
 {id:'haste',name:'疾风剑意',symbol:'»',desc:'攻击速度提升 25%，技能冷却缩短 12%。',apply:p=>{p.rate*=1.25;p.haste*=.88;}},
 {id:'heart',name:'巨像之心',symbol:'♡',desc:'最大生命增加 220，立即回复 220 生命。',apply:p=>{p.maxHp+=220;p.hp=Math.min(p.maxHp,p.hp+220);}},
 {id:'leech',name:'饮血之刃',symbol:'♧',desc:'普攻和技能对单位造成伤害时，回复伤害的 10%。',apply:p=>p.leech+=.1},
 {id:'cleave',name:'风暴剑域',symbol:'◔',desc:'Q 的扇形范围扩大 20%，伤害提升 25%。',apply:p=>{p.qRange*=1.2;p.qPower*=1.25;}},
 {id:'shield',name:'不灭壁垒',symbol:'⬡',desc:'W 护盾提升 50%，开启时回复 80 生命。',apply:p=>{p.shieldPower*=1.5;p.shieldHeal+=80;}},
 {id:'stride',name:'逐影之靴',symbol:'➶',desc:'移动速度提升 12%，突进距离增加 15%。',apply:p=>{p.speed*=1.12;p.dashRange*=1.15;}},
 {id:'ult',name:'天罚降临',symbol:'✦',desc:'R 的范围扩大 20%，伤害提升 35%。',apply:p=>{p.ultRadius*=1.2;p.ultPower*=1.35;}},
 {id:'mana',name:'奥术循环',symbol:'◎',desc:'最大法力增加 150，法力回复提升 80%。',apply:p=>{p.maxMana+=150;p.mana=p.maxMana;p.manaRegen*=1.8;}}
];
const items=[
 {id:'sword',name:'精铸长剑',icon:'⚔',cost:300,desc:'攻击力 +22',apply:p=>p.damage+=22},
 {id:'armor',name:'守护铠甲',icon:'⬡',cost:300,desc:'最大生命 +200，回复 200 生命',apply:p=>{p.maxHp+=200;p.hp=Math.min(p.maxHp,p.hp+200);}},
 {id:'boots',name:'轻灵战靴',icon:'➶',cost:250,desc:'移速 +20，攻击速度 +15%',apply:p=>{p.speed+=20;p.rate*=1.15;}}
];
function unit(team,kind,x,y){const hero=kind==='hero',tower=kind==='tower',core=kind==='core';const hp=hero?720:tower?1650:core?2000:kind==='caster'?115:180;
 return {id:++uid,team,kind,x,y,r:hero?20:tower?34:core?44:12,hp,maxHp:hp,damage:hero?58:tower?95:kind==='caster'?18:25,rate:hero?1.1:tower?.8:.85,range:hero?78:tower?285:kind==='caster'?180:35,speed:hero?235:kind==='caster'?90:105,cd:0,face:team===0?0:Math.PI,attackAnim:0,flash:0,slow:0,shield:0,shieldTime:0,dead:0,target:null,order:null,walk:0,aggro:0};
}
function reset(){uid=0;const p=unit(0,'hero',245,600);Object.assign(p,{name:'苍锋',mana:300,maxMana:300,manaRegen:6,xp:0,need:120,level:1,leech:0,haste:1,qRange:145,qPower:1,shieldPower:1,shieldHeal:0,dashRange:220,ultRadius:145,ultPower:1,cool:{q:0,w:0,e:0,r:0}});
 const rival=unit(1,'hero',2155,600);Object.assign(rival,{name:'赤刃',skillCd:4,level:1});
 game={time:0,player:p,rival,units:[p,rival,unit(0,'tower',650,600),unit(1,'tower',1750,600),unit(0,'core',150,600),unit(1,'core',2250,600)],wave:0,spawn:1,gold:300,cs:0,kills:0,deaths:0,assists:0,score:[0,0],chosen:{},items:{},effects:[],shots:[],texts:[],marker:null,cameraLocked:true};
 selected=null;armed=null;view.x=clamp(p.x-view.w/2,0,WORLD.w-view.w);view.y=clamp(p.y-view.h/2,0,WORLD.h-view.h);
}
function start(){reset();state='playing';$('overlay').classList.add('hidden');$('pause').textContent='Ⅱ 暂停';$('order').textContent='右键下达移动或攻击指令';renderAugments();updateHUD();toast('右键移动或攻击 · QWER 施放技能 · 跟随兵线推进');canvas.focus({preventScroll:true});}
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);}
function textAt(u,text,color='#ffe3a6'){game.texts.push({x:u.x,y:u.y-35,text,color,life:1});}
function effect(type,x,y,options={}){game.effects.push({type,x,y,life:.4,maxLife:.4,...options});}
function enemies(u){return game.units.filter(e=>living(e)&&e.team!==u.team);}
function towerFor(team){return game.units.find(u=>u.kind==='tower'&&u.team===team&&living(u));}
function protectedCore(u){return u.kind==='core'&&!!towerFor(u.team);}
function reward(victim,source){const p=game.player;if(victim.team===1&&dist(p,victim)<780&&!p.dead){p.xp+=victim.kind==='hero'?150:victim.kind==='tower'?200:32;}
 if(source===p){const gold=victim.kind==='hero'?250:victim.kind==='tower'?200:victim.kind==='core'?0:25;game.gold+=gold;textAt(victim,`+${gold} 金`);if(['melee','caster'].includes(victim.kind))game.cs++;}
 if(victim.kind==='hero'){game.score[1-victim.team]++;if(victim===p){game.deaths++;p.order=null;armed=null;toast('你已阵亡 · 即将在泉水复活');}else{if(source===p)game.kills++;else{game.assists++;game.gold+=100;}toast('敌方英雄已被击败 · 抓住机会推进！');}victim.dead=8+Math.floor(game.time/90)*2;victim.hp=0;victim.target=null;victim.order=null;}
 if(victim.kind==='tower'){toast(victim.team===1?'敌方防御塔已摧毁 · 进攻水晶！':'己方防御塔已失守 · 保护水晶！');effect('blast',victim.x,victim.y,{radius:95,color:'#eac98d',life:.8,maxLife:.8});}
 if(victim.kind==='core')finish(victim.team===1);
}
function damage(target,amount,source){if(!living(target)||protectedCore(target))return 0;let dealt=amount;if(target.shield>0){const absorb=Math.min(amount,target.shield);target.shield-=absorb;dealt-=absorb;}const actual=Math.min(target.hp,dealt);target.hp-=dealt;target.flash=.15;
 if(dealt>0)textAt(target,Math.round(dealt),target.team===0?'#ffc2b4':'#ffe8af');
 if(source===game.player&&source.leech&&target.kind!=='tower'&&target.kind!=='core')source.hp=Math.min(source.maxHp,source.hp+actual*source.leech);
 if(source?.kind==='hero'&&target.kind==='hero'){const tower=towerFor(target.team);if(tower&&dist(tower,source)<tower.range+source.r){tower.target=source;tower.aggro=3;}}
 if(target.hp<=0)reward(target,source);return actual;
}
function issue(point,target=null){if(state!=='playing'||game.player.dead)return;const p=game.player;if(target&&protectedCore(target)){toast('先摧毁防御塔，才能攻击水晶');return;}p.target=target;p.order=target?{type:'attack',target}:{type:'move',x:point.x,y:point.y};game.marker={x:point.x,y:point.y,life:.65,attack:!!target};$('order').textContent=target?`攻击：${unitName(target)}`:'移动至指定位置';}
function unitName(u){return u.kind==='hero'?u.name:u.kind==='tower'?'防御塔':u.kind==='core'?'水晶':u.kind==='caster'?'法师小兵':'近战小兵';}
function move(u,x,y,dt,stop=0){const dx=x-u.x,dy=y-u.y,d=Math.hypot(dx,dy);if(d<=stop+1)return true;const step=Math.min(d-stop,u.speed*(u.slow>0?.55:1)*dt);u.x=clamp(u.x+dx/d*step,65,WORLD.w-65);u.y=clamp(u.y+dy/d*step,WORLD.top+u.r,WORLD.bottom-u.r);u.face=Math.atan2(dy,dx);u.walk+=dt*10;return false;}
function attack(u,t){if(u.cd>0||!living(t)||protectedCore(t))return;u.cd=1/u.rate;u.face=Math.atan2(t.y-u.y,t.x-u.x);u.attackAnim=.28;
 if(u.kind==='tower'||u.kind==='caster'){game.shots.push({x:u.x,y:u.y-20,target:t,source:u,damage:u.damage,speed:u.kind==='tower'?500:370,color:u.team===0?'#7edcff':'#ff8c91'});}else{damage(t,u.damage,u);effect('slash',u.x,u.y,{angle:u.face,radius:u.range,color:u.team===0?'#b8f6ee':'#ffb1aa',life:.22,maxLife:.22});}
}
function pointAlong(origin,point,max){const d=dist(origin,point),a=Math.atan2(point.y-origin.y,point.x-origin.x);return{x:clamp(origin.x+Math.cos(a)*Math.min(d,max),65,WORLD.w-65),y:clamp(origin.y+Math.sin(a)*Math.min(d,max),WORLD.top+25,WORLD.bottom-25)};}
function distanceToSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function cast(key,point=pointer){if(state!=='playing'||game.player.dead)return false;const p=game.player,s=skills[key];if(!s||p.cool[key]>0)return false;if(p.mana<s.cost){toast('法力不足，返回泉水恢复');return false;}p.mana-=s.cost;p.cool[key]=s.cd*p.haste;armed=null;p.face=Math.atan2(point.y-p.y,point.x-p.x);
 if(key==='q'){p.attackAnim=.3;effect('slash',p.x,p.y,{angle:p.face,radius:p.qRange,color:'#b8fff1',life:.3,maxLife:.3});for(const e of enemies(p)){let a=Math.atan2(e.y-p.y,e.x-p.x)-p.face;a=Math.atan2(Math.sin(a),Math.cos(a));if(dist(p,e)<p.qRange+e.r&&Math.abs(a)<1.15)damage(e,(60+p.damage*1.1)*p.qPower,p);}}
 if(key==='w'){p.shield=(140+p.level*18)*p.shieldPower;p.shieldTime=3;p.hp=Math.min(p.maxHp,p.hp+p.shieldHeal);effect('shield',p.x,p.y,{radius:45,color:'#8bccff',life:.5,maxLife:.5});textAt(p,`护盾 +${Math.round(p.shield)}`,'#9dd9ff');}
 if(key==='e'){const from={x:p.x,y:p.y},to=pointAlong(p,point,p.dashRange);p.x=to.x;p.y=to.y;p.order=null;p.target=null;effect('dash',from.x,from.y,{to,color:'#8ee7e8',life:.35,maxLife:.35});for(const e of enemies(p))if(distanceToSegment(e,from,to)<e.r+28)damage(e,45+p.damage*.8,p);}
 if(key==='r'){const to=pointAlong(p,point,skills.r.range);p.order=null;p.target=null;game.effects.push({type:'ultimate',x:to.x,y:to.y,radius:p.ultRadius,color:'#ebd29d',life:.7,maxLife:.7,source:p,power:(160+p.damage*1.5)*p.ultPower});toast('天坠裁决！');}
 updateHUD();return true;
}
function aiHero(u,dt){const p=game.player,home={x:2155,y:600};u.skillCd-=dt;
 if(u.hp<u.maxHp*.28){move(u,home.x,home.y,dt,10);return;}
 let target=living(u.target)&&dist(u,u.target)<480?u.target:null;const threats=enemies(u).filter(e=>!protectedCore(e)&&dist(u,e)<390).sort((a,b)=>{const sa=dist(u,a)-(a===p?70:0),sb=dist(u,b)-(b===p?70:0);return sa-sb;});if(!target)target=threats[0];
 const enemyTower=towerFor(0),alliedMinions=game.units.filter(e=>e.team===1&&['melee','caster'].includes(e.kind)&&living(e));
 if(enemyTower&&dist(u,enemyTower)<enemyTower.range+70&&!alliedMinions.some(m=>dist(m,enemyTower)<enemyTower.range)){move(u,enemyTower.x+enemyTower.range+100,600,dt,10);u.target=null;return;}
 if(target){u.target=target;if(dist(u,target)>u.range+target.r)move(u,target.x,target.y,dt,u.range+target.r-5);else attack(u,target);
  if(target.kind==='hero'&&dist(u,target)<220&&u.skillCd<=0){u.skillCd=7;effect('enemySpell',target.x,target.y,{radius:85,color:'#f78585',life:.8,maxLife:.8,source:u,power:95+u.level*8});}
 }else{const front=alliedMinions.length?Math.min(...alliedMinions.map(m=>m.x)):1800;move(u,Math.max(450,front+90),615,dt,25);u.target=null;}
}
function aiMinion(u,dt){let t=living(u.target)&&dist(u,u.target)<330&&!protectedCore(u.target)?u.target:null;if(!t)t=enemies(u).filter(e=>!protectedCore(e)&&dist(u,e)<300).sort((a,b)=>dist(u,a)-dist(u,b))[0];u.target=t;
 if(t){if(dist(u,t)>u.range+t.r)move(u,t.x,t.y,dt,u.range+t.r-3);else attack(u,t);}else move(u,u.team===0?2270:130,600+(u.id%3-1)*45,dt,12);
}
function aiTower(u,dt){u.aggro=Math.max(0,u.aggro-dt);let t=u.target;if(!living(t)||dist(u,t)>u.range+t.r||(u.aggro<=0&&t.kind==='hero'))t=null;
 if(!t)t=enemies(u).filter(e=>e.kind!=='core'&&e.kind!=='tower'&&dist(u,e)<u.range+e.r).sort((a,b)=>(a.kind==='hero')-(b.kind==='hero')||dist(u,a)-dist(u,b))[0];u.target=t;if(t)attack(u,t);
}
function spawnWave(){game.wave++;for(const team of [0,1])for(let i=0;i<5;i++){const u=unit(team,i>=3?'caster':'melee',team===0?235-i*28:2165+i*28,540+(i%3)*55);const scaling=1+Math.min(1.5,game.time/600);u.maxHp*=scaling;u.hp=u.maxHp;u.damage*=scaling;game.units.push(u);}if(game.wave===1)toast('双方小兵已出发 · 跟随兵线推进');}
function respawn(u){u.dead=0;u.hp=u.maxHp;u.x=u.team===0?245:2155;u.y=600;u.shield=0;u.target=null;u.order=null;u.cd=0;if(u===game.player){u.mana=u.maxMana;for(const k in u.cool)u.cool[k]=0;$('order').textContent='已复活 · 右键重返战场';toast('重返战场 · 泉水可购买装备');}}
function update(dt){game.time+=dt;game.gold+=dt*2;game.spawn-=dt;if(game.spawn<=0){spawnWave();game.spawn=18;}
 const p=game.player;
 for(const u of game.units){if(u.dead>0){u.dead-=dt;if(u.dead<=0)respawn(u);continue;}if(!living(u))continue;u.cd=Math.max(0,u.cd-dt);u.flash=Math.max(0,u.flash-dt);u.attackAnim=Math.max(0,u.attackAnim-dt);u.slow=Math.max(0,u.slow-dt);u.shieldTime-=dt;if(u.shieldTime<=0)u.shield=0;
  if(u.kind==='hero'){const home={x:u.team===0?150:2250,y:600};if(dist(u,home)<210)u.hp=Math.min(u.maxHp,u.hp+u.maxHp*.16*dt);else u.hp=Math.min(u.maxHp,u.hp+1.5*dt);}
  if(u===p){for(const key in p.cool)p.cool[key]=Math.max(0,p.cool[key]-dt);p.mana=Math.min(p.maxMana,p.mana+(dist(p,{x:150,y:600})<210?65:p.manaRegen)*dt);
   const o=p.order;if(o?.type==='move'){if(move(p,o.x,o.y,dt))p.order=null;}else if(o?.type==='attack'){const t=o.target;if(!living(t)||protectedCore(t)){p.order=null;p.target=null;}else if(dist(p,t)>p.range+t.r)move(p,t.x,t.y,dt,p.range+t.r-5);else attack(p,t);}
  }else if(u.kind==='hero')aiHero(u,dt);else if(u.kind==='tower')aiTower(u,dt);else if(u.kind!=='core')aiMinion(u,dt);
  if(state==='ended')break;
 }
 // Soft separation prevents stacked minion silhouettes without blocking click orders.
 const mobile=game.units.filter(u=>living(u)&&!['tower','core'].includes(u.kind));for(let i=0;i<mobile.length;i++)for(let j=i+1;j<mobile.length;j++){const a=mobile[i],b=mobile[j],d=dist(a,b),min=a.r+b.r-3;if(d<min&&d>.01){const shift=(min-d)*.3,dx=(a.x-b.x)/d*shift,dy=(a.y-b.y)/d*shift;a.x=clamp(a.x+dx,65,2335);a.y=clamp(a.y+dy,WORLD.top+a.r,WORLD.bottom-a.r);b.x=clamp(b.x-dx,65,2335);b.y=clamp(b.y-dy,WORLD.top+b.r,WORLD.bottom-b.r);}}
 for(const shot of game.shots){if(!living(shot.target)){shot.done=true;continue;}const target={x:shot.target.x,y:shot.target.y-15},d=dist(shot,target),step=shot.speed*dt;if(d<step+10){damage(shot.target,shot.damage,shot.source);shot.done=true;}else{shot.x+=(target.x-shot.x)/d*step;shot.y+=(target.y-shot.y)/d*step;}}
 game.shots=game.shots.filter(s=>!s.done);
 for(const fx of game.effects){fx.life-=dt;if(fx.life<=0&&!fx.triggered){fx.triggered=true;if(fx.type==='ultimate'&&living(fx.source)){const from={x:fx.source.x,y:fx.source.y};fx.source.x=fx.x;fx.source.y=fx.y;effect('dash',from.x,from.y,{to:{x:fx.x,y:fx.y},color:'#e8cf9b'});effect('blast',fx.x,fx.y,{radius:fx.radius,color:'#f2deb4',life:.6,maxLife:.6});for(const e of enemies(fx.source))if(dist(e,fx)<fx.radius+e.r){damage(e,fx.power,fx.source);e.slow=2.5;}}if(fx.type==='enemySpell'&&living(fx.source)){effect('blast',fx.x,fx.y,{radius:fx.radius,color:'#ec8d93'});for(const e of enemies(fx.source))if(dist(e,fx)<fx.radius+e.r)damage(e,fx.power,fx.source);}}}
 game.effects=game.effects.filter(f=>f.life>0);for(const t of game.texts){t.life-=dt;t.y-=dt*25;}game.texts=game.texts.filter(t=>t.life>0);game.units=game.units.filter(u=>u.kind==='hero'||u.kind==='tower'||u.kind==='core'||u.hp>0);if(game.marker)game.marker.life-=dt;
 if(game.time>game.rival.level*40){const r=game.rival;r.level++;r.maxHp+=75;r.damage+=6;r.hp=Math.min(r.maxHp,r.hp+75);}
 if(state==='playing'&&p.hp>0&&p.xp>=p.need)levelUp();updateHUD();
}
function levelUp(){const p=game.player;p.xp-=p.need;p.level++;p.need=Math.round(p.need*1.18);p.maxHp+=65;p.hp=Math.min(p.maxHp,p.hp+110);p.damage+=5;p.maxMana+=25;p.mana=Math.min(p.maxMana,p.mana+60);state='choosing';armed=null;
 const pool=[...augments];for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}const choices=pool.slice(0,3);
 $('overlay').innerHTML=`<div class="choices"><p class="eyebrow">HEXTECH AUGMENT / LEVEL ${p.level}</p><h2>选择你的英雄强化</h2><p>战场已暂停。强化将持续本局，可重复叠加。</p><div class="choice-grid">${choices.map((a,i)=>`<button class="choice" data-choice="${i}"><small>海克斯强化</small><span class="symbol">${a.symbol}</span><strong>${a.name}</strong><p>${a.desc}</p></button>`).join('')}</div></div>`;$('overlay').classList.remove('hidden');$('overlay').querySelectorAll('.choice').forEach(b=>b.onclick=()=>{const a=choices[+b.dataset.choice];a.apply(p);game.chosen[a.id]=(game.chosen[a.id]||0)+1;state='playing';$('overlay').classList.add('hidden');renderAugments();updateHUD();canvas.focus({preventScroll:true});if(p.xp>=p.need)levelUp();});
}
function renderAugments(){const entries=Object.entries(game.chosen);$('augment-count').textContent=`${entries.reduce((sum,[,n])=>sum+n,0)} 已激活`;$('augment-list').innerHTML=entries.length?entries.map(([id,n])=>{const a=augments.find(a=>a.id===id);return `<div class="augment" title="${a.desc}"><span>${a.symbol}</span>${a.name}<small>×${n}</small></div>`;}).join(''):'<span class="empty">参与战斗获取经验，升级时三选一强化。</span>';}
function pause(){if(state==='playing'){state='paused';armed=null;$('pause').textContent='▶ 继续';$('overlay').innerHTML='<div class="welcome"><div class="crest">Ⅱ</div><h1>战场已暂停</h1><p>准备好后，继续带领你的兵线。</p><button class="primary" id="resume">继续对决 →</button></div>';$('overlay').classList.remove('hidden');$('resume').onclick=pause;}else if(state==='paused'){state='playing';$('pause').textContent='Ⅱ 暂停';$('overlay').classList.add('hidden');canvas.focus({preventScroll:true});}}
function finish(win){state='ended';armed=null;$('overlay').innerHTML=`<div class="welcome"><p class="eyebrow">${win?'VICTORY':'DEFEAT'}</p><div class="crest">${win?'♛':'⚔'}</div><h1>${win?'敌方水晶已被摧毁':'己方水晶已被摧毁'}</h1><p>${win?'胜利属于蓝方。':'重整旗鼓，再次出战。'}<br>${game.kills} 击杀 / ${game.deaths} 阵亡 / ${game.assists} 助攻 · 补刀 ${game.cs} · 等级 ${game.player.level}</p><button class="primary" id="restart">再战一局 →</button></div>`;$('overlay').classList.remove('hidden');$('restart').onclick=start;}
function openShop(){if(!game||!['playing','paused'].includes(state))return;if(state==='playing')pause();$('shop-dialog').showModal();renderShop();}
function renderShop(){const p=game.player,home=dist(p,{x:150,y:600})<230&&!p.dead;$('shop-note').textContent=home?`可用金币：${Math.floor(game.gold)} · 购买后关闭商店并继续战斗`:'需返回蓝方泉水（地图最左侧）才能购买。';$('shop-items').innerHTML=items.map(item=>`<button class="shop-item" data-item="${item.id}" ${!home||game.gold<item.cost||(game.items[item.id]||0)>=3?'disabled':''}><span>${item.icon}</span><div><b>${item.name}</b><small>${item.desc} · 已购 ${game.items[item.id]||0}/3</small></div><b>◈ ${item.cost}</b></button>`).join('');$('shop-items').querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>{const item=items.find(i=>i.id===b.dataset.item);if(game.gold<item.cost||(game.items[item.id]||0)>=3||!home)return;game.gold-=item.cost;game.items[item.id]=(game.items[item.id]||0)+1;item.apply(p);updateHUD();renderShop();});}
function updateHUD(){const p=game.player;$('clock').textContent=`${String(Math.floor(game.time/60)).padStart(2,'0')}:${String(Math.floor(game.time%60)).padStart(2,'0')}`;$('blue-score').textContent=game.score[0];$('red-score').textContent=game.score[1];$('level').textContent=p.level;$('hp-text').textContent=`${Math.ceil(Math.max(0,p.hp))} / ${Math.round(p.maxHp)}${p.shield>0?' +'+Math.ceil(p.shield):''}`;$('hp-bar').style.width=`${Math.max(0,p.hp)/p.maxHp*100}%`;$('mana-text').textContent=`${Math.floor(p.mana)} / ${p.maxMana}`;$('mana-bar').style.width=`${p.mana/p.maxMana*100}%`;$('xp-bar').style.width=`${Math.min(1,p.xp/p.need)*100}%`;$('gold').textContent=Math.floor(game.gold);$('cs').textContent=game.cs;$('kda').textContent=`${game.kills} / ${game.deaths} / ${game.assists}`;
 for(const k in skills){const b=$('skill-'+k),cd=p.cool[k];b.querySelector('.cooldown').style.display=cd>0?'grid':'none';b.querySelector('.cooldown').textContent=Math.ceil(cd);b.classList.toggle('selected',armed===k);b.classList.toggle('no-mana',p.mana<skills[k].cost);}
 $('objective').textContent=towerFor(1)?'带领小兵推进，摧毁敌方防御塔':'敌方防御塔已摧毁 · 进攻水晶';
 const t=selected&&living(selected)?selected:null;$('target-info').style.display=t?'block':'none';if(t)$('target-info').innerHTML=`<b>${t.team===0?'蓝方':'红方'} · ${unitName(t)}</b>${Math.ceil(t.hp)} / ${Math.round(t.maxHp)}${protectedCore(t)?' · 防御塔保护中':''}`;
 if(p.dead)$('order').textContent=`阵亡 · ${Math.ceil(p.dead)} 秒后复活`;
}
for(const [k,s] of Object.entries(skills)){$('skills').insertAdjacentHTML('beforeend',`<button id="skill-${k}" class="skill" title="${k.toUpperCase()} ${s.name}：${s.desc} · ${s.cost} 法力 / ${s.cd}秒冷却"><kbd>${k.toUpperCase()}</kbd><span class="icon">${s.icon}</span><small>${s.name}</small><span class="cooldown" style="display:none"></span></button>`);$('skill-'+k).onclick=()=>{if(state!=='playing'||game.player.dead)return;if(k==='w'){cast(k);return;}armed=armed===k?null:k;toast(armed?`选择施放位置：${s.name} · 点击地图施放，Esc 取消`:'已取消施法');updateHUD();};}

// Canvas illustration and camera share one transform, keeping pointer hit tests exact.
function circle(x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function poly(points,fill,stroke){ctx.beginPath();for(const [x,y] of points)ctx.lineTo(x,y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function line(x,y,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function ground(){ctx.fillStyle='#183342';ctx.fillRect(0,0,WORLD.w,WORLD.h);const mist=ctx.createLinearGradient(0,0,0,WORLD.h);mist.addColorStop(0,'#213c50');mist.addColorStop(.5,'#102331');mist.addColorStop(1,'#071c2a');ctx.fillStyle=mist;ctx.fillRect(0,0,WORLD.w,WORLD.h);
 // Ravine: fractured ice and deep blue water beyond the bridge.
 for(let i=0;i<48;i++){const x=(i*173)%WORLD.w,y=i%2===0?130+(i*67)%130:950+(i*37)%200;poly([[x,y],[x+80,y-28],[x+126,y+10],[x+30,y+45]],i%3===0?'#3a5c6a':'#264653','#4e708044');}
 ctx.fillStyle='#405c68';ctx.fillRect(30,300,2340,600);ctx.fillStyle='#536b74';ctx.fillRect(45,315,2310,570);
 for(let row=0;row<9;row++)for(let col=0;col<33;col++){const x=35+col*74+(row%2)*37,y=323+row*62;ctx.fillStyle=['#526773','#49616e','#5d727c','#4b6570'][(row*13+col*7)%4];ctx.fillRect(x+2,y+2,70,58);ctx.strokeStyle='#203d4a55';ctx.strokeRect(x+2,y+2,70,58);if((row+col)%8===0)line(x+16,y+7,x+40,y+30,'#b3c9cf22');}
 // Inlaid lane guide and snowy parapets.
 line(100,600,2300,600,'#a8c0c426',2);for(let x=100;x<2350;x+=180){poly([[x,600],[x+18,590],[x+36,600],[x+18,610]],'#a5babe2b');}
 for(const y of [300,880]){ctx.fillStyle='#273e4a';ctx.fillRect(20,y,2360,20);ctx.fillStyle='#a9c0c8';ctx.fillRect(20,y-4,2360,7);for(let x=40;x<2380;x+=120){ctx.fillStyle='#243b49';ctx.fillRect(x,y-15,26,45);ctx.fillStyle='#d1e0e3';ctx.fillRect(x-3,y-18,32,9);}}
 for(const [x,y] of [[420,350],[420,845],[1120,350],[1120,845],[1980,350],[1980,845]]){ctx.fillStyle='#263d47';ctx.fillRect(x-16,y-12,32,26);poly([[x-19,y-14],[x,y-43],[x+19,y-14]],'#a8bec6','#c2d4d9');circle(x,y-32,7,'#70cce5');circle(x,y-32,20,'#79cce511');}
 for(const [x,color] of [[150,'#62c8ed'],[2250,'#f0869a']]){circle(x,600,160,color+'0e',color+'44');circle(x,600,130,null,color+'33');for(let i=0;i<8;i++){const a=i*Math.PI/4;line(x+Math.cos(a)*140,600+Math.sin(a)*140,x+Math.cos(a)*151,600+Math.sin(a)*151,color+'55',3);}}
 // Sparse static snow, deterministic so it never distracts while aiming.
 for(let i=0;i<90;i++){const x=(i*347)%2400,y=(i*173)%1200;if(y<300||y>900)circle(x,y,1+i%2,'#c6e7ec44');}
}
function structure(u){const blue=u.team===0,color=blue?'#71d6ff':'#f28fa6';ctx.save();ctx.translate(u.x,u.y);ctx.lineWidth=2;if(u.hp<=0){ctx.fillStyle='#304653';ctx.fillRect(-32,-10,64,20);poly([[-25,0],[-12,-18],[7,-8],[24,-24],[29,6]],'#53616b');ctx.restore();return;}
 ctx.fillStyle='#10212b77';ctx.beginPath();ctx.ellipse(0,16,u.r+12,u.r*.55,0,0,Math.PI*2);ctx.fill();if(u.kind==='tower'){poly([[-32,10],[-32,-6],[0,-23],[32,-6],[32,10],[0,27]],'#354a56','#90a5af');poly([[-20,-2],[-20,-59],[20,-59],[20,-2],[0,10]],blue?'#416277':'#6d4c64','#afbdc5');poly([[-27,-56],[0,-70],[27,-56],[0,-43]],'#a6b9c1','#d1e1e4');poly([[0,-108],[-12,-77],[0,-59],[12,-77]],color,'#e4f2f5');circle(0,-79,24,color+'22');if(u.target&&living(u.target)){ctx.setLineDash([6,6]);line(0,-75,u.target.x-u.x,u.target.y-u.y-15,color+'88',1);ctx.setLineDash([]);}}
 else{poly([[-44,12],[-44,-6],[0,-29],[44,-6],[44,12],[0,35]],'#354e5d','#a2b8c1');circle(0,-5,32,null,color+'88');poly([[0,-84],[-23,-35],[0,1],[23,-35]],color,'#e5f6ff');poly([[0,-84],[-6,-34],[0,1],[23,-35]],blue?'#3b8fbf':'#b95780');circle(0,-36,48,color+'15');if(protectedCore(u)){circle(0,-24,55,null,color+'44');}}
 ctx.restore();healthBar(u,u.kind==='tower'?90:105,u.kind==='tower'?115:95);
}
function humanoid(u){const hero=u.kind==='hero',blue=u.team===0,color=blue?'#5eacda':'#c86c85',trim=blue?'#c8e6f2':'#f4c5c4';ctx.save();ctx.translate(u.x,u.y);ctx.fillStyle='#091b2866';ctx.beginPath();ctx.ellipse(0,8,hero?24:15,hero?10:7,0,0,Math.PI*2);ctx.fill();
 if(u===selected||u===game.player){ctx.lineWidth=1.5;ctx.strokeStyle=u===selected?'#f8ce78':'#78cfea';ctx.beginPath();ctx.ellipse(0,5,hero?27:18,hero?13:9,0,0,Math.PI*2);ctx.stroke();}
 const bob=Math.sin(u.walk)*2,dir=Math.cos(u.face)>0?1:-1;ctx.translate(0,bob);const swing=u.attackAnim>0?Math.sin(u.attackAnim/.28*Math.PI)*1.5:0;
 if(hero){ // Cloak, boots, torso, pauldrons, head and a distinct sword silhouette.
  poly([[-11,-31],[-21,2],[-5,-4],[6,4],[16,-27]],blue?'#24485f':'#632d46',color);
  line(-7,-7,-10,7+Math.sin(u.walk)*3,'#172a39',7);line(6,-7,10,7-Math.sin(u.walk)*3,'#172a39',7);
  poly([[-13,-35],[11,-35],[14,-17],[5,-7],[-11,-13]],u.flash>0?'#f8ffff':color,trim);
  poly([[-18,-36],[-7,-40],[-5,-29],[-17,-26]],'#a6bbc7',trim);poly([[8,-39],[20,-31],[17,-23],[8,-28]],'#a6bbc7',trim);
  circle(0,-44,9,'#d4b8a1','#324653');poly([[-10,-47],[-3,-58],[10,-52],[10,-43],[1,-48],[-9,-40]],blue?'#c3d8df':'#362b40',trim);
  ctx.save();ctx.translate(dir*15,-24);ctx.rotate(dir*(.3-swing));line(0,0,dir*9,11,color,7);line(dir*8,8,dir*13,-22,'#d9ecf2',5);poly([[dir*13,-37],[dir*8,-18],[dir*14,-20]],'#ecfbff',color);line(dir*2,-4,dir*19,0,'#d5b675',3);ctx.restore();
 }else{line(-5,-3,-6,5,'#182f3d',5);line(5,-3,6,5,'#182f3d',5);poly([[-9,-22],[9,-22],[11,-4],[-10,-4]],color,trim);circle(0,-27,7,'#afbdc6');poly([[-9,-27],[0,-38],[9,-27]],blue?'#5485a8':'#9e526d',trim);if(u.kind==='caster'){line(dir*10,-9,dir*15,-33,'#bcae88',3);circle(dir*15,-35,4,blue?'#89e7ff':'#ffa4c5');}else{line(dir*12,-9,dir*14,-33,'#d5e7ee',3);poly([[-dir*8,-21],[-dir*15,-17],[-dir*14,-5],[-dir*7,-8]],'#738d9f',trim);}}
 if(u.shield>0){ctx.lineWidth=2;circle(0,-18,33,null,'#91d9ffbb');circle(0,-18,37,'#7ac8ff11');}ctx.restore();healthBar(u,hero?72:40,hero?76:49);
}
function healthBar(u,width,height){const x=u.x-width/2,y=u.y-height;ctx.fillStyle='#0c1c27';ctx.fillRect(x-1,y-1,width+2,7);ctx.fillStyle=u===game.player?'#79c78d':u.team===0?'#6abce3':'#dd7a88';ctx.fillRect(x,y,width*Math.max(0,u.hp/u.maxHp),5);ctx.strokeStyle='#07121c88';ctx.lineWidth=1;for(let i=1;i<width/15;i++)line(x+i*15,y,x+i*15,y+5,'#122d3877');if(u.kind==='hero'){ctx.textAlign='center';ctx.font='11px system-ui';ctx.fillStyle='#e2edf2';ctx.fillText(`${u.name}  ${u.level||1}`,u.x,y-7);} }
function drawEffects(){for(const f of game.effects){const a=f.life/f.maxLife;ctx.globalAlpha=Math.min(1,a*2);ctx.lineWidth=3;if(f.type==='slash'){ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.angle);ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,f.radius,-1.05,1.05);ctx.closePath();ctx.fillStyle=f.color+'33';ctx.fill();ctx.beginPath();ctx.arc(0,0,f.radius,-1.05,1.05);ctx.strokeStyle=f.color;ctx.lineWidth=5;ctx.stroke();ctx.restore();}else if(f.type==='dash'){line(f.x,f.y-15,f.to.x,f.to.y-15,f.color+'66',16);line(f.x,f.y-15,f.to.x,f.to.y-15,f.color,2);}else if(f.type==='ultimate'||f.type==='enemySpell'){circle(f.x,f.y,f.radius,f.color+'18',f.color);circle(f.x,f.y,f.radius*(1-a),null,f.color);line(f.x-14,f.y,f.x+14,f.y,f.color,2);line(f.x,f.y-14,f.x,f.y+14,f.color,2);}else{circle(f.x,f.y,(f.radius||60)*(1-a*.7),f.color+'15',f.color);}}
 ctx.globalAlpha=1;for(const shot of game.shots){ctx.shadowColor=shot.color;ctx.shadowBlur=12;circle(shot.x,shot.y,5,shot.color);}ctx.shadowBlur=0;for(const t of game.texts){ctx.globalAlpha=Math.min(1,t.life*2);ctx.fillStyle=t.color;ctx.textAlign='center';ctx.font='bold 14px system-ui';ctx.strokeStyle='#10212c';ctx.lineWidth=3;ctx.strokeText(t.text,t.x,t.y);ctx.fillText(t.text,t.x,t.y);}ctx.globalAlpha=1;
}
function draw(){ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#142a39';ctx.fillRect(0,0,canvas.width,canvas.height);const p=game?.player;
 if(p&&game.cameraLocked){const targetX=clamp(p.x-view.w/2,0,Math.max(0,WORLD.w-view.w)),targetY=clamp(p.y-view.h/2,0,Math.max(0,WORLD.h-view.h));view.x=targetX;view.y=targetY;}
 if(pointer.sx!==null){pointer.x=pointer.sx/view.scale+view.x;pointer.y=pointer.sy/view.scale+view.y;}
 const dpr=canvas.width/(canvas.clientWidth||1);ctx.setTransform(view.scale*dpr,0,0,view.scale*dpr,-view.x*view.scale*dpr,-view.y*view.scale*dpr);ground();if(!game)return;
 // Tower attack radius becomes visible while approaching, to make diving readable.
 for(const t of game.units.filter(u=>living(u)&&u.kind==='tower'))if(dist(t,p)<t.range+330){ctx.lineWidth=1;ctx.setLineDash([9,10]);circle(t.x,t.y,t.range,t.team===1?'#f4777710':null,t.team===1?'#eb9a8c55':'#76d0ec33');ctx.setLineDash([]);}
 if(game.marker?.life>0){const m=game.marker;ctx.globalAlpha=Math.min(1,m.life*3);ctx.lineWidth=2;circle(m.x,m.y,12+(1-m.life/.65)*16,null,m.attack?'#ff8d8d':'#7ef3c4');line(m.x-6,m.y,m.x+6,m.y,m.attack?'#ff8d8d':'#7ef3c4');line(m.x,m.y-6,m.x,m.y+6,m.attack?'#ff8d8d':'#7ef3c4');ctx.globalAlpha=1;}
 for(const u of [...game.units].sort((a,b)=>a.y-b.y)){if(u.kind==='tower'||u.kind==='core')structure(u);else if(living(u))humanoid(u);}
 drawEffects();if(armed&&!p.dead){ctx.lineWidth=1.5;circle(p.x,p.y,armed==='q'?p.qRange:armed==='e'?p.dashRange:skills[armed].range,null,'#9fefdbaa');if(armed==='r'){const to=pointAlong(p,pointer,skills.r.range);circle(to.x,to.y,p.ultRadius,'#e8d1a522','#e8d1a5');}}
 if(p.dead&&state==='playing'){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#091420aa';ctx.fillRect(canvas.clientWidth/2-150,canvas.clientHeight/2-54,300,108);ctx.textAlign='center';ctx.fillStyle='#e5c78e';ctx.font='bold 26px system-ui';ctx.fillText(`${Math.ceil(p.dead)} 秒后复活`,canvas.clientWidth/2,canvas.clientHeight/2-5);ctx.font='12px system-ui';ctx.fillStyle='#c6d6df';ctx.fillText('双方兵线仍在推进',canvas.clientWidth/2,canvas.clientHeight/2+24);}
 drawMinimap();
}
function drawMinimap(){const sx=mini.width/WORLD.w,sy=mini.height/WORLD.h;mc.setTransform(sx,0,0,sy,0,0);mc.fillStyle='#142c39';mc.fillRect(0,0,WORLD.w,WORLD.h);mc.fillStyle='#526876';mc.fillRect(50,325,2300,550);for(const u of game.units){if(!living(u))continue;mc.fillStyle=u.team===0?'#8fdfff':'#ff96a7';const r=u.kind==='hero'?43:u.kind==='tower'?55:u.kind==='core'?65:15;mc.beginPath();mc.arc(u.x,u.y,r,0,Math.PI*2);mc.fill();}mc.lineWidth=15;mc.strokeStyle='#f0e6c588';mc.strokeRect(view.x,view.y,view.w,view.h);}
function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);view.scale=r.width<650?.72:1;view.w=Math.min(WORLD.w,r.width/view.scale);view.h=Math.min(WORLD.h,r.height/view.scale);}
function mousePoint(e){const r=canvas.getBoundingClientRect();pointer.sx=e.clientX-r.left;pointer.sy=e.clientY-r.top;pointer.x=pointer.sx/view.scale+view.x;pointer.y=pointer.sy/view.scale+view.y;return{x:clamp(pointer.x,65,WORLD.w-65),y:clamp(pointer.y,WORLD.top+20,WORLD.bottom-20)};}
function pick(point){return game.units.filter(u=>{if(!living(u))return false;const structure=['tower','core'].includes(u.kind),height=structure?115:u.kind==='hero'?62:43,width=structure?u.r+8:u.kind==='hero'?29:20;return Math.abs(u.x-point.x)<width&&point.y>u.y-height&&point.y<u.y+18;}).sort((a,b)=>b.y-a.y||dist(a,point)-dist(b,point))[0]||null;}
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointermove',mousePoint);canvas.addEventListener('pointerdown',e=>{if(state!=='playing')return;e.preventDefault();canvas.focus({preventScroll:true});const point=mousePoint(e);if(armed){cast(armed,point);return;}const target=pick(point);selected=target;if(e.button===2||e.pointerType==='touch'){issue(point,target?.team===1?target:null);}updateHUD();});
mini.addEventListener('pointerdown',e=>{if(!game)return;const r=mini.getBoundingClientRect(),point={x:(e.clientX-r.left)/r.width*WORLD.w,y:(e.clientY-r.top)/r.height*WORLD.h};if(e.button===2)issue(point);else{game.cameraLocked=false;view.x=clamp(point.x-view.w/2,0,WORLD.w-view.w);view.y=clamp(point.y-view.h/2,0,WORLD.h-view.h);toast('查看战场 · 按空格重新跟随英雄');}});mini.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',e=>{if($('help-dialog').open||$('shop-dialog').open)return;const k=e.key.toLowerCase();if([' ','q','w','e','r','s','b','p'].includes(k))e.preventDefault();if(e.repeat)return;if(k==='escape'&&armed){armed=null;updateHUD();return;}if(k==='p'||k==='escape'){pause();return;}if(k==='b'){openShop();return;}if(!game)return;if(k===' '){game.cameraLocked=true;return;}if(state!=='playing')return;if(k==='s'){game.player.order=null;game.player.target=null;armed=null;$('order').textContent='已停止';}if(skills[k])cast(k);});
$('touch-attack').onclick=()=>{if(state!=='playing'||game.player.dead)return;const p=game.player,t=enemies(p).filter(e=>!protectedCore(e)).sort((a,b)=>dist(p,a)-dist(p,b))[0];if(t){selected=t;issue(t,t);}};
$('start').onclick=start;$('pause').onclick=pause;$('help').onclick=()=>{if(state==='playing')pause();$('help-dialog').showModal();};$('close-help').onclick=()=>$('help-dialog').close();$('shop').onclick=openShop;$('close-shop').onclick=()=>$('shop-dialog').close();
window.addEventListener('blur',()=>{if(state==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();});new ResizeObserver(resize).observe(canvas);resize();reset();
function frame(now){const dt=Math.min(.04,(now-last)/1000||0);last=now;if(state==='playing')update(dt);draw();animation=requestAnimationFrame(frame);}animation=requestAnimationFrame(frame);
