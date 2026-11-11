const B=globalThis.BABYLON;
export function createBattlefield(scene){
 const root=new B.TransformNode('frostbound-citadel',scene),materials=new Map();
 const mat=(c,glow=0)=>{if(!materials.has(c+glow)){const m=new B.StandardMaterial(c+glow,scene);m.diffuseColor=B.Color3.FromHexString(c);m.specularColor=new B.Color3(.15,.2,.24);m.emissiveColor=m.diffuseColor.scale(glow);materials.set(c+glow,m);}return materials.get(c+glow);};
 function box(x,y,z,w,h,d,c){const m=B.MeshBuilder.CreateBox('citadel-stone',{width:w,height:h,depth:d},scene);m.position.set(x,y,z);m.material=mat(c);m.parent=root;m.receiveShadows=true;m.isPickable=false;return m;}
 function cone(x,y,z,r,h,c,n=7){const m=B.MeshBuilder.CreateCylinder('ice-spire',{diameterTop:0,diameterBottom:r*2,height:h,tessellation:n},scene);m.position.set(x,y,z);m.material=mat(c);m.parent=root;m.isPickable=false;return m;}
 box(1200,-40,600,2450,72,590,'#203343');
 const tex=new B.DynamicTexture('carved-stone',{width:512,height:512},scene,false),ctx=tex.getContext();ctx.fillStyle='#536474';ctx.fillRect(0,0,512,512);
 let seed=27;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<16000;i++){const v=70+rand()*65;ctx.fillStyle=`rgba(${v},${v+14},${v+22},.16)`;ctx.fillRect(rand()*512,rand()*512,2+rand()*4,2);}
 for(let row=0;row<4;row++)for(let col=-1;col<4;col++){const x=col*170+(row%2)*85,y=row*128;ctx.strokeStyle='#233747';ctx.lineWidth=6;ctx.strokeRect(x+2,y+2,165,123);ctx.strokeStyle='#7d8b94';ctx.lineWidth=1;ctx.strokeRect(x+6,y+6,155,113);}tex.update();tex.uScale=10;tex.vScale=2.3;
 const floor=box(1200,-2,600,2400,4,550,'#657788');floor.material=new B.StandardMaterial('weathered-paving',scene);floor.material.diffuseTexture=tex;floor.material.diffuseColor=new B.Color3(.85,.9,1);floor.material.emissiveColor=new B.Color3(.12,.15,.19);floor.material.specularColor=new B.Color3(.06,.08,.1);
 for(let row=0;row<6;row++)for(let col=0;col<24;col++){const x=col*100+50+(row%2)*35;if(x>2380)continue;box(x,.5,350+row*100,97,2,97,['#506575','#556b7b','#496171','#5b6d7a'][Math.floor(rand()*4)]);}
 for(const z of [326,874]){box(1200,3,z,2410,12,16,'#a39470');box(1200,10,z,2410,4,10,'#ccdae0');for(let x=40;x<2400;x+=160){box(x,17,z,38,40,40,'#354c60');box(x,40,z,49,7,49,'#c2d5dd');}}
 for(const x of [150,1200,2250])for(const r of [85,108,130]){const ring=B.MeshBuilder.CreateTorus('inlaid-seal',{diameter:r*2,thickness:2,tessellation:64},scene);ring.position.set(x,1,600);ring.material=mat('#a99d77');ring.parent=root;ring.isPickable=false;}
 for(let x=350;x<2200;x+=260)for(const z of [280,920]){box(x,24,z,30,48,30,'#304b60');box(x,51,z,40,8,40,'#baa578');const gem=B.MeshBuilder.CreatePolyhedron('lantern',{type:1,size:12},scene);gem.position.set(x,70,z);gem.material=mat('#71d7f2',1);gem.parent=root;gem.isPickable=false;}
 for(let i=0;i<70;i++){const x=rand()*3300-450,z=i%2?1030+rand()*450:170-rand()*450,h=100+rand()*280;cone(x,-80,z,80+rand()*100,h,'#243f54',5);if(i%3===0){for(let j=0;j<3;j++)cone(x,20+j*35,z,48-j*10,100-j*15,j%2?'#acc8d5':'#345866',7);}else{const ice=cone(x,15,z,25+rand()*30,100+rand()*100,'#689aae',5);ice.rotation.z=(rand()-.5)*.5;}}
 box(1200,-250,600,8000,10,7000,'#102737');
 // Merge scenery by material to keep draw calls stable as waves grow.
 for(const material of [...materials.values()]){const meshes=root.getChildMeshes().filter(m=>m.material===material);if(meshes.length>1)B.Mesh.MergeMeshes(meshes,true,true,undefined,false,true);}
 return root;
}
