// Start `npm start`, then Chromium with --headless --no-sandbox
// --remote-debugging-port=9222 --user-data-dir=/tmp/hex-test-chrome about:blank.
// Run: node tests/browser-smoke.mjs. Uses only Node built-ins.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const tabs=await (await fetch('http://localhost:9222/json/list')).json();
const tab=tabs.find(t=>t.type==='page');assert(tab,'Open a Chromium page first');
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const [resolve,reject]=pending.get(m.id);pending.delete(m.id);m.error?reject(m.error):resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,[resolve,reject]);ws.send(JSON.stringify({id:n,method,params}));});
async function js(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
async function check(label,expression){assert(await js(expression),label);console.log('PASS',label);}
async function fresh(){await js("start();cancelAnimationFrame(animation);game.spawn=999");}
try{
 await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:process.env.GAME_URL||'http://localhost:5173/'});await new Promise(r=>setTimeout(r,700));
 await check('initial champion select and four skills',"state==='ready' && document.querySelectorAll('.skill').length===4");await fresh();
 await check('no unsolicited auto attacks',"(()=>{const p=game.player,e=unit(1,'hero',p.x+60,p.y);game.units=[p,e];e.speed=0;e.cd=999;const hp=e.hp;for(let i=0;i<30;i++)update(.02);return e.hp===hp&&p.order===null})()");
 await fresh();await js('draw()');const point=await js("(()=>{const r=canvas.getBoundingClientRect();return{x:r.left+(480-view.x)*view.scale,y:r.top+(620-view.y)*view.scale}})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'right',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'right',clickCount:1});
 await check('actual right-click issues move order',"game.player.order?.type==='move' && Math.abs(game.player.order.x-480)<2");
 await check('movement follows destination',"(()=>{const x=game.player.x;update(.1);return game.player.x>x})()");
 await check('S cancels move and attack',"window.dispatchEvent(new KeyboardEvent('keydown',{key:'s'}));game.player.order===null && game.player.target===null");
 await fresh();await check('click hit tests tower and hero silhouettes',"pick({x:1750,y:520})?.kind==='tower' && pick({x:245,y:555})===game.player");
 await check('targeted melee pursuit and attack',"(()=>{const p=game.player,e=unit(1,'melee',450,600);e.speed=0;e.cd=999;game.units=[p,e];issue(e,e);for(let i=0;i<100;i++)update(.02);return p.x>300&&e.hp<e.maxHp})()");
 await fresh();await check('Q damages only aimed cone',"(()=>{const p=game.player;p.x=600;const a=unit(1,'hero',700,600),b=unit(1,'melee',500,600);game.units=[p,a,b];cast('q',{x:800,y:600});return a.hp<a.maxHp&&b.hp===b.maxHp&&p.mana===265&&p.cool.q>0})()");
 await check('cooldown prevents second Q',"(()=>{const mana=game.player.mana;return cast('q')===false&&game.player.mana===mana})()");
 await check('W shield absorbs incoming damage',"(()=>{const p=game.player;cast('w');const hp=p.hp,shield=p.shield;damage(p,50,game.rival);return p.hp===hp&&p.shield===shield-50})()");
 await fresh();await check('E dash damages intersected units',"(()=>{const p=game.player;p.x=500;const e=unit(1,'melee',600,600);game.units=[p,e];cast('e',{x:1000,y:600});return p.x===720&&e.hp<e.maxHp&&p.order===null})()");
 await fresh();await check('R telegraph delays impact and slows',"(()=>{const p=game.player;p.x=500;const e=unit(1,'melee',730,600);e.speed=0;e.cd=999;e.hp=e.maxHp=500;game.units=[p,e];cast('r',{x:730,y:600});if(e.hp!==500)return false;for(let i=0;i<36;i++)update(.02);return p.x>700&&e.hp<500&&e.slow>0})()");
 await fresh();await check('towers prioritize minions',"(()=>{const t=towerFor(1),p=game.player;p.x=t.x-180;const m=unit(0,'melee',t.x-160,600);game.units.push(m);aiTower(t,.02);return t.target===m})()");
 await check('attacking hero under tower draws aggro',"(()=>{const t=towerFor(1),r=game.rival,p=game.player;r.x=t.x-50;damage(r,10,p);aiTower(t,.02);return t.target===p&&t.aggro>0})()");
 await check('core protected by living tower',"(()=>{const c=game.units.find(u=>u.kind==='core'&&u.team===1),hp=c.hp;damage(c,5000,game.player);return c.hp===hp&&state==='playing'})()");
 await fresh();await check('last hit awards gold, XP and CS',"(()=>{const p=game.player,e=unit(1,'melee',p.x+50,p.y);game.units.push(e);const gold=game.gold;damage(e,999,p);return game.gold===gold+25&&p.xp===32&&game.cs===1})()");
 await js('game.player.xp=game.player.need;levelUp()');await check('three upgrade choices pause battle',"state==='choosing'&&document.querySelectorAll('.choice').length===3");
 await js("document.querySelector('.choice').click()");await check('selected augment applies',"state==='playing'&&game.player.level===2&&Object.keys(game.chosen).length===1");
 await fresh();await check('death starts respawn timer',"damage(game.player,9999,game.rival);game.player.dead>0&&game.deaths===1&&game.score[1]===1");
 await check('respawn restores hero at fountain',"(()=>{for(let i=0;i<410;i++)update(.02);return game.player.dead===0&&game.player.hp>700&&game.player.x===245&&game.player.mana===game.player.maxMana})()");
 await fresh();await js('openShop()');await check('fountain shop purchase',"(()=>{const before=game.player.damage;document.querySelector('[data-item=sword]').click();return game.player.damage===before+22&&game.gold===0&&game.items.sword===1})()");await js("$('shop-dialog').close();pause()");
 await fresh();await check('cannot buy away from fountain',"game.player.x=1000;openShop();document.querySelector('[data-item=sword]').disabled");await js("$('shop-dialog').close();pause()");
 await fresh();await check('victory after tower and core destroyed',"damage(towerFor(1),99999,game.player);damage(game.units.find(u=>u.kind==='core'&&u.team===1),99999,game.player);state==='ended'&&$('overlay').textContent.includes('胜利')");
 await fresh();await check('defeat when blue core destroyed',"damage(towerFor(0),99999,game.rival);damage(game.units.find(u=>u.kind==='core'&&u.team===0),99999,game.rival);state==='ended'&&$('overlay').textContent.includes('己方水晶')");
 await fresh();await js('pause()');await check('pause and resume',"state==='paused'&&(pause(),state==='playing')");
 await fresh();await js("game.player.x=1170;game.player.y=680;game.rival.x=1380;game.rival.y=610;spawnWave();for(const u of game.units)if(u.kind==='melee'||u.kind==='caster')u.x=u.team===0?1030+u.id*8:1330+u.id*6;draw()");
 await writeFile('/tmp/hex-moba-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await new Promise(r=>setTimeout(r,200));await js('draw()');
 await check('mobile layout fits viewport','document.documentElement.scrollWidth<=innerWidth');
 await check('touch skill arms directional cast',"$('skill-e').click();armed==='e'");
 await writeFile('/tmp/hex-moba-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 assert.equal(errors.length,0,JSON.stringify(errors));console.log('PASS no browser runtime exceptions');
}finally{ws.close();}
