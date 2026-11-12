// HTTPS fallback for networks that refuse WebSocket upgrades. Uses the same
// authoritative room and command handler; a random token owns each session.
class HexHttpTransport{
 constructor(endpoint){this.base=new URL(endpoint);this.base.protocol=this.base.protocol==='wss:'?'https:':'http:';this.base.pathname='/';this.readyState=0;this.token=null;this.queue=Promise.resolve();this.closed=false;queueMicrotask(()=>{if(this.closed)return;this.readyState=1;this.onopen?.();});}
 async request(path,data,timeout=15000){const r=await fetch(new URL(path,this.base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(timeout),cache:'no-store'});let m;try{m=await r.json();}catch{const error=Error(r.status===404?'服务器尚未支持备用连接，请部署 v5.0.2':`服务器尚未就绪（HTTP ${r.status}）`);error.retryable=r.status>=500;throw error;}if(!r.ok){if(m.messages){this.deliver(m.messages);throw Error('房间未能加入');}const error=Error(m.error||'HTTP '+r.status);error.retryable=r.status>=500;throw error;}return m;}
 async connect(command){const start=Date.now();while(!this.closed){try{return await this.request('/api/connect',command,15000);}catch(e){if((!e.retryable&&e.name!=='TypeError'&&e.name!=='TimeoutError')||Date.now()-start>75000)throw e;await new Promise(r=>setTimeout(r,2000));}}return null;}

 deliver(messages){if(this.closed)return;for(const m of messages||[])this.onmessage?.({data:JSON.stringify(m)});}
 send(text){const command=JSON.parse(text);this.queue=this.queue.then(async()=>{if(this.closed)return;if(command.type==='join'){const result=await this.connect(command);if(!result)return;this.token=result.token;if(this.closed){this.release();return;}this.deliver(result.messages);this.poll();}else if(this.token)await this.request('/api/command',{token:this.token,command});}).catch(e=>this.fail(e));}
 async poll(){let failures=0;while(!this.closed){try{const r=await this.request('/api/poll',{token:this.token});this.deliver(r.messages);failures=0;}catch(e){if(++failures>=3){this.fail(e);return;}}await new Promise(r=>setTimeout(r,100));}}
 release(){if(this.token)fetch(new URL('/api/leave',this.base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:this.token}),keepalive:true}).catch(()=>{});}
 close(){if(this.closed)return;this.closed=true;this.readyState=3;this.release();this.onclose?.({code:1000});}
 fail(error){if(this.closed)return;this.onerror?.({message:error.message});this.closed=true;this.readyState=3;this.release();this.onclose?.({code:1006});}
}
