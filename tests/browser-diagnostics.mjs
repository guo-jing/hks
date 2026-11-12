import assert from 'node:assert/strict';
const base=process.env.MULTIPLAYER_URL||'http://localhost:5177';
const target=await(await fetch('http://localhost:9222/json/new?about:blank',{method:'PUT'})).json();const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)(m);pending.delete(m.id);}};const send=(method,params={})=>new Promise(r=>{pending.set(++id,r);ws.send(JSON.stringify({id,method,params}))});const js=async expression=>{const m=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!m.error,JSON.stringify(m.error));assert(!m.result.exceptionDetails,JSON.stringify(m.result.exceptionDetails));return m.result.result.value;};
try{
 await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*boot.js']});await send('Page.enable');await send('Page.navigate',{url:base});
 for(let i=0;i<100;i++){if(await js("document.readyState==='complete'&&!!window.hexConnectionDiagnostics"))break;await new Promise(r=>setTimeout(r,50));}
 await js("var multiplayer=null;var state='ready';var $=id=>document.getElementById(id);window.WebSocket=class{static OPEN=1;constructor(){this.readyState=0;setTimeout(()=>this.onerror?.({type:'error'}),20);}close(){this.readyState=3;this.onclose?.({code:1006,reason:'',wasClean:false});}};");
 await js("new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./multiplayer.js';s.onload=resolve;s.onerror=reject;document.body.append(s);})");
 await js("$('multiplayer-open').click();$('ws-only').checked=true;multiplayer.join($('server-url').value,'DIAG42','Tester');");
 for(let i=0;i<100;i++){if(await js("hexConnectionDiagnostics.report().includes('健康检查响应')&&hexConnectionDiagnostics.report().includes('WS close')"))break;await new Promise(r=>setTimeout(r,50));}
 const report=await js('hexConnectionDiagnostics.report()');for(const text of ['WS error','WS close','1006','wasClean','已禁用 HTTPS 回退','健康检查响应','5.0.3'])assert(report.includes(text),text);
 assert(await js("!multiplayer.active&&$('connection-diagnostics').open&&$('room-status').textContent.includes('WS 连接失败')"));
 await js("$('copy-connection-log').click()");assert((await js("$('connection-log').value")).includes('WS close'));console.log('PASS WS-only failure events, health results and copyable diagnostics in real webpage');
}finally{ws.close();await fetch('http://localhost:9222/json/close/'+target.id);}
