'use strict';
class HexConnectionDiagnostics{
 constructor(){this.lines=[];this.started=performance.now();this.attempt='';this.endpoint=null;}
 reset(endpoint){this.started=performance.now();this.lines=[];this.endpoint=new URL(endpoint);this.attempt=crypto.randomUUID();this.log('环境',{clientVersion:'5.0.3',page:location.origin+location.pathname,userAgent:navigator.userAgent,online:navigator.onLine,secureContext:isSecureContext});this.log('WS 目标',{url:this.endpoint.href,attempt:this.attempt});this.probe('连接前');}
 log(event,data={}){this.lines.push(`[+${((performance.now()-this.started)/1000).toFixed(3)}s] ${event} ${JSON.stringify(data)}`);if(this.lines.length>150)this.lines.shift();const output=document.getElementById('connection-log');if(output)output.value=this.report();}
 report(){return '海克斯大乱斗连接诊断 v5.0.3\n'+this.lines.join('\n')+'\n说明：浏览器通常不会向网页提供 WS 握手的 HTTP 状态或 TLS 失败细节。1006 仅表示异常关闭，具体原因需要结合健康检查和服务端握手记录判断。';}
 async probe(stage){if(!this.endpoint)return;const url=new URL(this.endpoint);url.protocol=url.protocol==='wss:'?'https:':'http:';url.pathname='/health';url.search='';url.searchParams.set('attempt',this.attempt);const start=performance.now();this.log('健康检查开始',{stage,url:url.href});try{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});const text=await r.text();let body;try{body=JSON.parse(text);}catch{body=text.slice(0,180);}this.log('健康检查响应',{stage,httpStatus:r.status,ms:Math.round(performance.now()-start),body});}catch(e){this.log('健康检查失败',{stage,name:e.name,message:e.message,ms:Math.round(performance.now()-start)});}}
}
window.hexConnectionDiagnostics=new HexConnectionDiagnostics();
document.addEventListener('DOMContentLoaded',()=>{
 document.getElementById('copy-connection-log').onclick=async()=>{const output=document.getElementById('connection-log');output.value=window.hexConnectionDiagnostics.report();try{await navigator.clipboard.writeText(output.value);document.getElementById('copy-log-status').textContent='诊断已复制，可直接发给我分析';}catch{output.focus();output.select();document.getElementById('copy-log-status').textContent='请复制已选中的诊断文字';}};
 document.getElementById('probe-connection').onclick=()=>window.hexConnectionDiagnostics.probe('手动检查');
});
