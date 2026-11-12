import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {createGameServer} from '../server/index.mjs';
import {createSimulation,snapshot} from '../server/simulation.mjs';
const app=createGameServer();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port,clients=[];
async function connect(room='TEST42',name='Tester'){const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);ws.messages=[];ws.on('message',m=>ws.messages.push(JSON.parse(m)));await new Promise(r=>ws.once('open',r));clients.push(ws);ws.send(JSON.stringify({type:'join',room,name}));return ws;}
async function waitFor(fn){const until=Date.now()+5000;while(Date.now()<until){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out');}
const last=w=>w.messages.findLast(m=>m.type==='snapshot'),joined=w=>w.messages.find(m=>m.type==='joined');
try{
 assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status,200);assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status,200);assert.equal((await fetch(`http://127.0.0.1:${port}/.git/config`)).status,404);
 const a=await connect(),b=await connect();await waitFor(()=>joined(a)&&joined(b)&&last(a)?.units.filter(u=>u.human).length===2);
 const own=joined(a).hero,enemy=joined(b).hero;assert.notEqual(own,enemy);assert.equal(last(a).units.find(u=>u.id===own).team,0);assert.equal(last(b).units.find(u=>u.id===enemy).team,1);
 assert.equal(last(a).units.filter(u=>u.kind==='hero').length,10);assert.equal(last(a).units.filter(u=>u.kind==='hero'&&!u.human).length,8);console.log('PASS two actual sockets share 5v5 room with eight bots');
 a.send(JSON.stringify({type:'order',point:{x:700,y:600}}));await waitFor(()=>last(a).units.find(u=>u.id===own).x>300);const sa=last(a),sb=last(b);assert(Math.abs(sa.time-sb.time)<.15);assert(Math.abs(sa.units.find(u=>u.id===own).x-sb.units.find(u=>u.id===own).x)<40);console.log('PASS authoritative movement visible to both clients');
 const choices=last(a).units.find(u=>u.id===own).choices;a.send(JSON.stringify({type:'augment',id:choices[0]}));await waitFor(()=>last(a).units.find(u=>u.id===own).augmentHistory.length===1);
 a.send(JSON.stringify({type:'cast',key:'w',point:{x:500,y:600}}));await waitFor(()=>last(b).units.find(u=>u.id===own).action?.kind==='guard');assert(last(b).effects.some(f=>f.type==='shield'));console.log('PASS augment choice and cast action/VFX replicated');
 const isolated=await connect('OTHER42');await waitFor(()=>joined(isolated));assert.equal(last(isolated).units.filter(u=>u.human).length,1);console.log('PASS room isolation');
 const extra=await Promise.all(Array.from({length:8},()=>connect()));await waitFor(()=>extra.every(joined));const full=await connect();await waitFor(()=>full.messages.some(m=>m.type==='error'));assert(full.messages.find(m=>m.type==='error').message.includes('10'));console.log('PASS ten-player capacity and full-room rejection');
 const before=last(b).units.find(u=>u.id===own).x;a.close();await waitFor(()=>last(b).units.find(u=>u.id===own).human===false);await waitFor(()=>Math.abs(last(b).units.find(u=>u.id===own).x-before)>5);console.log('PASS disconnect immediately hands hero to AI');
 const replacement=await connect();await waitFor(()=>joined(replacement));assert.equal(joined(replacement).hero,own);console.log('PASS late join replaces free AI slot');
 const post=async(path,data)=>{const r=await fetch(`http://127.0.0.1:${port}/api/`+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {r,data:await r.json()};};
 const http=await post('connect',{room:'HTTP42',name:'HTTPS player'});assert.equal(http.r.status,200);assert.equal(http.r.headers.get('access-control-allow-origin'),'*');const token=http.data.token,httpHero=http.data.messages.find(m=>m.type==='joined').hero;
 const peer=await connect('HTTP42');await waitFor(()=>joined(peer));await post('command',{token,command:{type:'order',point:{x:700,y:600}}});await waitFor(()=>last(peer).units.find(u=>u.id===httpHero).x>300);
 const polled=await post('poll',{token});assert(polled.data.messages.some(m=>m.type==='snapshot'));assert.equal((await post('poll',{token:'forged'})).r.status,401);await post('leave',{token});await waitFor(()=>last(peer).units.find(u=>u.id===httpHero).human===false);console.log('PASS HTTPS fallback shares rooms with WebSocket, validates tokens and releases AI slot');
 // Malformed payloads and impossible casts never mutate the authoritative state.
 const sim=createSimulation();const id=sim.claim(0,'A');const h=sim.game().heroes[0],mana=h.mana;sim.command(id,{type:'cast',key:'r',point:{x:1000,y:600}});assert.equal(h.mana,mana);for(let i=0;i<1800;i++)sim.tick(1/30);const s=snapshot(sim);assert(s.units.every(u=>Number.isFinite(u.x)&&Number.isFinite(u.hp)));assert.doesNotThrow(()=>JSON.stringify(s));console.log('PASS sustained server simulation and locked-skill validation');
}finally{for(const ws of clients)ws.close();await app.close();}
