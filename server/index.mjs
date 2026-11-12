import http from 'node:http';
import {EventEmitter} from 'node:events';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
const version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';
import {createSimulation,snapshot} from './simulation.mjs';
export function createGameServer(){
 const sessions=new Map();
 const rooms=new Map(),root=new URL('../',import.meta.url);
 const server=http.createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;if(path==='/health'||path.startsWith('/api/')){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','POST, GET, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Cache-Control','no-store');if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}}if(path.startsWith('/api/')){await api(req,res,path);return;}if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,version,rooms:rooms.size}));return;}if(!/^\/(?:|index.html|[\w-]+\.(?:js|css)|vendor\/[\w.-]+)$/.test(path)){res.writeHead(404);res.end();return;}try{const data=await readFile(fileURLToPath(new URL(path==='/'?'index.html':'.'+path,root)));res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-cache'});res.end(data);}catch{res.writeHead(404);res.end();}});
 const wss=new WebSocketServer({server,path:'/ws',maxPayload:2048});
 const send=(ws,m)=>{if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<1024*1024)ws.send(JSON.stringify(m));};
 function leave(ws){if(!ws.room)return;const r=ws.room;r.sim.release(ws.hero);r.clients.delete(ws);ws.room=null;r.emptySince=Date.now();}
 function attach(ws){ws.alive=true;ws.on('pong',()=>ws.alive=true);ws.on('error',()=>{});ws.on('close',()=>leave(ws));ws.on('message',raw=>{try{const now=Date.now();if(now-(ws.rateStart||0)>1000){ws.rateStart=now;ws.count=0;}if(++ws.count>80)return;const c=JSON.parse(raw);if(c.type==='join'){
 if(ws.room)return;const name=typeof c.name==='string'?c.name.trim().slice(0,16):'玩家';const code=String(c.room||'').toUpperCase();if(!/^[A-Z0-9]{4,12}$/.test(code)){send(ws,{type:'error',message:'房间码需为 4–12 位字母或数字'});return;}let r=rooms.get(code);if(!r){if(rooms.size>=50){send(ws,{type:'error',message:'服务器房间已满'});return;}r={code,sim:createSimulation(),clients:new Set(),emptySince:now};rooms.set(code,r);}if(r.sim.state()==='ended'){send(ws,{type:'error',message:'本局已结束，请换一个房间码'});return;}
 const slots=[0,5,1,6,2,7,3,8,4,9],index=slots.find(i=>!r.sim.game().heroes[i].human);if(index===undefined){send(ws,{type:'error',message:'房间已满（10 人）'});return;}ws.hero=r.sim.claim(index,name||'玩家');ws.room=r;r.clients.add(ws);send(ws,{type:'joined',room:code,hero:ws.hero});send(ws,{type:'snapshot',...snapshot(r.sim)});return;}
 if(!ws.room)return;
 if(['order','cast'].includes(c.type)){if(!c.point||!Number.isFinite(c.point.x)||!Number.isFinite(c.point.y))return;c.point={x:Math.max(65,Math.min(2335,c.point.x)),y:Math.max(345,Math.min(855,c.point.y))};}
 if(['cast','upgrade'].includes(c.type)&&!['q','w','e','r'].includes(c.key))return;
 if(['order','cast','stop','augment','upgrade','buy'].includes(c.type))ws.room.sim.command(ws.hero,c);
 }catch{send(ws,{type:'error',message:'请求无效，请重试'});}});}
 wss.on('connection',attach);

 async function api(req,res,path){
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  if(req.method!=='POST'){reply(405,{error:'POST required'});return;}
  let data;try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048){reply(413,{error:'Request too large'});return;}}data=JSON.parse(raw);}catch{reply(400,{error:'Invalid JSON'});return;}
  if(path==='/api/connect'){
   if(sessions.size>=500){reply(503,{error:'服务器繁忙'});return;}
   const token=randomBytes(32).toString('hex'),client=new EventEmitter();Object.assign(client,{readyState:1,bufferedAmount:0,messages:[],seen:Date.now(),token});
   client.send=text=>{const m=JSON.parse(text);if(m.type==='snapshot')client.messages=client.messages.filter(v=>v.type!=='snapshot');client.messages.push(m);if(client.messages.length>32)client.messages.shift();};
   client.terminate=()=>{if(client.readyState===3)return;client.readyState=3;client.emit('close');sessions.delete(token);};
   attach(client);client.emit('message',JSON.stringify({...data,type:'join'}));
   if(!client.room){const messages=client.messages;client.terminate();reply(400,{messages});return;}
   sessions.set(token,client);reply(200,{token,messages:client.messages.splice(0)});return;
  }
  const client=sessions.get(data.token);if(!client){reply(401,{error:'连接已过期，请重新加入房间'});return;}client.seen=Date.now();
  if(path==='/api/poll'){reply(200,{messages:client.messages.splice(0)});}
  else if(path==='/api/command'){client.emit('message',JSON.stringify(data.command));reply(200,{ok:true});}
  else if(path==='/api/leave'){client.terminate();reply(200,{ok:true});}
  else reply(404,{error:'Unknown endpoint'});
 }
 let tick=0;const timer=setInterval(()=>{tick++;for(const [code,r]of rooms){if(!r.clients.size){if(Date.now()-r.emptySince>30000)rooms.delete(code);continue;}r.sim.tick(1/30);if(tick%3===0){const message={type:'snapshot',...snapshot(r.sim)};for(const ws of r.clients)send(ws,message);}}},1000/30);
 const heartbeat=setInterval(()=>{for(const client of sessions.values())if(Date.now()-client.seen>15000)client.terminate();for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},10000);
 return {server,rooms,close(){clearInterval(timer);clearInterval(heartbeat);for(const client of sessions.values())client.terminate();for(const ws of wss.clients)ws.terminate();wss.close();return new Promise(resolve=>server.close(resolve));}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const app=createGameServer();app.server.listen(Number(process.env.PORT)||5173,'0.0.0.0',()=>console.log('Hex Heroes multiplayer server listening'));}
