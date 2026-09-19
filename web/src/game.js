import {createGamePlayerProfile} from "./playerProfiles.js";
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const root=document.querySelector("#game"),scoreEl=document.querySelector("#score"),clockEl=document.querySelector("#clock"),msg=document.querySelector("#message");
const FIELD={w:106,d:68,goalW:14}, state={score:[0,0],time:180,over:false,joy:{x:0,y:0},actions:{},selected:0,kickLock:0,tackleLock:0};
const scene=new THREE.Scene();scene.background=new THREE.Color(0x07140d);scene.fog=new THREE.Fog(0x07140d,80,175);
const camera=new THREE.PerspectiveCamera(54,1,.1,220);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;root.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xdceeff,0x153d20,2.2));
const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(-35,55,25);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
const M=(c,r=.72)=>new THREE.MeshStandardMaterial({color:c,roughness:r}),lineMat=new THREE.MeshBasicMaterial({color:0xffffff}),blue=M(0x287cf0),red=M(0xe33d45),white=M(0xf2f2f2),skin=M(0xf0bd8a),hair=M(0x241a16),black=M(0x151515),ballMat=M(0xffffff,.55);
function box(w,h,d,m,x=0,y=0,z=0){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;return o}
function cyl(r,h,m,x=0,y=0,z=0){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.96,h,10),m);o.position.set(x,y,z);o.castShadow=true;return o}
function mark(x1,z1,x2,z2,w=.16){const l=Math.hypot(x2-x1,z2-z1),o=box(w,.035,l,lineMat);o.position.set((x1+x2)/2,.025,(z1+z2)/2);o.rotation.y=Math.atan2(x2-x1,z2-z1);scene.add(o)}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(122,84),M(0x0b301b));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const pitch=new THREE.Mesh(new THREE.PlaneGeometry(FIELD.w,FIELD.d),M(0x176b38));pitch.rotation.x=-Math.PI/2;pitch.position.y=.01;pitch.receiveShadow=true;scene.add(pitch);
mark(-53,-34,53,-34);mark(-53,34,53,34);mark(-53,-34,-53,34);mark(53,-34,53,34);mark(0,-34,0,34);mark(-37,-20,-37,20);mark(37,-20,37,20);
const circle=new THREE.Mesh(new THREE.RingGeometry(8.95,9.15,64),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}));circle.rotation.x=-Math.PI/2;circle.position.y=.035;scene.add(circle);
for(const x of[-54.2,54.2]){const g=new THREE.Group(),pm=M(0xffffff,.35);g.add(cyl(.16,3.1,pm,-7,1.55,0),cyl(.16,3.1,pm,7,1.55,0),box(.16,.16,14,pm,0,3.1,0));g.position.x=x;scene.add(g)}

function jerseyNumberTexture(number,color){
 const canvas=document.createElement("canvas");canvas.width=128;canvas.height=128;
 const ctx=canvas.getContext("2d");ctx.clearRect(0,0,128,128);
 ctx.font="900 76px Arial";ctx.textAlign="center";ctx.textBaseline="middle";
 ctx.lineWidth=10;ctx.strokeStyle="rgba(0,0,0,.55)";ctx.strokeText(String(number),64,66);
 ctx.fillStyle=color;ctx.fillText(String(number),64,66);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
const RIGGED_PLAYER_URL="https://raw.githubusercontent.com/Seyamalam/blood-league-kickoff/main/public/assets/vendor/quaternius/night-striker.glb";
const ANIMATION_LIBRARY_URL="https://raw.githubusercontent.com/Seyamalam/blood-league-kickoff/main/public/assets/vendor/quaternius/universal-animation-library.glb";
const rigLoader=new GLTFLoader();
let riggedSource=null,animationSource=null,rigLoadPromise=null,animationLoadPromise=null;
function loadRiggedSource(){if(rigLoadPromise)return rigLoadPromise;rigLoadPromise=new Promise((resolve,reject)=>rigLoader.load(RIGGED_PLAYER_URL,g=>{riggedSource=g;resolve(g)},undefined,reject));return rigLoadPromise}
function loadAnimationSource(){if(animationLoadPromise)return animationLoadPromise;animationLoadPromise=new Promise((resolve,reject)=>rigLoader.load(ANIMATION_LIBRARY_URL,g=>{animationSource=g;resolve(g)},undefined,reject));return animationLoadPromise}
function recolorRiggedModel(model,team){
 const shirt=team===blue?0x2f78d0:team===red?0xd93445:0xf0f0f0,shorts=team===blue?0x174f9d:team===red?0x8f1728:0x333333;
 model.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];o.material=mats.map(m=>{const n=(m?.name||o.name||"").toLowerCase(),mm=m.clone();if(/shirt|jersey|top|upper|torso|clothes/.test(n))mm.color?.setHex(shirt);else if(/short|pants|trouser/.test(n))mm.color?.setHex(shorts);return mm});if(o.material.length===1)o.material=o.material[0]});
}
function fitRiggedModel(model){
 const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
 if(size.y>0)model.scale.multiplyScalar(3.45/size.y);
 model.updateMatrixWorld(true);
 const fitted=new THREE.Box3().setFromObject(model);
 // The GLB's scene/root transform can place the skinned feet above the local origin.
 // Normalize the visual model so its lowest point is exactly on the pitch.
 model.position.y-=fitted.min.y;
 model.updateMatrixWorld(true);
}
function keepRiggedFeetOnPitch(group){
 const model=group.userData.riggedModel;
 if(!model)return;
 model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(model);
 if(Number.isFinite(box.min.y))model.position.y-=box.min.y;
}
async function attachRiggedVisual(g,team){
 try{
  const source=await loadRiggedSource(),model=SkeletonUtils.clone(source.scene);recolorRiggedModel(model,team);fitRiggedModel(model);g.add(model);g.userData.riggedModel=model;
  try{const anim=await loadAnimationSource();if(anim?.animations?.length){const mixer=new THREE.AnimationMixer(model),clips=anim.animations,preferred=clips.find(x=>/idle|jog|walk/i.test(x.name))||clips[0],action=mixer.clipAction(preferred);action.play();g.userData.rigMixer=mixer;g.userData.rigAction=action}}catch{}
  for(const ch of [...g.children])if(ch!==model&&ch.userData?.legacyVisual)g.remove(ch);
 }catch{}
}

function makePlayer(team,number,controlled=false,role="MID",profileOverrides={}){
 const g=new THREE.Group();
 const palette=team===blue
   ? {shirt:0x2f78d0,shorts:0x174f9d,socks:0xf4f7ff,accent:0xdbe8ff}
   : team===red
   ? {shirt:0xd93445,shorts:0x8f1728,socks:0xf7f7f7,accent:0xffd6d9}
   : {shirt:0xf0f0f0,shorts:0x333333,socks:0xf0f0f0,accent:0xffc800};
 const variants=[
   {skin:0xf0bd8a,hair:0x241a16,scale:1.00,shoulder:1.00},
   {skin:0xc98b63,hair:0x111111,scale:.97,shoulder:.94},
   {skin:0x8d5a3b,hair:0x21150f,scale:1.03,shoulder:1.06},
   {skin:0xf3c9a5,hair:0x6b3f22,scale:.94,shoulder:.92},
   {skin:0xb66b45,hair:0x3a2419,scale:1.06,shoulder:1.08}
 ];
 const v=variants[(number+role.length+(team===red?2:0))%variants.length];
 const skinMat=M(v.skin),hairMat=M(v.hair),shirtMat=M(palette.shirt),shortMat=M(palette.shorts),sockMat=M(palette.socks),bootMat=M(0x101318),accentMat=M(palette.accent);
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.56*v.shoulder,.82*v.scale,6,10),shirtMat);
 torso.position.y=2.18;torso.scale.z=.68;torso.castShadow=true;
 const neck=cyl(.16,.22,skinMat,0,2.86,0);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.38*v.scale,14,10),skinMat);head.position.y=3.25;head.castShadow=true;
 const hair=new THREE.Mesh(new THREE.SphereGeometry(.405*v.scale,14,8),hairMat);hair.scale.set(1,.58,1);hair.position.y=3.48;hair.castShadow=true;
 const shorts=box(.92*v.shoulder,.42,.62,shortMat,0,1.48,0);
 const armL=cyl(.13,.88,skinMat,-.69*v.shoulder,2.12,0),armR=cyl(.13,.88,skinMat,.69*v.shoulder,2.12,0);
 armL.rotation.z=-.18;armR.rotation.z=.18;
 const sleeveL=cyl(.17,.34,shirtMat,-.62*v.shoulder,2.42,0),sleeveR=cyl(.17,.34,shirtMat,.62*v.shoulder,2.42,0);
 const legL=new THREE.Group(),legR=new THREE.Group();
 const thighL=cyl(.20,.72,shortMat,-.24*v.shoulder,1.02,0),thighR=cyl(.20,.72,shortMat,.24*v.shoulder,1.02,0);
 const shinL=cyl(.17,.72,sockMat,-.24*v.shoulder,.45,0),shinR=cyl(.17,.72,sockMat,.24*v.shoulder,.45,0);
 const bootL=box(.31,.18,.58,bootMat,-.24*v.shoulder,.09,-.18),bootR=box(.31,.18,.58,bootMat,.24*v.shoulder,.09,-.18);
 const stripeL=box(.025,.12,.64,accentMat,-.24*v.shoulder,1.02,.315),stripeR=box(.025,.12,.64,accentMat,.24*v.shoulder,.45,.315);
 const badge=box(.18,.22,.035,accentMat,0,2.32,-.39);
 const numberFront=new THREE.Mesh(new THREE.PlaneGeometry(.48,.52),new THREE.MeshBasicMaterial({map:jerseyNumberTexture(number,team===blue?"#ffffff":"#ffffff"),transparent:true,depthWrite:false}));
 numberFront.position.set(0,2.18,-.355);
 const numberBack=new THREE.Mesh(new THREE.PlaneGeometry(.48,.52),new THREE.MeshBasicMaterial({map:jerseyNumberTexture(number,team===blue?"#ffffff":"#ffffff"),transparent:true,depthWrite:false}));
 numberBack.position.set(0,2.18,.355);numberBack.rotation.y=Math.PI;
 g.add(torso,neck,head,hair,shorts,armL,armR,sleeveL,sleeveR,thighL,thighR,shinL,shinR,bootL,bootR,stripeL,stripeR,badge,numberFront,numberBack);
 g.userData.legL=thighL;g.userData.legR=thighR;g.userData.armL=armL;g.userData.armR=armR;g.userData.torso=torso;g.userData.head=head;
 const ring=new THREE.Mesh(new THREE.RingGeometry(.72,.9,32),new THREE.MeshBasicMaterial({color:controlled?0xffdf3f:0xffffff,transparent:true,opacity:controlled?.9:.25,side:THREE.DoubleSide}));
 ring.rotation.x=-Math.PI/2;ring.position.y=.04;g.add(ring);
 g.scale.setScalar(v.scale);
 g.userData={number,homeX:0,homeZ:0,stamina:100,controlled,team,walkPhase:Math.random()*Math.PI*2,lastX:0,lastZ:0,profile:createGamePlayerProfile(role,profileOverrides),aiKick:0};
 g.children.forEach(ch=>{if(ch!==ring)ch.userData.legacyVisual=true});
 scene.add(g);attachRiggedVisual(g,team);return g;
}
const player=makePlayer(blue,10,true,"FWD",{pace:91,shooting:88,dribbling:90});
const mates=Array.from({length:10},(_,i)=>makePlayer(blue,[1,2,3,4,5,6,7,8,9,11][i],false,i<3?"DEF":i<7?"MID":"FWD"));
const foes=Array.from({length:11},(_,i)=>makePlayer(red,[1,2,3,4,5,6,7,8,9,10,11][i],false,i<4?"DEF":i<8?"MID":"FWD"));
const homePos=[[-44,0],[-36,-22],[-36,22],[-18,-25],[-18,-9],[-18,9],[-18,25],[4,-25],[7,-8],[7,8],[4,25]];
const awayPos=[[44,0],[36,-22],[36,22],[18,-25],[18,-9],[18,9],[18,25],[-4,-25],[-7,-8],[-7,8],[-4,25]];
mates.forEach((p,i)=>{p.position.set(...homePos[i],0);p.userData.homeX=homePos[i][0];p.userData.homeZ=homePos[i][1]});
foes.forEach((p,i)=>{p.position.set(...awayPos[i],0);p.userData.homeX=awayPos[i][0];p.userData.homeZ=awayPos[i][1]});
player.position.set(-40,0,0);player.userData.homeX=-40;player.userData.homeZ=0;
const gks=[makePlayer(white,1,false,"GK"),makePlayer(white,1,false,"GK")];gks[0].scale.setScalar(.94);gks[1].scale.setScalar(.94);
const ball=new THREE.Mesh(new THREE.SphereGeometry(.48,16,12),ballMat);ball.castShadow=true;ball.position.set(0,.48,0);ball.userData={vx:0,vz:0,owner:null};scene.add(ball);

function allHome(){return [player,...mates]}
function controlled(){return allHome()[state.selected]}
function selectPlayer(n){
 state.selected=((n%allHome().length)+allHome().length)%allHome().length;
 allHome().forEach((p,i)=>p.userData.controlled=i===state.selected);
}
function selectBestDefender(){
 const hs=allHome(), target=ball.userData.owner&&ball.userData.owner.team===red?ball.userData.owner:ball;
 let best=0,bestScore=Infinity;
 hs.forEach((p,i)=>{
   const d=dist(p,target);
   const forwardBias=Math.max(0,p.position.x-target.position.x)*0.18;
   const score=d+forwardBias-(p.userData.profile.defending/100)*1.8;
   if(score<bestScore){bestScore=score;best=i}
 });
 selectPlayer(best);
}
function reset(text="KICK OFF"){
 ball.position.set(0,.48,0);ball.userData.vx=ball.userData.vz=0;ball.userData.owner=null;
 player.position.set(-40,0,0);mates.forEach((p,i)=>p.position.set(...homePos[i],0));foes.forEach((p,i)=>p.position.set(...awayPos[i],0));
 gks[0].position.set(-50,0,0);gks[1].position.set(50,0,0);selectPlayer(0);msg.textContent=text;setTimeout(()=>{if(msg.textContent===text)msg.textContent=""},1100)
}
function dist(a,b){return Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)}
function move(a,x,z,s,dt){const dx=x-a.position.x,dz=z-a.position.z,d=Math.hypot(dx,dz);if(d>.08){const q=Math.min(d,s*dt);a.position.x+=dx/d*q;a.position.z+=dz/d*q;a.rotation.y=Math.atan2(dx,dz)}}
function nearestMate(){
 return mates.reduce((b,p)=>dist(p,controlled())<dist(b,controlled())?p:b,mates[0])
}
function kickTo(tx,tz,power){
 const p=controlled(),dx=ball.position.x-p.position.x,dz=ball.position.z-p.position.z;
 if(Math.hypot(dx,dz)>3.1||performance.now()<state.kickLock)return;
 const x=tx-ball.position.x,z=tz-ball.position.z,l=Math.hypot(x,z)||1;
 ball.userData.owner=null;const passScale=p.userData.profile.passing/80;
 ball.userData.vx=x/l*power*passScale;ball.userData.vz=z/l*power*passScale;state.kickLock=performance.now()+260
}
function actions(){
 const a=state.actions,p=controlled();
 if(a.switch){selectBestDefender();state.actions.switch=false}
 if(a.pass){const t=nearestMate();kickTo(t.position.x,t.position.z,22);state.actions.pass=false}
 if(a.shoot){kickTo(53,-p.position.z*.35,32*(p.userData.profile.shooting/80));state.actions.shoot=false}
 if(a.tackle&&performance.now()>state.tackleLock){
   state.tackleLock=performance.now()+650;
   let target=foes.reduce((b,x)=>dist(x,p)<dist(b,p)?x:b,foes[0]);
   if(dist(target,p)<4.2){ball.userData.owner=null;const dx=target.position.x-p.position.x,dz=target.position.z-p.position.z,l=Math.hypot(dx,dz)||1;ball.position.set(target.position.x,target.position.y+.5,target.position.z);ball.userData.vx=dx/l*10;ball.userData.vz=dz/l*10}
   state.actions.tackle=false
 }
}
function animatePlayers(dt){
 const actors=[...allHome(),...foes,...gks];
 for(const a of actors){
   const dx=a.position.x-a.userData.lastX,dz=a.position.z-a.userData.lastZ;
   const speed=Math.hypot(dx,dz)/Math.max(dt,.001);
   a.userData.walkPhase+=Math.min(speed*.018,1.2);
   const swing=Math.min(speed/10,1)*.55;
   if(a.userData.rigMixer)a.userData.rigMixer.update(dt);\n   keepRiggedFeetOnPitch(a);
   if(a.userData.legL&&a.userData.legR){
     a.userData.legL.rotation.x=Math.sin(a.userData.walkPhase)*swing;
     a.userData.legR.rotation.x=-Math.sin(a.userData.walkPhase)*swing;
     a.userData.armL.rotation.x=-Math.sin(a.userData.walkPhase)*swing*.7;
     a.userData.armR.rotation.x=Math.sin(a.userData.walkPhase)*swing*.7;
     if(a.userData.torso){a.userData.torso.position.y=2.18+Math.abs(Math.sin(a.userData.walkPhase*2))*.025*Math.min(speed/8,1)}
     if(a.userData.head){a.userData.head.position.y=3.25+Math.abs(Math.sin(a.userData.walkPhase*2))*.018*Math.min(speed/8,1)}
   }
   a.userData.lastX=a.position.x;a.userData.lastZ=a.position.z;
 }
}
function update(dt){
 if(state.over)return;
 state.time=Math.max(0,state.time-dt);
 const p=controlled(),sprint=state.actions.sprint,pace=p.userData.profile.pace/90,s=(sprint?14:9.2)*(.82+.28*pace)*(p.userData.stamina>0?1:.65);
 if(sprint)p.userData.stamina=Math.max(0,p.userData.stamina-20*dt);else p.userData.stamina=Math.min(100,p.userData.stamina+8*dt);
 move(p,p.position.x+state.joy.x,p.position.z+state.joy.y,s,dt);p.position.x=THREE.MathUtils.clamp(p.position.x,-51,51);p.position.z=THREE.MathUtils.clamp(p.position.z,-32,32);
 mates.forEach((m,i)=>{const q=homePos[i],tx=q[0]+(ball.position.x-q[0])*.18,tz=q[1]+(ball.position.z-q[1])*.18;move(m,tx,tz,5.0,dt)});
 foes.forEach((f,i)=>{
   const chase=i===0||dist(f,ball)<15,tx=chase?ball.position.x:f.userData.homeX,tz=chase?ball.position.z:f.userData.homeZ;
   move(f,tx,tz,5.0*(.82+.28*f.userData.profile.pace/80),dt);
   if(f.userData.profile.shooting>75&&ball.userData.owner===f&&f.position.x<-24&&Math.abs(f.position.z)<18&&performance.now()>f.userData.aiKick){
     f.userData.aiKick=performance.now()+1200;
     const dx=-53-ball.position.x,dz=-ball.position.z*.35,l=Math.hypot(dx,dz)||1;
     ball.userData.owner=null;ball.userData.vx=dx/l*24*(f.userData.profile.shooting/80);ball.userData.vz=dz/l*24*(f.userData.profile.shooting/80);
   }
 });
 const owner=ball.userData.owner;
 if(owner && owner.team===red && performance.now()>owner.userData.aiKick){
   owner.userData.aiKick=performance.now()+900;
   const matesAway=foes.filter(x=>x!==owner&&x.position.x<owner.position.x+20);
   const target=matesAway.sort((a,b)=>Math.abs(a.position.z-ball.position.z)-Math.abs(b.position.z-ball.position.z))[0];
   const shouldPass=target && owner.position.x>8 && Math.random()<0.28;
   if(shouldPass){
     const dx=target.position.x-ball.position.x,dz=target.position.z-ball.position.z,l=Math.hypot(dx,dz)||1;
     ball.userData.owner=null;ball.userData.vx=dx/l*(14+owner.userData.profile.passing*.12);ball.userData.vz=dz/l*(14+owner.userData.profile.passing*.12);
   }
 }
 if(owner){
   const control=owner.userData.profile.dribbling/90;
   const lead=.72+.38*control;
   ball.position.x=owner.position.x+Math.sin(owner.rotation.y)*lead;ball.position.z=owner.position.z+Math.cos(owner.rotation.y)*lead;ball.position.y=.5;
 }else{
   ball.position.x+=ball.userData.vx*dt;ball.position.z+=ball.userData.vz*dt;ball.userData.vx*=Math.pow(.985,dt*60);ball.userData.vz*=Math.pow(.985,dt*60);
   const near=allHome().concat(foes).reduce((b,x)=>dist(x,ball)<dist(b,ball)?x:b,allHome()[0]);
   if(dist(near,ball)<1.45&&Math.abs(ball.userData.vx)+Math.abs(ball.userData.vz)<8)ball.userData.owner=near;
 }
 ball.rotation.x+=ball.userData.vz*dt*1.8;ball.rotation.z-=ball.userData.vx*dt*1.8;
 if(ball.position.z<-33||ball.position.z>33){ball.position.z=THREE.MathUtils.clamp(ball.position.z,-33,33);ball.userData.vz*=-.78}
 if(ball.position.x<-53||ball.position.x>53){
   if(Math.abs(ball.position.z)<7){const home=ball.position.x>53;state.score[home?0:1]++;scoreEl.textContent=state.score.join(" - ");reset(home?"GOAL!":"AWAY GOAL")}
   else{ball.position.x=THREE.MathUtils.clamp(ball.position.x,-53,53);ball.userData.vx*=-.78}
 }
 gks.forEach((g,i)=>{g.position.z=THREE.MathUtils.clamp(ball.position.z,-6,6);g.rotation.y=i?-Math.PI/2:Math.PI/2});
 const t=new THREE.Vector3(p.position.x,0,p.position.z),want=new THREE.Vector3(t.x-13,19,t.z+18);camera.position.lerp(want,1-Math.pow(.001,dt));camera.lookAt(t.x+6,0,t.z);
 animatePlayers(dt);
 if(state.time<=0){state.over=true;msg.textContent=`FULL TIME  ${state.score[0]} - ${state.score[1]}  (SHOOTで再開)`}
 state.actions={}
}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7))}
addEventListener("resize",resize);resize();
const stick=document.querySelector("#stick"),knob=document.querySelector("#knob");let pid=null;
function joy(e){const r=stick.getBoundingClientRect(),x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2),max=r.width*.34,l=Math.hypot(x,y)||1,k=Math.min(1,max/l);state.joy={x:x/l*k,y:y/l*k};knob.style.transform=`translate(${x*k}px,${y*k}px)`}
stick.addEventListener("pointerdown",e=>{pid=e.pointerId;stick.setPointerCapture(pid);joy(e)});stick.addEventListener("pointermove",e=>{if(e.pointerId===pid)joy(e)});
function stop(){pid=null;state.joy={x:0,y:0};knob.style.transform=""}stick.addEventListener("pointerup",stop);stick.addEventListener("pointercancel",stop);
document.querySelectorAll("[data-action]").forEach(b=>{const a=b.dataset.action;b.addEventListener("pointerdown",e=>{e.preventDefault();if(state.over&&a==="shoot"){state.over=false;state.score=[0,0];state.time=180;scoreEl.textContent="0 - 0";reset()}else state.actions[a]=true});b.addEventListener("pointerup",()=>state.actions[a]=false);b.addEventListener("pointercancel",()=>state.actions[a]=false)});
let last=performance.now();function loop(now){const dt=Math.min(.033,(now-last)/1000);last=now;actions();update(dt);clockEl.textContent=`${String(Math.floor(state.time/60)).padStart(2,"0")}:${String(Math.floor(state.time%60)).padStart(2,"0")}`;renderer.render(scene,camera);requestAnimationFrame(loop)}reset();requestAnimationFrame(loop);