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
 await check('WebGL 2 renderer and real shadowed meshes',"(()=>{draw();let meshes=0;visual.entities.get(game.player).traverse(o=>{if(o.isMesh)meshes++});return visual.renderer.isWebGLRenderer&&visual.renderer.shadowMap.enabled&&meshes>30&&visual.renderer.info.render.triangles>20000&&visual.renderer.getContext().getError()===0})()");
 await check('all ten portraits come from 3D models',"visual.portraits.size===10&&[...document.querySelectorAll('.role-portrait')].every(img=>img.src.startsWith('data:image/png'))");
 await check('exact 5v5 roster with one player and nine bots',"game.heroes.length===10&&game.heroes.filter(h=>h.team===0).length===5&&game.heroes.filter(h=>h.team===1).length===5&&game.heroes.filter(h=>h!==game.player).length===9&&new Set(game.heroes.map(h=>h.name)).size===10&&document.querySelectorAll('.roster-card').length===10");
 await check('five combat roles per team',"[0,1].every(team=>new Set(game.heroes.filter(h=>h.team===team).map(h=>h.role)).size===5)");
 await check('all nine bots advance without controlling player',"(()=>{const positions=game.heroes.map(h=>h.x);for(let i=0;i<80;i++)update(.02);return game.player.x===245&&game.heroes.every((h,i)=>h===game.player||(h.team===0?h.x>positions[i]+40:h.x<positions[i]-40))})()");
 await fresh();await check('both teams retreat toward own fountains',"[0,1].every(team=>{const u=game.heroes.find(h=>h.team===team&&h.role==='guardian');u.x=team===0?1000:1400;u.hp=u.maxHp*.2;const x=u.x;aiHero(u,.1);return u.retreating&&(team===0?u.x<x:u.x>x)})");
 await fresh();await check('both teams avoid uncovered enemy towers',"[0,1].every(team=>{const u=game.heroes.find(h=>h.team===team&&h.role==='guardian'),t=towerFor(1-team),dir=team===0?1:-1;u.x=t.x-dir*200;const x=u.x;aiHero(u,.1);return team===0?u.x<x:u.x>x})");
 await fresh();await check('support heals only an allied wounded hero on either team',"[0,1].every(team=>{const healer=game.heroes.find(h=>h.team===team&&h.role==='support'),ally=game.heroes.find(h=>h.team===team&&h.role==='guardian'),enemy=game.heroes.find(h=>h.team!==team&&h.role==='guardian');healer.x=1200;healer.y=600;ally.x=1220;ally.y=620;enemy.x=1180;enemy.y=600;ally.hp=300;enemy.hp=300;healer.skillCd=0;const hp=enemy.hp;botSkill(healer,enemy);return ally.hp>300&&ally.shield>0&&enemy.hp===hp&&healer.skillCd>0})");
 await fresh();await check('ranged heroes launch targeted projectiles',"(()=>{const a=game.heroes.find(h=>h.role==='archer'&&h.team===0),t=game.rival;a.x=t.x-200;a.y=t.y;attack(a,t);return game.shots.some(s=>s.source===a&&s.target===t)})()");
 await fresh();await check('guardian skill shields and damages enemies on both teams',"[0,1].every(team=>{const u=game.heroes.find(h=>h.team===team&&h.role==='guardian'),target=game.heroes.find(h=>h.team!==team&&h.role==='fighter');u.x=1200;u.y=600;target.x=1280;target.y=600;u.skillCd=0;const hp=target.hp;botSkill(u,target);return u.shield>0&&target.hp<hp&&target.slow>0&&u.mana<u.maxMana})");
 await fresh();await check('mage telegraph respects team damage',"(()=>{const u=game.heroes.find(h=>h.team===0&&h.role==='mage'),ally=game.heroes[1],target=game.rival;u.x=1100;u.y=600;ally.x=target.x=1250;ally.y=target.y=600;game.units=[u,ally,target];for(const h of game.units){h.speed=0;h.cd=999;h.skillCd=999;h.damage=0;}u.skillCd=0;const hp=ally.hp;botSkill(u,target);const cast=game.effects.some(f=>f.type==='enemySpell'&&f.source===u);for(let i=0;i<44;i++)update(.02);return cast&&ally.hp===hp&&target.hp<target.maxHp})()");
 await fresh();await check('friendly bot death increments red score only',"(()=>{const a=game.heroes[1];damage(a,99999,game.rival);updateHUD();return game.score[1]===1&&game.deaths===0&&game.kills===0&&game.assists===0&&a.deaths===1&&$('blue-alive').textContent==='4 / 5 存活'&&$('roster-'+a.id).classList.contains('fallen')})()");
 await fresh();await check('no unearned player assist on allied AI kill',"damage(game.rival,99999,game.heroes[1]);game.kills===0&&game.assists===0&&game.score[0]===1&&game.heroes[1].kills===1");
 await fresh();await check('player participation earns assist and assist gold',"(()=>{const gold=game.gold;damage(game.rival,10,game.player);damage(game.rival,99999,game.heroes[1]);return game.assists===1&&game.player.assists===1&&game.kills===0&&game.gold===gold+100})()");
 await fresh();await check('expired participation does not earn assist',"damage(game.rival,10,game.player);game.time=11;damage(game.rival,99999,game.heroes[1]);game.assists===0");
 await fresh();await check('all nine bots respawn in their own formation',"(()=>{for(const h of game.heroes.filter(h=>h!==game.player)){damage(h,99999,h.team===0?game.rival:game.heroes[1]);h.dead=.01;}update(.02);return game.heroes.length===10&&game.heroes.filter(h=>h!==game.player).every(h=>h.dead===0&&h.hp===h.maxHp&&h.x===h.spawn.x&&h.y===h.spawn.y&&h.mana===h.maxMana)})()");
 await fresh();await check('symmetric bot level scaling',"game.time=41;update(.02);game.heroes.filter(h=>h!==game.player).every(h=>h.level===2)&&game.player.level===1");
 await fresh();
 await check('no unsolicited auto attacks',"(()=>{const p=game.player,e=unit(1,'hero',p.x+60,p.y);game.units=[p,e];e.speed=0;e.cd=999;const hp=e.hp;for(let i=0;i<30;i++)update(.02);return e.hp===hp&&p.order===null})()");
 await fresh();await js('draw()');const point=await js("(()=>{const r=canvas.getBoundingClientRect();const p=visual.worldToScreen(480,620);return{x:r.left+p.x,y:r.top+p.y}})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'right',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'right',clickCount:1});
 await check('actual right-click issues move order',"game.player.order?.type==='move' && Math.abs(game.player.order.x-480)<2&&Math.abs(game.player.order.y-620)<2");
 await check('movement follows destination',"(()=>{const x=game.player.x;update(.1);return game.player.x>x})()");
 await check('S cancels move and attack',"window.dispatchEvent(new KeyboardEvent('keydown',{key:'s'}));game.player.order===null && game.player.target===null");
 await fresh();await check('3D raycasting hits tower and hero models',"(()=>{draw();const t=visual.worldToScreen(650,600,70),p=visual.worldToScreen(245,600,50);return visual.pick(t.x,t.y)===towerFor(0)&&visual.pick(p.x,p.y)===game.player})()");
 await fresh();await js('game.player.x=1150;game.rival.x=1320;game.rival.y=620;draw()');const enemyPoint=await js("(()=>{const r=canvas.getBoundingClientRect(),p=visual.worldToScreen(game.rival.x,game.rival.y,50);return{x:r.left+p.x,y:r.top+p.y}})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...enemyPoint,button:'right',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...enemyPoint,button:'right',clickCount:1});
 await check('actual right-click on 3D enemy locks attack',"game.player.order?.type==='attack'&&game.player.order.target===game.rival");
 await check('zoom preserves projected ground coordinates',"(()=>{$('zoom-in').click();const point=visual.worldToScreen(1200,650);const hit=visual.screenToWorld(point.x,point.y);const ok=Math.abs(hit.x-1200)<.01&&Math.abs(hit.y-650)<.01;$('zoom-out').click();return ok})()");
 await fresh();await js('game.player.x=245;game.player.y=600');
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
 await fresh();const simulation=await js("(()=>{game.spawn=1;let steps=0;for(;steps<9000&&state!=='ended';steps++){if(state==='choosing')document.querySelector('.choice').click();update(.02);}return{seconds:game.time,score:game.score,heroes:game.heroes.length,botsHealthy:game.heroes.every(h=>Number.isFinite(h.hp)&&Number.isFinite(h.x)&&Number.isFinite(h.mana)),botLevels:game.heroes.filter(h=>h!==game.player).map(h=>h.level),towers:game.units.filter(u=>u.kind==='tower').map(u=>Math.round(u.hp))}})()");assert.equal(simulation.heroes,10);assert(simulation.botsHealthy);assert(simulation.score[0]+simulation.score[1]>0,'bots must engage in combat');console.log('PASS sustained 5v5 simulation',JSON.stringify(simulation));
 await fresh();await js("for(const h of game.heroes){h.x=h.team===0?1050+(h.slot%2)*45:1360-(h.slot%2)*45;h.y=440+h.slot*78;}game.player.y=640;spawnWave();for(const u of game.units)if(u.kind==='melee'||u.kind==='caster')u.x=u.team===0?1150+u.id*3:1280+u.id*3;draw()");
 await writeFile('/tmp/hex-moba-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await new Promise(r=>setTimeout(r,200));await js('draw()');
 await check('mobile layout fits viewport','document.documentElement.scrollWidth<=innerWidth');
 await check('touch skill arms directional cast',"$('skill-e').click();armed==='e'");
 await check('touch directional cast uses 3D ground ray',"(()=>{const p=game.player,goal={x:p.x+120,y:p.y+40},screen=visual.worldToScreen(goal.x,goal.y),rect=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:rect.left+screen.x,clientY:rect.top+screen.y,pointerType:'touch',button:0,bubbles:true}));return Math.abs(p.x-goal.x)<1&&Math.abs(p.y-goal.y)<1&&armed===null})()");
 await js('draw()');
 await writeFile('/tmp/hex-moba-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 assert.equal(errors.length,0,JSON.stringify(errors));console.log('PASS no browser runtime exceptions');
}finally{ws.close();}
