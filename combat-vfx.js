const B=globalThis.BABYLON,TAU=Math.PI*2;
// Each effect owns its geometry and materials; nothing remains after its lifetime.
export function createCombatEffect(scene,f){
 const root=new B.TransformNode('vfx-'+f.type,scene),parts=[],sparks=[];
 const color=B.Color3.FromHexString(f.color||'#8ee7e8');
 function material(name,alpha=1,white=false){const m=new B.StandardMaterial('vfx-'+name,scene);m.disableLighting=true;m.emissiveColor=white?new B.Color3(1,.98,.88):color;m.diffuseColor=B.Color3.Black();m.alpha=alpha;m.backFaceCulling=false;m.disableDepthWrite=true;return m;}
 const bright=material('core',.95,true),glow=material('energy',.8),mist=material('mist',.16);
 function own(m,mat=glow){m.parent=root;m.material=mat;m.isPickable=false;m.renderingGroupId=1;parts.push(m);return m;}
 function ring(r,y=4,thickness=3,mat=glow){const m=own(B.MeshBuilder.CreateTorus('spell-ring',{diameter:r*2,thickness,tessellation:64},scene),mat);m.position.y=y;return m;}
 function sphere(r,mat=mist){return own(B.MeshBuilder.CreateSphere('spell-volume',{diameter:r*2,segments:16},scene),mat);}
 function beam(a,b,width=3,mat=bright){const delta=b.subtract(a),m=own(B.MeshBuilder.CreateCylinder('energy-beam',{height:delta.length(),diameter:width,tessellation:6},scene),mat);m.position.copyFrom(a.add(b).scale(.5));m.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,delta.normalize(),new B.Quaternion());return m;}
 function arc(radius,angle=2.3){const positions=[],indices=[];for(let i=0;i<=48;i++){const a=-angle/2+angle*i/48;for(const r of [radius*.63,radius])positions.push(Math.cos(a)*r,14+Math.sin(i/48*Math.PI)*12,Math.sin(a)*r);if(i<48){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}}const m=new B.Mesh('crescent-blade',scene),data=new B.VertexData();data.positions=positions;data.indices=indices;data.normals=[];B.VertexData.ComputeNormals(positions,indices,data.normals);data.applyToMesh(m);return own(m,glow);}
 const radius=f.radius||50;
 function particles(count=16){for(let i=0;i<count;i++){const m=own(B.MeshBuilder.CreatePolyhedron('spell-spark',{type:1,size:2.5+(i%3)},scene),i%3?glow:bright);sparks.push({m,angle:i*2.39996,speed:radius*(.45+(i%5)*.13),rise:35+(i%4)*22});}}
 let a,b,c,shaft,blade;
 if(f.type==='slash'){
  a=arc(radius);b=arc(radius*.85);b.material=bright;b.scaling.y=.5;particles(10);
 }else if(f.type==='dash'){
  const dx=f.to.x-f.x,dz=f.to.y-f.y;
  for(const side of [-1,0,1])beam(new B.Vector3(0,25+side*10,0),new B.Vector3(dx,25+side*10,dz),side?4:9,side?glow:bright);
  for(let i=0;i<5;i++){const m=sphere(18,mist);m.position.set(dx*i/4,42,dz*i/4);m.scaling.set(.65,2,.65);}
  a=ring(30);a.position.set(dx,5,dz);particles(12);
 }else if(f.type==='ultimate'||f.type==='enemySpell'){
  a=ring(radius,4,4);b=ring(radius*.82,5,1.5,bright);c=sphere(radius,mist);c.scaling.y=.03;
  for(let i=0;i<8;i++){const t=i*TAU/8;beam(new B.Vector3(Math.cos(t)*radius*.82,6,Math.sin(t)*radius*.82),new B.Vector3(Math.cos(t)*radius*.96,6,Math.sin(t)*radius*.96),4);}
  shaft=own(B.MeshBuilder.CreateCylinder('descending-spell',{height:180,diameterTop:8,diameterBottom:30,tessellation:8},scene),glow);
  blade=sphere(f.type==='ultimate'?24:18,bright);blade.scaling.set(.7,1.8,.7);particles(14);
 }else if(f.type==='blast'){
  a=ring(radius,6,5,bright);b=ring(radius*.7,12,7);c=sphere(radius,mist);shaft=own(B.MeshBuilder.CreateCylinder('impact-pillar',{height:180,diameterTop:12,diameterBottom:radius*.7,tessellation:12},scene),glow);shaft.position.y=90;particles(24);
 }else if(f.type==='heal'){
  a=ring(radius,4,3);b=ring(radius*.7,6,2,bright);c=sphere(radius,mist);c.position.y=45;c.scaling.y=1.4;
  for(let i=0;i<4;i++){const x=Math.cos(i*TAU/4)*30,z=Math.sin(i*TAU/4)*30;beam(new B.Vector3(x-7,50,z),new B.Vector3(x+7,50,z),4);beam(new B.Vector3(x,42,z),new B.Vector3(x,58,z),4);}
  if(f.source)beam(new B.Vector3(f.source.x-f.x,55,f.source.y-f.y),new B.Vector3(0,55,0),3,glow);particles(12);
 }else if(f.type==='impact'){
  c=sphere(16,bright);c.position.y=45;particles(9);
 }else{
  a=ring(radius,5,4);b=ring(radius*.85,65,2,bright);c=sphere(radius,mist);c.position.y=48;c.scaling.y=1.5;particles(12);
 }
 function update(age=0){const t=Math.max(0,Math.min(1,1-(f.life-age)/f.maxLife)),fade=1-t;
  root.position.set(f.follow&&f.source?f.source.x:f.x,0,f.follow&&f.source?f.source.y:f.y);
  bright.alpha=Math.min(1,fade*2.5);glow.alpha=Math.min(.9,fade*1.7);mist.alpha=.16*fade;
  if(f.type==='slash'){a.rotation.y=-(f.angle||0)+(.5-t)*.9;b.rotation.y=a.rotation.y+.12;a.scaling.setAll(.8+t*.3);b.scaling.setAll(.8+t*.3);}
  else if(f.type==='ultimate'||f.type==='enemySpell'){a.scaling.setAll(1);b.rotation.y=t*2;c.scaling.x=c.scaling.z=.1+t*.9;shaft.position.y=360*(1-t)+70;shaft.scaling.y=.5+t*.6;blade.position.y=360*(1-t)+35;bright.alpha=.7+t*.3;glow.alpha=.6+t*.3;mist.alpha=.1+t*.1;}
  else if(f.type==='blast'){a.scaling.setAll(.2+t*1.15);b.scaling.setAll(.1+t*1.5);c.scaling.set(.2+t,.15+Math.sin(t*Math.PI)*.4,.2+t);shaft.scaling.set(1-t*.7,1-t*.9,1-t*.7);}
  else if(f.type==='heal'){b.position.y=15+t*100;}
  else if(f.type==='impact'){c.scaling.setAll(.2+Math.sin(t*Math.PI)*1.5);}
  else if(f.type!=='dash'){a.scaling.setAll(.8+t*.3);b.position.y=20+t*95;}
  for(let i=0;i<sparks.length;i++){const s=sparks[i],d=(f.type==='ultimate'||f.type==='enemySpell')?radius*(1-t):s.speed*t;s.m.position.set(Math.cos(s.angle)*d,8+Math.sin(t*Math.PI)*s.rise,Math.sin(s.angle)*d);s.m.scaling.setAll(Math.max(.05,fade));s.m.rotation.set(t*4,i+t*3,t*2);}
 }
 update();return {root,update,dispose(){root.dispose();bright.dispose();glow.dispose();mist.dispose();}};
}
export function createProjectile(scene){
 const root=new B.TransformNode('spell-projectile',scene),m=new B.StandardMaterial('projectile-energy',scene);m.disableLighting=true;m.emissiveColor=new B.Color3(.5,.9,1);
 const core=B.MeshBuilder.CreateSphere('projectile-core',{diameter:11,segments:8},scene);core.parent=root;core.material=m;core.isPickable=false;
 const tail=B.MeshBuilder.CreateCylinder('projectile-streak',{height:44,diameterTop:1,diameterBottom:7,tessellation:6},scene);tail.parent=root;tail.material=m;tail.rotation.x=Math.PI/2;tail.position.z=-22;tail.isPickable=false;
 return {root,update(s){root.setEnabled(true);root.position.set(s.x,38,s.y);root.rotation.y=Math.atan2(s.target.x-s.x,s.target.y-s.y);m.emissiveColor=B.Color3.FromHexString(s.color||'#88ddff');const special=s.skill;core.scaling.setAll(special?1.5:1);tail.scaling.y=special?1.7:1;}};
}
