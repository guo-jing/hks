'use strict';
// Original single-lane MOBA: click orders, melee combat, allied waves and objectives.
const $ = id => document.getElementById(id);
const canvas=$('arena'),mini=$('minimap'),mc=mini.getContext('2d');
const visual=new BattleRenderer(canvas);
const WORLD={w:2400,h:1200,top:325,bottom:875},pointer={x:700,y:600,sx:null,sy:null},view={w:1200,h:650,scale:1,zoom:1,x:0,y:0};
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
const roles={
 fighter:{label:'战士',icon:'⚔',hp:720,damage:58,range:78,rate:1.1,speed:235,mana:300},
 guardian:{label:'坦克',icon:'⬡',hp:1120,damage:43,range:72,rate:.95,speed:215,mana:280},
 archer:{label:'射手',icon:'➶',hp:570,damage:45,range:255,rate:1.2,speed:230,mana:280},
 mage:{label:'法师',icon:'✦',hp:610,damage:34,range:230,rate:.85,speed:220,mana:420},
 support:{label:'辅助',icon:'✚',hp:740,damage:30,range:205,rate:.9,speed:225,mana:400}
};
const lineups=[['苍锋','磐石','逐风','霜语','晨星'],['赤刃','铁壁','夜翎','烬火','暮光']];
function makeHero(team,role,slot){const y=[600,470,535,680,750][slot],x=team===0?245-(slot%2)*65:2155+(slot%2)*65,u=unit(team,'hero',x,y),stats=roles[role];
 Object.assign(u,stats,{name:lineups[team][slot],role,slot,hp:stats.hp,maxHp:stats.hp,mana:stats.mana,maxMana:stats.mana,manaRegen:6,level:1,skillCd:2+slot*.7,retreating:false,spawn:{x,y},kills:0,deaths:0,assists:0,contributors:new Map()});return u;
}
function unit(team,kind,x,y){const hero=kind==='hero',tower=kind==='tower',core=kind==='core';const hp=hero?720:tower?1650:core?2000:kind==='caster'?115:180;
 return {id:++uid,team,kind,x,y,r:hero?20:tower?34:core?44:12,hp,maxHp:hp,damage:hero?58:tower?95:kind==='caster'?18:25,rate:hero?1.1:tower?.8:.85,range:hero?78:tower?285:kind==='caster'?180:35,speed:hero?235:kind==='caster'?90:105,cd:0,face:team===0?0:Math.PI,attackAnim:0,flash:0,slow:0,shield:0,shieldTime:0,dead:0,target:null,order:null,walk:0,aggro:0};
}
function reset(){uid=0;const heroes=[0,1].flatMap(team=>Object.keys(roles).map((role,slot)=>makeHero(team,role,slot))),p=heroes[0];Object.assign(p,{xp:0,need:120,leech:0,haste:1,qRange:145,qPower:1,shieldPower:1,shieldHeal:0,dashRange:220,ultRadius:145,ultPower:1,cool:{q:0,w:0,e:0,r:0}});
 const structures=[unit(0,'tower',650,600),unit(1,'tower',1750,600),unit(0,'core',150,600),unit(1,'core',2250,600)];for(const u of structures){u.hp=u.maxHp=u.kind==='tower'?4200:5000;if(u.kind==='tower')u.damage=150;}
 game={time:0,player:p,rival:heroes[5],heroes,units:[...heroes,...structures],wave:0,spawn:1,gold:300,cs:0,kills:0,deaths:0,assists:0,score:[0,0],chosen:{},items:{},effects:[],shots:[],texts:[],marker:null,cameraLocked:true};
 selected=null;armed=null;renderTeams();view.x=clamp(p.x-view.w/2,0,WORLD.w-view.w);view.y=clamp(p.y-view.h/2,0,WORLD.h-view.h);
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
 if(victim.kind==='hero'){game.score[1-victim.team]++;victim.deaths=(victim.deaths||0)+1;
  if(source?.kind==='hero'&&source.team!==victim.team)source.kills=(source.kills||0)+1;
  for(const [id,time] of victim.contributors||[]){const ally=game.heroes.find(h=>h.id===id);if(ally&&ally!==source&&ally.team!==victim.team&&game.time-time<=10){ally.assists++;if(ally===p)game.gold+=100;}}
  game.kills=p.kills;game.deaths=p.deaths;game.assists=p.assists;
  if(victim===p){p.order=null;armed=null;toast('你已阵亡 · 队友继续作战，稍后泉水复活');}else toast(`${victim.team===0?'友方':'敌方'} ${victim.name} 已阵亡${source?.name?' · '+source.name+' 完成击杀':''}`);
  victim.dead=8+Math.floor(game.time/90)*2;victim.hp=0;victim.target=null;victim.order=null;victim.contributors?.clear();}
 if(victim.kind==='tower'){toast(victim.team===1?'敌方防御塔已摧毁 · 进攻水晶！':'己方防御塔已失守 · 保护水晶！');effect('blast',victim.x,victim.y,{radius:95,color:'#eac98d',life:.8,maxLife:.8});}
 if(victim.kind==='core')finish(victim.team===1);
}
function damage(target,amount,source){if(!living(target)||protectedCore(target))return 0;let dealt=amount;if(target.shield>0){const absorb=Math.min(amount,target.shield);target.shield-=absorb;dealt-=absorb;}const actual=Math.min(target.hp,dealt);target.hp-=dealt;target.flash=.15;
 if(target.kind==='hero'&&source?.kind==='hero'&&source.team!==target.team){if(!target.contributors)target.contributors=new Map();target.contributors.set(source.id,game.time);}
 if(dealt>0)textAt(target,Math.round(dealt),target.team===0?'#ffc2b4':'#ffe8af');
 if(source===game.player&&source.leech&&target.kind!=='tower'&&target.kind!=='core')source.hp=Math.min(source.maxHp,source.hp+actual*source.leech);
 if(source?.kind==='hero'&&target.kind==='hero'){const tower=towerFor(target.team);if(tower&&dist(tower,source)<tower.range+source.r){tower.target=source;tower.aggro=3;}}
 if(target.hp<=0)reward(target,source);return actual;
}
function issue(point,target=null){if(state!=='playing'||game.player.dead)return;const p=game.player;if(target&&protectedCore(target)){toast('先摧毁防御塔，才能攻击水晶');return;}p.target=target;p.order=target?{type:'attack',target}:{type:'move',x:point.x,y:point.y};game.marker={x:point.x,y:point.y,life:.65,attack:!!target};$('order').textContent=target?`攻击：${unitName(target)}`:'移动至指定位置';}
function unitName(u){return u.kind==='hero'?u.name:u.kind==='tower'?'防御塔':u.kind==='core'?'水晶':u.kind==='caster'?'法师小兵':'近战小兵';}
function move(u,x,y,dt,stop=0){const dx=x-u.x,dy=y-u.y,d=Math.hypot(dx,dy);if(d<=stop+1)return true;const step=Math.min(d-stop,u.speed*(u.slow>0?.55:1)*dt);u.x=clamp(u.x+dx/d*step,65,WORLD.w-65);u.y=clamp(u.y+dy/d*step,WORLD.top+u.r,WORLD.bottom-u.r);u.face=Math.atan2(dy,dx);u.walk+=dt*10;return false;}
function attack(u,t){if(u.cd>0||!living(t)||protectedCore(t))return;u.cd=1/u.rate;u.face=Math.atan2(t.y-u.y,t.x-u.x);u.attackAnim=.28;
 if(u.kind==='tower'||u.kind==='caster'||u.kind==='hero'&&u.range>150){game.shots.push({x:u.x,y:u.y-20,target:t,source:u,damage:u.damage,speed:u.kind==='tower'?500:430,color:u.team===0?'#7edcff':'#ff8c91'});}else{damage(t,u.damage,u);effect('slash',u.x,u.y,{angle:u.face,radius:u.range,color:u.team===0?'#b8f6ee':'#ffb1aa',life:.22,maxLife:.22});}
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
function botSkill(u,target){if(!u.role||u.skillCd>0||u.mana<50)return;const color=u.team===0?'#88d9ff':'#f78585';
 if(u.role==='support'){const ally=game.units.filter(a=>a.team===u.team&&a.kind==='hero'&&living(a)&&dist(u,a)<340&&a.hp<a.maxHp*.78).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(ally){u.mana-=50;u.skillCd=6;const heal=Math.min(110+u.level*12,ally.maxHp-ally.hp);ally.hp+=heal;ally.shield=Math.max(ally.shield,65+u.level*8);ally.shieldTime=2.5;textAt(ally,`+${Math.round(heal)}`,'#a3f4bd');effect('shield',ally.x,ally.y,{radius:45,color:'#99e8b7'});return;}}
 if(!target||target.kind!=='hero'||dist(u,target)>Math.max(u.range+25,200))return;
 u.mana-=50;u.skillCd=u.role==='mage'?7:u.role==='guardian'?9:6;
 if(u.role==='guardian'){u.shield=180+u.level*20;u.shieldTime=3;effect('blast',u.x,u.y,{radius:115,color});for(const e of enemies(u))if(dist(u,e)<115+e.r){damage(e,65+u.level*9,u);e.slow=1.5;}}
 else if(u.role==='archer'){for(const e of enemies(u).filter(e=>e.kind!=='core'&&e.kind!=='tower'&&dist(u,e)<340).sort((a,b)=>dist(u,a)-dist(u,b)).slice(0,3))game.shots.push({x:u.x,y:u.y-25,target:e,source:u,damage:65+u.level*8,speed:560,color});effect('shield',u.x,u.y,{radius:28,color});}
 else{effect('enemySpell',target.x,target.y,{radius:u.role==='mage'?110:85,color,life:u.role==='mage'?.85:.6,maxLife:u.role==='mage'?.85:.6,source:u,power:(u.role==='mage'?105:80)+u.level*10});}
}
function aiHero(u,dt){const forward=u.team===0?1:-1,home=u.spawn||{x:u.team===0?245:2155,y:600};u.skillCd-=dt;
 if(u.hp<u.maxHp*.27)u.retreating=true;
 if(u.retreating){u.target=null;botSkill(u,null);if(u.hp>=u.maxHp*.83)u.retreating=false;else{move(u,home.x,home.y,dt,8);return;}}
 const hostile=enemies(u),enemyTower=towerFor(1-u.team),alliedMinions=game.units.filter(e=>e.team===u.team&&['melee','caster'].includes(e.kind)&&living(e));
 const towerHasCover=enemyTower&&alliedMinions.some(m=>dist(m,enemyTower)<enemyTower.range+m.r);
 if(enemyTower&&dist(u,enemyTower)<enemyTower.range+95&&(!towerHasCover||enemyTower.target===u&&u.hp<u.maxHp*.7)){
  u.target=null;botSkill(u,null);move(u,enemyTower.x-forward*(enemyTower.range+120),home.y,dt,8);return;
 }
 // Avoid walking into the opposing fountain, which rapidly heals its defenders.
 const enemyHome={x:u.team===0?2250:150,y:600};
 const priority=e=>dist(u,e)-(e.kind==='hero'?85:0)+(e.kind==='hero'?e.hp/e.maxHp*40:0);
 const candidates=hostile.filter(e=>!protectedCore(e)&&dist(u,e)<480&&!(e.kind==='hero'&&dist(e,enemyHome)<190&&dist(u,enemyHome)>200));
 const target=candidates.sort((a,b)=>priority(a)-priority(b))[0];u.target=target||null;botSkill(u,target);
 if(target){const d=dist(u,target),ideal=u.range+target.r-7;
  if(d>u.range+target.r)move(u,target.x,target.y,dt,ideal);
  else{attack(u,target);if(u.range>150&&target.kind==='hero'&&d<135&&u.cd>.2)move(u,u.x-forward*80,u.y+(u.y<600?-35:35),dt,5);}
 }else{const front=alliedMinions.length?(u.team===0?Math.max(...alliedMinions.map(m=>m.x)):Math.min(...alliedMinions.map(m=>m.x))):u.team===0?1050:1350;
  const offset=u.role==='guardian'?20:u.role==='fighter'?60:140;let x=clamp(front-forward*offset,230,2170);
  if(enemyTower&&!towerHasCover)x=u.team===0?Math.min(x,enemyTower.x-enemyTower.range-100):Math.max(x,enemyTower.x+enemyTower.range+100);
  if(!enemyTower&&!alliedMinions.length)x=u.team===0?2100:300;
  move(u,x,600+(u.slot-2)*48,dt,20);
 }
}
function aiMinion(u,dt){let t=living(u.target)&&dist(u,u.target)<330&&!protectedCore(u.target)?u.target:null;if(!t)t=enemies(u).filter(e=>!protectedCore(e)&&dist(u,e)<300).sort((a,b)=>dist(u,a)-dist(u,b))[0];u.target=t;
 if(t){if(dist(u,t)>u.range+t.r)move(u,t.x,t.y,dt,u.range+t.r-3);else attack(u,t);}else move(u,u.team===0?2270:130,600+(u.id%3-1)*45,dt,12);
}
function aiTower(u,dt){u.aggro=Math.max(0,u.aggro-dt);let t=u.target;if(!living(t)||dist(u,t)>u.range+t.r||(u.aggro<=0&&t.kind==='hero'))t=null;
 if(!t)t=enemies(u).filter(e=>e.kind!=='core'&&e.kind!=='tower'&&dist(u,e)<u.range+e.r).sort((a,b)=>(a.kind==='hero')-(b.kind==='hero')||dist(u,a)-dist(u,b))[0];u.target=t;if(t)attack(u,t);
}
function spawnWave(){game.wave++;for(const team of [0,1])for(let i=0;i<5;i++){const u=unit(team,i>=3?'caster':'melee',team===0?235-i*28:2165+i*28,540+(i%3)*55);const scaling=1+Math.min(1.5,game.time/600);u.maxHp*=scaling;u.hp=u.maxHp;u.damage*=scaling;game.units.push(u);}if(game.wave===1)toast('双方小兵已出发 · 跟随兵线推进');}
function respawn(u){u.dead=0;u.hp=u.maxHp;u.x=u.spawn?.x??(u.team===0?245:2155);u.y=u.spawn?.y??600;u.shield=0;u.target=null;u.order=null;u.cd=0;u.retreating=false;u.mana=u.maxMana;u.skillCd=2;u.contributors?.clear();if(u===game.player){for(const k in u.cool)u.cool[k]=0;$('order').textContent='已复活 · 右键重返战场';toast('重返战场 · 泉水可购买装备');}}
function update(dt){game.time+=dt;game.gold+=dt*2;game.spawn-=dt;if(game.spawn<=0){spawnWave();game.spawn=18;}
 const p=game.player;
 for(const u of game.units){if(u.dead>0){u.dead-=dt;if(u.dead<=0)respawn(u);continue;}if(!living(u))continue;u.cd=Math.max(0,u.cd-dt);u.flash=Math.max(0,u.flash-dt);u.attackAnim=Math.max(0,u.attackAnim-dt);u.slow=Math.max(0,u.slow-dt);u.shieldTime-=dt;if(u.shieldTime<=0)u.shield=0;
  if(u.kind==='hero'){const home={x:u.team===0?150:2250,y:600},inBase=dist(u,home)<210;if(inBase)u.hp=Math.min(u.maxHp,u.hp+u.maxHp*.16*dt);else u.hp=Math.min(u.maxHp,u.hp+1.5*dt);if(u.maxMana)u.mana=Math.min(u.maxMana,u.mana+(inBase?65:u.manaRegen)*dt);}
  if(u===p){for(const key in p.cool)p.cool[key]=Math.max(0,p.cool[key]-dt);
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
 for(const bot of game.heroes)if(bot!==p&&game.time>bot.level*40&&bot.level<18){bot.level++;bot.maxHp+=75;bot.damage+=6;if(!bot.dead)bot.hp=Math.min(bot.maxHp,bot.hp+75);bot.maxMana+=20;}
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
function renderTeams(){for(const team of [0,1]){$(team===0?'blue-roster':'red-roster').innerHTML=game.heroes.filter(h=>h.team===team).map(h=>`<button id="roster-${h.id}" class="roster-card ${h===game.player?'player-card':''}" title="查看${h.name}的位置"><img class="role-portrait" src="${visual.portrait(h.role,h.team)}" alt="${roles[h.role].label}"><strong>${h.name}${h===game.player?' · 你':''}</strong><small class="hero-status">${roles[h.role].label} · Lv.1</small><span class="roster-health"><i></i></span><span class="hero-kda">0 / 0 / 0</span></button>`).join('');}
 document.querySelector('.portrait').style.backgroundImage=`url(${visual.portrait('fighter',0)})`;
 if($('welcome-hero-portrait'))$('welcome-hero-portrait').src=visual.portrait('fighter',0);
 for(const h of game.heroes)$('roster-'+h.id).onclick=()=>{selected=h;game.cameraLocked=h===game.player;view.x=clamp(h.x-view.w/2,0,Math.max(0,WORLD.w-view.w));view.y=clamp(h.y-view.h/2,0,Math.max(0,WORLD.h-view.h));updateHUD();};}
function updateTeams(){for(const h of game.heroes){const card=$('roster-'+h.id);card.classList.toggle('fallen',!living(h));card.querySelector('.hero-status').textContent=h.dead>0?`复活 ${Math.ceil(h.dead)}s`:`${roles[h.role].label} · Lv.${h.level}`;card.querySelector('.roster-health i').style.width=`${Math.max(0,h.hp)/h.maxHp*100}%`;card.querySelector('.hero-kda').textContent=`${h.kills} / ${h.deaths} / ${h.assists}`;}
 for(const team of [0,1])$(team===0?'blue-alive':'red-alive').textContent=`${game.heroes.filter(h=>h.team===team&&living(h)).length} / 5 存活`;}
function updateHUD(){updateTeams();const p=game.player;$('clock').textContent=`${String(Math.floor(game.time/60)).padStart(2,'0')}:${String(Math.floor(game.time%60)).padStart(2,'0')}`;$('blue-score').textContent=game.score[0];$('red-score').textContent=game.score[1];$('level').textContent=p.level;$('hp-text').textContent=`${Math.ceil(Math.max(0,p.hp))} / ${Math.round(p.maxHp)}${p.shield>0?' +'+Math.ceil(p.shield):''}`;$('hp-bar').style.width=`${Math.max(0,p.hp)/p.maxHp*100}%`;$('mana-text').textContent=`${Math.floor(p.mana)} / ${p.maxMana}`;$('mana-bar').style.width=`${p.mana/p.maxMana*100}%`;$('xp-bar').style.width=`${Math.min(1,p.xp/p.need)*100}%`;$('gold').textContent=Math.floor(game.gold);$('cs').textContent=game.cs;$('kda').textContent=`${game.kills} / ${game.deaths} / ${game.assists}`;
 for(const k in skills){const b=$('skill-'+k),cd=p.cool[k];b.querySelector('.cooldown').style.display=cd>0?'grid':'none';b.querySelector('.cooldown').textContent=Math.ceil(cd);b.classList.toggle('selected',armed===k);b.classList.toggle('no-mana',p.mana<skills[k].cost);}
 $('objective').textContent=towerFor(1)?'带领小兵推进，摧毁敌方防御塔':'敌方防御塔已摧毁 · 进攻水晶';
 const t=selected&&living(selected)?selected:null;$('target-info').style.display=t?'block':'none';if(t)$('target-info').innerHTML=`<b>${t.team===0?'蓝方':'红方'} · ${unitName(t)}</b>${Math.ceil(t.hp)} / ${Math.round(t.maxHp)}${protectedCore(t)?' · 防御塔保护中':''}`;
 if(p.dead)$('order').textContent=`阵亡 · ${Math.ceil(p.dead)} 秒后复活`;
}
for(const [k,s] of Object.entries(skills)){$('skills').insertAdjacentHTML('beforeend',`<button id="skill-${k}" class="skill" title="${k.toUpperCase()} ${s.name}：${s.desc} · ${s.cost} 法力 / ${s.cd}秒冷却"><kbd>${k.toUpperCase()}</kbd><span class="icon">${s.icon}</span><small>${s.name}</small><span class="cooldown" style="display:none"></span></button>`);$('skill-'+k).onclick=()=>{if(state!=='playing'||game.player.dead)return;if(k==='w'){cast(k);return;}armed=armed===k?null:k;toast(armed?`选择施放位置：${s.name} · 点击地图施放，Esc 取消`:'已取消施法');updateHUD();};}

// Simulation stays in ground coordinates; the renderer owns projection and ray picking.
function draw(){const p=game?.player;if(p&&game.cameraLocked){view.x=clamp(p.x-view.w/2,0,Math.max(0,WORLD.w-view.w));view.y=clamp(p.y-view.h/2,0,Math.max(0,WORLD.h-view.h));}
 visual.setView(view);
 if(pointer.sx!==null){const hit=visual.screenToWorld(pointer.sx,pointer.sy);pointer.x=hit.x;pointer.y=hit.y;}
 if(game){visual.render(game,{state,selected,armed,pointer,view,skills,world:WORLD});drawMinimap();}
}
function drawMinimap(){const sx=mini.width/WORLD.w,sy=mini.height/WORLD.h;mc.setTransform(sx,0,0,sy,0,0);mc.fillStyle='#142c39';mc.fillRect(0,0,WORLD.w,WORLD.h);mc.fillStyle='#526876';mc.fillRect(50,325,2300,550);for(const u of game.units){if(!living(u))continue;mc.fillStyle=u.team===0?'#8fdfff':'#ff96a7';const r=u.kind==='hero'?43:u.kind==='tower'?55:u.kind==='core'?65:15;mc.beginPath();mc.arc(u.x,u.y,r,0,Math.PI*2);mc.fill();}mc.lineWidth=15;mc.strokeStyle='#f0e6c588';mc.strokeRect(view.x,view.y,view.w,view.h);}
function resize(){const r=canvas.getBoundingClientRect();view.scale=(r.width<650?.68:1.08)*view.zoom;view.w=Math.min(WORLD.w,r.width/view.scale);view.h=Math.min(WORLD.h,r.height/view.scale);visual.resize(r.width,r.height);visual.setView(view);}
function mousePoint(e){const r=canvas.getBoundingClientRect();pointer.sx=e.clientX-r.left;pointer.sy=e.clientY-r.top;const hit=visual.screenToWorld(pointer.sx,pointer.sy);pointer.x=hit.x;pointer.y=hit.y;return{x:clamp(hit.x,65,WORLD.w-65),y:clamp(hit.y,WORLD.top+20,WORLD.bottom-20)};}
function zoomBy(factor){view.zoom=clamp(view.zoom*factor,.65,1.8);resize();draw();}
$('zoom-in').onclick=()=>zoomBy(1.18);$('zoom-out').onclick=()=>zoomBy(1/1.18);
canvas.addEventListener('wheel',e=>{if(state==='playing'||state==='paused'){e.preventDefault();zoomBy(e.deltaY<0?1.08:1/1.08);}},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointermove',mousePoint);canvas.addEventListener('pointerdown',e=>{if(state!=='playing')return;e.preventDefault();canvas.focus({preventScroll:true});const point=mousePoint(e);if(armed){cast(armed,point);return;}const target=visual.pick(pointer.sx,pointer.sy);selected=target;if(e.button===2||e.pointerType==='touch'){issue(point,target?.team===1?target:null);}updateHUD();});
mini.addEventListener('pointerdown',e=>{if(!game)return;const r=mini.getBoundingClientRect(),point={x:(e.clientX-r.left)/r.width*WORLD.w,y:(e.clientY-r.top)/r.height*WORLD.h};if(e.button===2)issue(point);else{game.cameraLocked=false;view.x=clamp(point.x-view.w/2,0,WORLD.w-view.w);view.y=clamp(point.y-view.h/2,0,WORLD.h-view.h);toast('查看战场 · 按空格重新跟随英雄');}});mini.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',e=>{if($('help-dialog').open||$('shop-dialog').open)return;const k=e.key.toLowerCase();if([' ','q','w','e','r','s','b','p'].includes(k))e.preventDefault();if(e.repeat)return;if(k==='escape'&&armed){armed=null;updateHUD();return;}if(k==='p'||k==='escape'){pause();return;}if(k==='b'){openShop();return;}if(!game)return;if(k===' '){game.cameraLocked=true;return;}if(state!=='playing')return;if(k==='s'){game.player.order=null;game.player.target=null;armed=null;$('order').textContent='已停止';}if(skills[k])cast(k);});
$('touch-attack').onclick=()=>{if(state!=='playing'||game.player.dead)return;const p=game.player,t=enemies(p).filter(e=>!protectedCore(e)).sort((a,b)=>dist(p,a)-dist(p,b))[0];if(t){selected=t;issue(t,t);}};
$('start').onclick=start;$('pause').onclick=pause;$('help').onclick=()=>{if(state==='playing')pause();$('help-dialog').showModal();};$('close-help').onclick=()=>$('help-dialog').close();$('shop').onclick=openShop;$('close-shop').onclick=()=>$('shop-dialog').close();
window.addEventListener('blur',()=>{if(state==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();});new ResizeObserver(resize).observe(canvas);resize();reset();$('start').disabled=false;$('start').textContent='开始对决 →';
function frame(now){const dt=Math.min(.04,(now-last)/1000||0);last=now;if(state==='playing')update(dt);draw();animation=requestAnimationFrame(frame);}animation=requestAnimationFrame(frame);
