import {createGamePlayerProfile} from "./playerProfiles.js";
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

window.__gameModuleLoaded=true;
const root=document.querySelector("#game"),scoreEl=document.querySelector("#score"),clockEl=document.querySelector("#clock"),msg=document.querySelector("#message");
const boot=document.querySelector("#boot");
window.addEventListener("error",e=>{if(boot){boot.classList.remove("ready");boot.innerHTML="GAME ERROR<br><small>"+String(e.message||"runtime error").slice(0,90)+"</small>"}});
const FIELD={w:106,d:68,goalW:14}, state={score:[0,0],time:180,over:false,joy:{x:0,y:0},actions:{},selected:0,kickLock:0,tackleLock:0,firstKickoff:true,aiEnabled:false,matchPhase:"kickoff",userTouched:false,lastPossessionChange:0,difficulty:"pro"};
const scene=new THREE.Scene();scene.background=new THREE.Color(0x07140d);scene.fog=new THREE.Fog(0x07140d,80,175);
const camera=new THREE.PerspectiveCamera(54,1,.1,220);

// Lightweight mobile-safe game audio using Web Audio synthesis (no external files/CORS).
let audioCtx=null,audioMaster=null,lastKickSfx=0,lastGoalSfx=0,crowdGain=null,crowdStarted=false,crowdTimer=null;
function haptic(ms=12){try{if(navigator.vibrate)navigator.vibrate(ms)}catch{}}
function startCrowdAmbience(){
 if(crowdStarted||!audioCtx||!audioMaster)return;
 crowdStarted=true;
 const buffer=audioCtx.createBuffer(1,audioCtx.sampleRate*2,audioCtx.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.18;
 const src=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter();
 crowdGain=audioCtx.createGain();
 filter.type="bandpass";filter.frequency.value=820;filter.Q.value=.65;
 crowdGain.gain.value=.012;
 src.buffer=buffer;src.loop=true;
 src.connect(filter);filter.connect(crowdGain);crowdGain.connect(audioMaster);src.start();
 crowdTimer=setInterval(()=>{if(!crowdGain||!audioCtx)return;const t=audioCtx.currentTime;crowdGain.gain.cancelScheduledValues(t);crowdGain.gain.linearRampToValueAtTime(.016,t+.7);crowdGain.gain.linearRampToValueAtTime(.010,t+1.6)},1800);
}
function crowdSwell(level=.08,duration=1.8){
 if(!crowdGain||!audioCtx)return;
 const t=audioCtx.currentTime;
 crowdGain.gain.cancelScheduledValues(t);
 crowdGain.gain.setValueAtTime(crowdGain.gain.value,t);
 crowdGain.gain.linearRampToValueAtTime(level,t+.16);
 crowdGain.gain.linearRampToValueAtTime(.012,t+duration);
}

function initAudio(){if(audioCtx)return;const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;audioCtx=new Ctx();audioMaster=audioCtx.createGain();audioMaster.gain.value=.34;audioMaster.connect(audioCtx.destination)}
function resumeAudio(){initAudio();startCrowdAmbience();if(audioCtx?.state==="suspended")audioCtx.resume().catch(()=>{})}
function tone(freq,duration,type="sine",gain=.05,slide=0){if(!audioCtx||!audioMaster)return;const now=audioCtx.currentTime,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(freq,now);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,freq+slide),now+duration);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(gain,now+.012);g.gain.exponentialRampToValueAtTime(.0001,now+duration);o.connect(g);g.connect(audioMaster);o.start(now);o.stop(now+duration+.02)}
function sfxKick(){const now=performance.now();if(now-lastKickSfx<100)return;lastKickSfx=now;haptic(9);tone(105,.07,"triangle",.08,75);tone(55,.045,"sine",.045,-15)}
function sfxPass(){haptic(5);tone(180,.055,"triangle",.035,90)}
function sfxTackle(){haptic(18);tone(75,.08,"square",.035,30);tone(48,.055,"sine",.025,-8)}
function sfxGoal(){const now=performance.now();if(now-lastGoalSfx<400)return;lastGoalSfx=now;haptic(45);crowdSwell(.09,3.2);[392,494,587,784].forEach((f,i)=>setTimeout(()=>tone(f,.22,"sine",.07),i*95))}
function sfxWhistle(){haptic(22);tone(980,.18,"square",.045,-120);setTimeout(()=>tone(980,.18,"square",.045,-120),220)}
window.addEventListener("pointerdown",resumeAudio,{once:true,passive:true});
window.addEventListener("touchstart",resumeAudio,{once:true,passive:true});

const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.45));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;root.appendChild(renderer.domElement);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
scene.add(new THREE.HemisphereLight(0xdceeff,0x153d20,2.2));
const sun=new THREE.DirectionalLight(0xffffff,3.2);sun.position.set(-35,55,25);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
const M=(c,r=.72)=>new THREE.MeshStandardMaterial({color:c,roughness:r}),lineMat=new THREE.MeshBasicMaterial({color:0xffffff}),blue=M(0x287cf0),red=M(0xe33d45),white=M(0xf2f2f2),skin=M(0xf0bd8a),hair=M(0x241a16),black=M(0x151515),ballMat=M(0xffffff,.55);
function addStadiumAtmosphere(){
 const standMat=M(0x18242d),roofMat=M(0x0a1116),seatMat=M(0x27353d),lampMat=M(0xfff1c4);
 for(const side of[-1,1]){
  const z=side*43;
  scene.add(box(122,5,9,standMat,0,2.4,z),box(122,1,9,roofMat,0,7.8,z));
  for(let x=-50;x<=50;x+=8)scene.add(box(5,.12,1.6,seatMat,x,5.2,z-side*1.8));
 }
 for(const x of[-58,58]){
  const pole=cyl(.16,18,M(0x313b43),x,9,0);scene.add(pole);
  const lamp=new THREE.PointLight(0xffefc5,11,50,2);lamp.position.set(x,18,0);scene.add(lamp);
 }
}
function box(w,h,d,m,x=0,y=0,z=0){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;return o}
function cyl(r,h,m,x=0,y=0,z=0){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.96,h,10),m);o.position.set(x,y,z);o.castShadow=true;return o}
addStadiumAtmosphere();
function mark(x1,z1,x2,z2,w=.16){const l=Math.hypot(x2-x1,z2-z1),o=box(w,.035,l,lineMat);o.position.set((x1+x2)/2,.025,(z1+z2)/2);o.rotation.y=Math.atan2(x2-x1,z2-z1);scene.add(o)}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(122,84),M(0x0b301b));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const pitch=new THREE.Mesh(new THREE.PlaneGeometry(FIELD.w,FIELD.d,10,6),M(0x176b38));pitch.rotation.x=-Math.PI/2;pitch.position.y=.01;pitch.receiveShadow=true;scene.add(pitch);
for(let i=0;i<10;i++){const stripe=new THREE.Mesh(new THREE.PlaneGeometry(FIELD.w,FIELD.d/10),new THREE.MeshBasicMaterial({color:i%2?0x155f34:0x176b38}));stripe.rotation.x=-Math.PI/2;stripe.position.set(0,.016,-FIELD.d/2+(i+.5)*FIELD.d/10);scene.add(stripe)}
for(const z of[-34,34])for(let x=-53;x<=53;x+=2)scene.add(cyl(.035,.18,M(0xe9f0ea),x,.06,z));
mark(-53,-34,53,-34);mark(-53,34,53,34);mark(-53,-34,-53,34);mark(53,-34,53,34);mark(0,-34,0,34);mark(-37,-20,-37,20);mark(37,-20,37,20);
const circle=new THREE.Mesh(new THREE.RingGeometry(8.95,9.15,64),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}));circle.rotation.x=-Math.PI/2;circle.position.y=.035;scene.add(circle);
for(const x of[-54.2,54.2]){
 const g=new THREE.Group(),pm=M(0xf4f4f4,.24),netMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.22,wireframe:true});
 g.add(cyl(.13,3.6,pm,-7,1.8,0),cyl(.13,3.6,pm,7,1.8,0),box(.13,.13,14,pm,0,3.6,0));
 g.add(box(.10,3.15,14,pm,0,1.58,x<0?1.15:-1.15));
 const back=new THREE.Mesh(new THREE.BoxGeometry(14,3.15,2.3,12,6,3),netMat);back.position.set(0,1.58,x<0?1.15:-1.15);g.add(back);
 for(let zi=-6;zi<=6;zi+=2){const v=box(.025,3.1,.025,netMat,zi,1.58,x<0?.65:-.65);g.add(v)}
 for(let yi=.5;yi<=3;yi+=.5){const h=box(14,.025,.025,netMat,0,yi,x<0?.65:-.65);g.add(h)}
 g.position.x=x;scene.add(g)
}

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
const RIGGED_LOAD_TIMEOUT=9000;
function loadWithTimeout(loader,url){
 return new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>{if(!done){done=true;reject(new Error("asset timeout"))}},RIGGED_LOAD_TIMEOUT);
 loader.load(url,g=>{if(done)return;done=true;clearTimeout(timer);resolve(g)},undefined,e=>{if(done)return;done=true;clearTimeout(timer);reject(e)})});
}
const rigLoader=new GLTFLoader();
let riggedSource=null,animationSource=null,rigLoadPromise=null,animationLoadPromise=null;
function loadRiggedSource(){if(rigLoadPromise)return rigLoadPromise;rigLoadPromise=new Promise((resolve,reject)=>loadWithTimeout(rigLoader,RIGGED_PLAYER_URL).then(g=>{riggedSource=g;resolve(g)}).catch(reject));return rigLoadPromise}
function loadAnimationSource(){if(animationLoadPromise)return animationLoadPromise;animationLoadPromise=new Promise((resolve,reject)=>loadWithTimeout(rigLoader,ANIMATION_LIBRARY_URL).then(g=>{animationSource=g;resolve(g)}).catch(reject));return animationLoadPromise}
function recolorRiggedModel(model,team,variantIndex=0){
 const variants=[
  {skin:0xf0bd8a,hair:0x241a16,boot:0x101318},
  {skin:0xc98b63,hair:0x111111,boot:0x26384a},
  {skin:0x8d5a3b,hair:0x21150f,boot:0x171717},
  {skin:0xf3c9a5,hair:0x6b3f22,boot:0x3a2420},
  {skin:0xb66b45,hair:0x3a2419,boot:0x0e2740}
 ];
 const v=variants[variantIndex%variants.length];
 const shirt=team===blue?0x2f78d0:team===red?0xd93445:0xf0f0f0,shorts=team===blue?0x174f9d:team===red?0x8f1728:0x333333;
 model.traverse(o=>{
  if(!o.isMesh)return;
  o.castShadow=true;o.receiveShadow=true;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  o.material=mats.map(m=>{
   const n=(m?.name||"")+" "+(o.name||"");const k=n.toLowerCase(),mm=m.clone();
   if(/shirt|jersey|top|upper|torso|clothes/.test(k))mm.color?.setHex(shirt);
   else if(/short|pants|trouser/.test(k))mm.color?.setHex(shorts);
   else if(/hair|hairstyle/.test(k))mm.color?.setHex(v.hair);
   else if(/skin|body|head|face|hand|arm|leg/.test(k))mm.color?.setHex(v.skin);
   else if(/boot|shoe|footwear/.test(k))mm.color?.setHex(v.boot);
   return mm;
  });
  if(o.material.length===1)o.material=o.material[0];
 });
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
}function setupRigBones(model){
 const bones={};
 model.traverse(o=>{if(o.isBone)bones[o.name]=o});
 const names=["pelvis","spine_01","spine_02","spine_03","neck_01","Head","upperarm_l","lowerarm_l","upperarm_r","lowerarm_r","thigh_l","calf_l","foot_l","thigh_r","calf_r","foot_r"];
 if(!names.every(n=>bones[n]))return null;
 const base={};
 for(const n of names)base[n]=bones[n].quaternion.clone();
 return {bones,base};
}
function rigOffset(rig,name,x=0,y=0,z=0){
 const b=rig.bones[name],q=rig.base[name];if(!b||!q)return;
 b.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z)));
}
function animateRiggedLocomotion(a,speed,dt){
 const mixer=a.userData.rigMixer;
 if(mixer){
   const state=a.userData.animState;
   const desired=state==="kick"||state==="tackle"?(speed>10?"Sprint_Loop":"Jog_Fwd_Loop"):speed>10?"Sprint_Loop":speed>.35?"Jog_Fwd_Loop":"Idle_Loop";
   setRigAnimation(a,desired,speed>.35?.10:.18);
   mixer.update(dt);
   if(a.userData.animTimer>0){a.userData.animTimer-=dt;if(a.userData.animTimer<=0)a.userData.animState="locomotion"}
   return;
 }
 const rig=a.userData.rigBones;if(!rig)return;
 const phase=a.userData.walkPhase,swing=Math.sin(phase)*(speed>10?.72:speed>.25?.48:0),opposite=-swing;
 rigOffset(rig,"thigh_l",swing,0,0);rigOffset(rig,"thigh_r",opposite,0,0);
 rigOffset(rig,"calf_l",Math.max(0,-swing)*.72,0,0);rigOffset(rig,"calf_r",Math.max(0,-opposite)*.72,0,0);
 rigOffset(rig,"foot_l",Math.max(0,-swing)*-.38,0,0);rigOffset(rig,"foot_r",Math.max(0,-opposite)*-.38,0,0);
 rigOffset(rig,"upperarm_l",opposite*.48,0,0);rigOffset(rig,"upperarm_r",swing*.48,0,0);
 rigOffset(rig,"lowerarm_l",opposite*.16,0,0);rigOffset(rig,"lowerarm_r",swing*.16,0,0);
 rigOffset(rig,"pelvis",0,0,speed>.25?Math.sin(phase*2)*.035:0);
}
let rigClipCache=null;
const RIG_CLIP_NAMES=["Idle_Loop","Walk_Loop","Jog_Fwd_Loop","Sprint_Loop"];
function retargetClipToHumanoid(clip){
 const tracks=[];
 for(const track of clip.tracks){
   const parts=track.name.split(".");
   if(parts.length<2||parts.at(-1)!=="quaternion")continue;
   const boneName=parts.slice(0,-1).join(".").split("/").at(-1);
   if(!["pelvis","spine_01","spine_02","spine_03","neck_01","Head","upperarm_l","lowerarm_l","upperarm_r","lowerarm_r","thigh_l","calf_l","foot_l","thigh_r","calf_r","foot_r"].includes(boneName))continue;
   const cloned=track.clone();cloned.name=boneName+".quaternion";tracks.push(cloned);
 }
 const out=clip.clone();out.tracks=tracks;return out;
}
function buildRigClipCache(){
 if(rigClipCache||!animationSource?.animations?.length)return;
 rigClipCache={};
 for(const name of RIG_CLIP_NAMES){
   const src=animationSource.animations.find(c=>c.name===name);
   if(src){const clip=retargetClipToHumanoid(src);if(clip.tracks.length)rigClipCache[name]=clip}
 }
}
function setRigAnimation(a,name,fade=.14){
 const mixer=a.userData.rigMixer,actions=a.userData.rigActions;if(!mixer||!actions?.[name])return;
 if(a.userData.rigAnim===name)return;
 const next=actions[name];next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
 if(a.userData.rigAnim&&actions[a.userData.rigAnim])actions[a.userData.rigAnim].crossFadeTo(next,fade,true);
 a.userData.rigAnim=name;
}
async function attachRiggedVisual(g,team,variantIndex=0,number=0){
 try{
  const [source]=await Promise.all([loadRiggedSource(),loadAnimationSource()]);
  buildRigClipCache();
  const model=SkeletonUtils.clone(source.scene);recolorRiggedModel(model,team,variantIndex);fitRiggedModel(model);g.add(model);g.userData.riggedModel=model;
  const rig=setupRigBones(model);if(rig)g.userData.rigBones=rig;
  if(rigClipCache){
    const mixer=new THREE.AnimationMixer(model),actions={};
    for(const [name,clip] of Object.entries(rigClipCache))actions[name]=mixer.clipAction(clip);
    g.userData.rigMixer=mixer;g.userData.rigActions=actions;g.userData.rigAnim="";
    setRigAnimation(g,"Idle_Loop",.01);
  }
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
 const variantIndex=(number+role.length+(team===red?2:0))%variants.length;const v=variants[variantIndex];
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
 Object.assign(g.userData,{number,variantIndex,role,homeX:0,homeZ:0,stamina:100,controlled,team,walkPhase:Math.random()*Math.PI*2,lastX:0,lastZ:0,profile:createGamePlayerProfile(role,profileOverrides),aiKick:0,aiPossessionSince:0,animState:"locomotion",animTimer:0});
 g.children.forEach(ch=>{if(ch!==ring&&ch!==numberFront&&ch!==numberBack)ch.userData.legacyVisual=true});
 // Persistent shirt numbers stay visible even when the rigged body replaces the procedural body.
 numberFront.renderOrder=4;numberBack.renderOrder=4;
 scene.add(g);attachRiggedVisual(g,team,variantIndex,number);return g;
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
// Keep the opening kickoff under direct player control. AI cannot own or shoot the ball until a real touch occurs.
state.matchReady=true;
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
 ball.position.set(-1.2,.48,0);ball.userData.vx=ball.userData.vz=0;ball.userData.owner=player;
 state.firstKickoff=true;state.aiEnabled=false;state.matchPhase="kickoff";state.userTouched=false;state.lastPossessionChange=performance.now();
 player.position.set(-1.2,0,0);mates.forEach((p,i)=>p.position.set(...homePos[i],0));foes.forEach((p,i)=>p.position.set(...awayPos[i],0));
 gks[0].position.set(-50,0,0);gks[1].position.set(50,0,0);selectPlayer(0);
 msg.textContent=text;setTimeout(()=>{if(msg.textContent===text)msg.textContent=""},1100)
}
function dist(a,b){return Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)}
function tacticalTarget(p,team,hasBall){
 const role=p.userData.role||"MID",baseX=p.userData.homeX||0,baseZ=p.userData.homeZ||0;
 const ballX=ball.position.x,ballZ=ball.position.z;
 let tx=baseX,tz=baseZ;
 if(role==="DEF"){tx=baseX+(ballX-baseX)*0.10;tz=baseZ+(ballZ-baseZ)*0.18}
 else if(role==="MID"){tx=baseX+(ballX-baseX)*0.24;tz=baseZ+(ballZ-baseZ)*0.32}
 else if(role==="FWD"){tx=baseX+(hasBall?4:0)+(ballX-baseX)*0.30;tz=baseZ+(ballZ-baseZ)*0.22}
 if(hasBall){tx+=team===blue?3:-3}
 return {x:THREE.MathUtils.clamp(tx,-49,49),z:THREE.MathUtils.clamp(tz,-30,30)}
}
function move(a,x,z,s,dt){const dx=x-a.position.x,dz=z-a.position.z,d=Math.hypot(dx,dz);if(d>.08){const q=Math.min(d,s*dt);a.position.x+=dx/d*q;a.position.z+=dz/d*q;a.rotation.y=Math.atan2(dx,dz)+Math.PI}}
function nearestMate(){
 return mates.reduce((b,p)=>dist(p,controlled())<dist(b,controlled())?p:b,mates[0])
}
function kickTo(tx,tz,power){
 const p=controlled(),dx=ball.position.x-p.position.x,dz=ball.position.z-p.position.z;
 if(Math.hypot(dx,dz)>3.1||performance.now()<state.kickLock)return;
 const x=tx-ball.position.x,z=tz-ball.position.z,l=Math.hypot(x,z)||1;
 p.userData.animState="kick";p.userData.animTimer=.34;
 ball.userData.owner=null;state.firstKickoff=false;state.aiEnabled=true;state.userTouched=true;state.matchPhase="play";state.lastPossessionChange=performance.now();const passScale=p.userData.profile.passing/80;
 ball.userData.vx=x/l*power*passScale;ball.userData.vz=z/l*power*passScale;state.kickLock=performance.now()+260; if(power>28)sfxKick();else sfxPass()
}
function stealBall(taker,carrier,force=false){
 if(!taker||!carrier||carrier===taker||ball.userData.owner!==carrier)return false;
 const d=dist(taker,carrier),def=(taker.userData.profile.defending||50)*.62+(taker.userData.profile.physical||70)*.38;
 const atk=(carrier.userData.profile.dribbling||70)*.72+(carrier.userData.profile.physical||70)*.28;
 if(d>1.9&&!force)return false;
 const chance=THREE.MathUtils.clamp(.42+(def-atk)*.012,.16,.88);
 if(!force&&Math.random()>chance)return false;
 ball.userData.owner=taker;ball.userData.vx=0;ball.userData.vz=0;
 taker.userData.aiPossessionSince=taker.team===red?performance.now():0;
 taker.userData.aiKick=performance.now()+900;
 taker.userData.animState="tackle";taker.userData.animTimer=.32;
 return true;
}
function actions(){
 const a=state.actions,p=controlled();
 if(a.switch){selectBestDefender();state.actions.switch=false}
 if(a.pass){const t=nearestMate();kickTo(t.position.x,t.position.z,22);state.actions.pass=false}
 if(a.shoot){kickTo(53,-p.position.z*.35,32*(p.userData.profile.shooting/80));state.actions.shoot=false}
 if(a.tackle&&performance.now()>state.tackleLock){
   state.tackleLock=performance.now()+650;resumeAudio();sfxTackle();
   const ownedFoe=ball.userData.owner&&ball.userData.owner.team===red?ball.userData.owner:null;
   let target=ownedFoe||foes.reduce((b,x)=>dist(x,p)<dist(b,p)?x:b,foes[0]);
   if(target&&dist(target,p)<4.2){
     p.userData.animState="tackle";p.userData.animTimer=.42;
     if(!stealBall(p,target,true)){
       const dx=target.position.x-p.position.x,dz=target.position.z-p.position.z,l=Math.hypot(dx,dz)||1;
       ball.userData.owner=null;ball.position.set(target.position.x,target.position.y+.5,target.position.z);
       ball.userData.vx=dx/l*8;ball.userData.vz=dz/l*8;
     }
   }
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
   animateRiggedLocomotion(a,speed,dt);
   keepRiggedFeetOnPitch(a);
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
 if(Math.hypot(state.joy.x,state.joy.y)>.08){
   if(state.firstKickoff){state.firstKickoff=false;state.userTouched=true;state.aiEnabled=true;state.matchPhase="play";state.lastPossessionChange=performance.now()}
   move(p,p.position.x+state.joy.x,p.position.z+state.joy.y,s,dt);
 }
 p.position.x=THREE.MathUtils.clamp(p.position.x,-51,51);p.position.z=THREE.MathUtils.clamp(p.position.z,-32,32);
 const blueHas=ball.userData.owner?.team===blue,redHas=ball.userData.owner?.team===red;
 mates.forEach((m,i)=>{
   const q=tacticalTarget(m,blue,blueHas), speed=4.2+.9*(m.userData.profile.pace/100);
   move(m,q.x,q.z,speed,dt);
 });
 foes.forEach((f,i)=>{
   const q=tacticalTarget(f,red,redHas);
   const threat=ball.userData.owner?.team===blue?ball.userData.owner:ball;
   const shouldPress=state.aiEnabled&&state.userTouched&&(i===8||dist(f,threat)<9);
   const tx=shouldPress?threat.position.x:q.x,tz=shouldPress?threat.position.z:q.z;
   move(f,tx,tz,4.3*(.82+.28*f.userData.profile.pace/80),dt);
   // Only the actual attacking side may shoot toward the user's goal.
   // The previous condition let the AI fire immediately from its kickoff half,
   // causing repeated automatic goals.
   if(state.aiEnabled===true&&state.firstKickoff!==true&&f.userData.profile.shooting>75&&ball.userData.owner===f&&f.position.x<-30&&Math.abs(f.position.z)<16&&f.userData.aiPossessionSince>0&&performance.now()-f.userData.aiPossessionSince>900&&performance.now()>f.userData.aiKick){
     f.userData.aiKick=performance.now()+3500;
     f.userData.aiPossessionSince=0;
     const dx=-53-ball.position.x,dz=-ball.position.z*.35,l=Math.hypot(dx,dz)||1;
     ball.userData.owner=null;ball.userData.vx=dx/l*24*(f.userData.profile.shooting/80);ball.userData.vz=dz/l*24*(f.userData.profile.shooting/80);
   }
 });
 const owner=ball.userData.owner;
 // Hard kickoff gate: until the user's first touch, the AI cannot attack, pass, shoot, or score.
 if(state.aiEnabled===true&&state.firstKickoff!==true && owner && owner.team===red && owner.position.x>0 && performance.now()>owner.userData.aiKick){
   owner.userData.aiPossessionSince=0;
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
   const opponents=owner.team===blue?foes:allHome();
   const contact=opponents.reduce((b,x)=>dist(x,owner)<dist(b,owner)?x:b,opponents[0]);
   if(contact&&dist(contact,owner)<1.18)stealBall(contact,owner,false);
 }else{
   ball.position.x+=ball.userData.vx*dt;ball.position.z+=ball.userData.vz*dt;ball.userData.vx*=Math.pow(.985,dt*60);ball.userData.vz*=Math.pow(.985,dt*60);
   const candidates=allHome().concat(foes);
   const near=candidates.reduce((b,x)=>dist(x,ball)<dist(b,ball)?x:b,candidates[0]);
   if(dist(near,ball)<1.45&&Math.hypot(ball.userData.vx,ball.userData.vz)<10)ball.userData.owner=near;
 }
 ball.rotation.x+=ball.userData.vz*dt*1.8;ball.rotation.z-=ball.userData.vx*dt*1.8;
 if(ball.position.z<-33||ball.position.z>33){ball.position.z=THREE.MathUtils.clamp(ball.position.z,-33,33);ball.userData.vz*=-.78}
 if(ball.position.x<-53||ball.position.x>53){
   const towardAway=ball.position.x>53&&ball.userData.vx>0, towardHome=ball.position.x<-53&&ball.userData.vx<0;
   if(Math.abs(ball.position.z)<7&&(towardAway||towardHome)&&state.matchPhase==="play"){
     const home=towardAway;state.score[home?0:1]++;scoreEl.textContent=state.score.join(" - ");state.matchPhase="goal";resumeAudio();sfxGoal();reset(home?"GOAL!":"AWAY GOAL");
   } else {ball.position.x=THREE.MathUtils.clamp(ball.position.x,-53,53);ball.userData.vx*=-.78}
 }
 gks.forEach((g,i)=>{g.position.z=THREE.MathUtils.clamp(ball.position.z,-6,6);g.rotation.y=i?-Math.PI/2:Math.PI/2});
 const blendX=p.position.x*.62+ball.position.x*.38,blendZ=p.position.z*.62+ball.position.z*.38;
 const t=new THREE.Vector3(blendX,0,blendZ),want=new THREE.Vector3(t.x-15,20,t.z+19);
 camera.position.lerp(want,1-Math.pow(.001,dt));camera.lookAt(t.x+5,0,t.z);
 animatePlayers(dt);updateRadar();updatePlayerCard();
 if(state.time<=0){state.over=true;resumeAudio();sfxWhistle();msg.textContent=`FULL TIME  ${state.score[0]} - ${state.score[1]}  (SHOOTで再開)`}
 state.actions={}
}
const radarCanvas=document.querySelector("#radar"),radarCtx=radarCanvas?.getContext("2d"),staminaFill=document.querySelector("#staminaFill"),playerLabel=document.querySelector("#playerLabel"),playerRole=document.querySelector("#playerRole"),playerNo=document.querySelector("#playerNo");
function updateRadar(){
 if(!radarCtx)return;
 const w=radarCanvas.width,h=radarCanvas.height;radarCtx.clearRect(0,0,w,h);radarCtx.fillStyle="#0a5a32";radarCtx.fillRect(0,0,w,h);radarCtx.strokeStyle="#ffffff55";radarCtx.strokeRect(2,2,w-4,h-4);radarCtx.beginPath();radarCtx.moveTo(w/2,2);radarCtx.lineTo(w/2,h-2);radarCtx.stroke();radarCtx.beginPath();radarCtx.arc(w/2,h/2,12,0,Math.PI*2);radarCtx.stroke();
 const dot=(x,z,c,r=3)=>{radarCtx.fillStyle=c;radarCtx.beginPath();radarCtx.arc((x+53)/106*w,(z+34)/68*h,r,0,Math.PI*2);radarCtx.fill()};
 allHome().forEach((p,i)=>dot(p.position.x,p.position.z,i===state.selected?"#ffffff":"#4b9cff",i===state.selected?4:2.2));
 foes.forEach(p=>dot(p.position.x,p.position.z,"#ff5364",2.2));dot(ball.position.x,ball.position.z,"#fff",2.8);
}
function updatePlayerCard(){
 const p=controlled();if(!p)return;
 const n=p.userData.number||1,role=p.userData.role||"MID";
 playerLabel.textContent="PLAYER "+String(n).padStart(2,"0");playerRole.textContent=role;playerNo.textContent="#"+n;
 if(staminaFill)staminaFill.style.width=Math.round(p.userData.stamina||0)+"%";
}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.45))}
addEventListener("resize",resize);resize();
const stick=document.querySelector("#stick"),knob=document.querySelector("#knob");let pid=null;
function joy(e){const r=stick.getBoundingClientRect(),x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2),max=r.width*.34,l=Math.hypot(x,y)||1,k=Math.min(1,max/l);state.joy={x:x/l*k,y:y/l*k};knob.style.transform=`translate(${x*k}px,${y*k}px)`}
stick.addEventListener("pointerdown",e=>{pid=e.pointerId;stick.setPointerCapture(pid);joy(e)});stick.addEventListener("pointermove",e=>{if(e.pointerId===pid)joy(e)});
function stop(){pid=null;state.joy={x:0,y:0};knob.style.transform=""}stick.addEventListener("pointerup",stop);stick.addEventListener("pointercancel",stop);
document.querySelectorAll("[data-action]").forEach(b=>{
 const a=b.dataset.action;
 const press=e=>{e.preventDefault();resumeAudio();if(state.over&&a==="shoot"){state.over=false;state.score=[0,0];state.time=180;scoreEl.textContent="0 - 0";reset();return}state.actions[a]=true};
 const release=()=>{state.actions[a]=false};
 b.addEventListener("pointerdown",press,{passive:false});b.addEventListener("pointerup",release);b.addEventListener("pointercancel",release);b.addEventListener("pointerleave",release);
});
let last=performance.now();function loop(now){const dt=Math.min(.033,(now-last)/1000);last=now;actions();update(dt);clockEl.textContent=`${String(Math.floor(state.time/60)).padStart(2,"0")}:${String(Math.floor(state.time%60)).padStart(2,"0")}`;renderer.render(scene,camera);requestAnimationFrame(loop)}reset();if(boot)boot.classList.add("ready");requestAnimationFrame(loop);