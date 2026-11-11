import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../game.js',import.meta.url),'utf8').split("$('skills').insertAdjacentHTML")[0];
export function createSimulation(){
 const el=new Proxy(()=>{}, {get:(_,key)=>key==='getContext'?()=>({}):key==='querySelectorAll'?()=>[]:key==='classList'?{add(){},remove(){},toggle(){}}:key==='style'?{}:el});
 const context=vm.createContext({HEX_SERVER:true,document:{getElementById:()=>el,querySelector:()=>el},BattleRenderer:class{},matchMedia:()=>({matches:false}),setTimeout:()=>0,clearTimeout(){},console});
 vm.runInContext(code+`
 renderTeams=updateHUD=renderAugments=toast=()=>{};
 finish=()=>{state='ended';};
 reset();state='playing';
 for(const h of game.heroes)Object.assign(h,{qRange:145,qPower:1,shieldPower:1,shieldHeal:0,ultRadius:145,ultPower:1,cool:{q:0,w:0,e:0,r:0},gold:300,items:{},cs:0});
 processAugments=()=>{for(const h of game.heroes){const level=nextAugment(h);if(level===undefined||!living(h))continue;if(h.human){if(!h.choices?.length)h.choices=augments.filter(a=>!h.augmentHistory.some(v=>v.id===a.id)).sort(()=>Math.random()-.5).slice(0,3).map(a=>a.id);}else{const pool=augments.filter(a=>['edge','haste','heart','leech','stride','mana'].includes(a.id)&&!h.augmentHistory.some(v=>v.id===a.id));takeAugment(h,level,pool[Math.floor(Math.random()*pool.length)]);}}};
 const originalReward=reward;
 reward=(victim,source)=>{const contributors=[...(victim.contributors||[])];originalReward(victim,source);for(const [id,time]of contributors){const ally=game.heroes.find(h=>h.id===id);if(ally?.human&&ally!==source&&ally.team!==victim.team&&game.time-time<=10)ally.gold+=100;}if(source?.human){source.gold+=victim.kind==='hero'?250:victim.kind==='tower'?200:victim.kind==='core'?0:25;if(['melee','caster'].includes(victim.kind))source.cs++;}};
 globalThis.api={
 game:()=>game,state:()=>state,
 tick(dt){if(state==='playing'){update(dt);for(const h of game.heroes)if(h.human)h.gold+=dt*2;}},
 claim(index,name){const h=game.heroes[index];h.human=true;h.nickname=name;h.order=null;h.target=null;h.choices=[];processAugments();return h.id;},
 release(id){const h=game.heroes.find(h=>h.id===id);if(h){h.human=false;autoSpendSkills(h);h.nickname='';h.choices=[];h.order=null;h.target=null;}},
 command(id,c){const h=game.heroes.find(h=>h.id===id&&h.human);if(!h||state!=='playing')return;const previous=game.player;game.player=h;try{
 if(c.type==='order'&&living(h)){const t=game.units.find(u=>u.id===c.target);issue(c.point,t&&t.team!==h.team&&living(t)?t:null);}
 else if(c.type==='cast')cast(c.key,c.point);
 else if(c.type==='upgrade')upgradeSkill(c.key,h);
 else if(c.type==='stop'){h.order=null;h.target=null;}
 else if(c.type==='augment'&&h.choices?.includes(c.id)&&living(h)){const a=augments.find(a=>a.id===c.id);if(takeAugment(h,nextAugment(h),a))h.choices=[];}
 else if(c.type==='buy'){const item=items.find(i=>i.id===c.id);if(item&&living(h)&&dist(h,{x:h.team===0?150:2250,y:600})<230&&h.gold>=item.cost&&(h.items[item.id]||0)<3){h.gold-=item.cost;h.items[item.id]=(h.items[item.id]||0)+1;item.apply(h);}}
 }finally{game.player=previous;}},
 };`,context,{timeout:2000});
 return context.api;
}
let nextId=1;
export function snapshot(sim){const g=sim.game();const units=g.units.map(u=>{const {target,order,contributors,...v}=u;return {...v,target:target?.id,order:order?{...order,target:order.target?.id}:null};});
 return {time:g.time,state:sim.state(),score:g.score,units,effects:g.effects.map(f=>{f.netId??=nextId++;return {...f,source:f.source?.id};}),shots:g.shots.map(s=>{s.netId??=nextId++;return {...s,source:s.source?.id,target:s.target.id};}),texts:g.texts,wave:g.wave};
}
