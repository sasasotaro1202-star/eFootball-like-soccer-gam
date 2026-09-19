import {createGamePlayerProfile} from "./playerProfiles.js";
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

window.__gameModuleLoaded=true;
const root=document.querySelector("#game"),scoreEl=document.querySelector("#score"),clockEl=document.querySelector("#clock"),msg=document.querySelector("#message");
const boot=document.querySelector("#boot");
window.addEventListener("error",e=>{window.__lastGameError=String(e?.message||"runtime error");window.__lastGameStack=String(e?.error?.stack||"")});
const FIELD={w:106,d:68,goalW:14}, state={score:[0,0],time:180,over:false,joy:{x:0,y:0},actions:{},selected:0,kickLock:0,tackleLock:0,firstKickoff:true,aiEnabled:false,matchPhase:"kickoff",userTouched:false,lastPossessionChange:0,difficulty:"pro"};
const scene=new THREE.Scene();
// Presentation scene is deliberately rebuilt around a stable TV/broadcast coordinate system.
scene.background=new THREE.Color(0x07150f);
scene.fog=null;
const camera=new THREE.PerspectiveCamera(49,1,.1,220);

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

let renderer=null;
let rendererBootError=null;
// Compatibility-first renderer: Three.js r162 is the last official release whose WebGLRenderer
// can use WebGL2 and fall back to WebGL1. This avoids a second Three.js runtime and reduces the
// chance of mobile context exhaustion while preserving the same scene/material API.
try{
  renderer=new THREE.WebGLRenderer({
    antialias:false,
    powerPreference:"default",
    precision:"mediump",
    stencil:false,
    depth:true,
    failIfMajorPerformanceCaveat:false
  });
  window.__rendererMode=renderer.capabilities?.isWebGL2===false?"webgl1":"webgl2";
}catch(err){
  rendererBootError=err;
}
if(!renderer){
  window.__activateFallback?.("3D renderer could not initialize: "+(rendererBootError?.message||"WebGL unavailable"));
  throw rendererBootError||new Error("WebGL renderer unavailable");
}
const deviceMemory=Number(navigator.deviceMemory||4);const maxPixels=deviceMemory<=2?900000:deviceMemory<=4?1400000:1900000;const baseDpr=Math.min(devicePixelRatio||1,1.35);const maxDpr=Math.sqrt(maxPixels/Math.max(1,innerWidth*innerHeight));renderer.setPixelRatio(Math.max(1,Math.min(baseDpr,maxDpr)));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
root.appendChild(renderer.domElement);window.__threeRendererReady=true;
let renderPaused=false;
renderer.domElement.addEventListener("webglcontextlost",e=>{
  e.preventDefault();
  renderPaused=true;
  window.__activateFallback?.("WebGL context lost — recovering");
});
renderer.domElement.addEventListener("webglcontextrestored",()=>{window.location.reload()});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.outputColorSpace=THREE.SRGBColorSpace;
scene.add(new THREE.HemisphereLight(0xdceeff,0x153d20,2.2));
const sun=new THREE.DirectionalLight(0xffffff,3.6);sun.position.set(-35,55,25);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.near=1;sun.shadow.camera.far=170;sun.shadow.camera.left=-72;sun.shadow.camera.right=72;sun.shadow.camera.top=72;sun.shadow.camera.bottom=-72;scene.add(sun);
const fill=new THREE.HemisphereLight(0x8fb8ff,0x183b25,1.15);scene.add(fill);
const rimA=new THREE.DirectionalLight(0x6fa8ff,0.75);rimA.position.set(42,28,-34);scene.add(rimA);
const rimB=new THREE.DirectionalLight(0xff8b72,0.42);rimB.position.set(-38,20,-42);scene.add(rimB);
const M=(c,r=.72)=>new THREE.MeshStandardMaterial({color:c,roughness:r}),lineMat=new THREE.MeshBasicMaterial({color:0xffffff}),blue=M(0x287cf0),red=M(0xe33d45),white=M(0xf2f2f2),skin=M(0xf0bd8a),hair=M(0x241a16),black=M(0x151515),ballMat=M(0xffffff,.55);
function buildPresentationWorld(){
  // Clean presentation baseline. Only the pitch, markings and a neutral
  // surrounding floor are created here; stadium/goal meshes are deliberately
  // excluded until the broadcast framing is visually validated.
  const arenaFloor=new THREE.Mesh(
    new THREE.PlaneGeometry(360,300),
    new THREE.MeshBasicMaterial({color:0x06170d,side:THREE.DoubleSide})
  );
  arenaFloor.rotation.x=-Math.PI/2;
  arenaFloor.position.y=-.24;
  scene.add(arenaFloor);

  const pitch=new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD.w,FIELD.d),
    new THREE.MeshBasicMaterial({color:0x176f38,side:THREE.DoubleSide})
  );
  pitch.rotation.x=-Math.PI/2;
  pitch.position.y=.02;
  scene.add(pitch);

  const stripeColors=[0x176f38,0x156936];
  for(let i=0;i<10;i++){
    const stripe=new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD.w,FIELD.d/10+.02),
      new THREE.MeshBasicMaterial({color:stripeColors[i%2],side:THREE.DoubleSide})
    );
    stripe.rotation.x=-Math.PI/2;
    stripe.position.set(0,.025,-FIELD.d/2+(i+.5)*FIELD.d/10);
    scene.add(stripe);
  }

  const lineMat=new THREE.MeshBasicMaterial({color:0xf7faf8,side:THREE.DoubleSide});
  const mark=(x1,z1,x2,z2,w=.12)=>{
    const len=Math.hypot(x2-x1,z2-z1);
    const o=new THREE.Mesh(new THREE.BoxGeometry(w,.035,len),lineMat);
    o.position.set((x1+x2)/2,.065,(z1+z2)/2);
    o.rotation.y=Math.atan2(x2-x1,z2-z1);
    scene.add(o);
  };
  mark(-53,-34,53,-34); mark(-53,34,53,34);
  mark(-53,-34,-53,34); mark(53,-34,53,34);
  mark(0,-34,0,34);
  mark(-53,-20,-37,-20); mark(-53,20,-37,20);
  mark(37,-20,53,-20); mark(37,20,53,20);
  mark(-37,-20,-37,20); mark(37,-20,37,20);
  mark(-53,-9,-44,-9); mark(-53,9,-44,9);
  mark(44,-9,53,-9); mark(44,9,53,9);

  const centerCircle=new THREE.Mesh(
    new THREE.RingGeometry(8.92,9.08,96),
    lineMat
  );
  centerCircle.rotation.x=-Math.PI/2;
  centerCircle.position.y=.067;
  scene.add(centerCircle);

  const centerSpot=new THREE.Mesh(new THREE.CircleGeometry(.24,24),lineMat);
  centerSpot.rotation.x=-Math.PI/2;
  centerSpot.position.y=.068;
  scene.add(centerSpot);
}
buildPresentationWorld();

function box(w,h,d,m,x=0,y=0,z=0){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;return o}
function cyl(r,h,m,x=0,y=0,z=0){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.96,h,10),m);o.position.set(x,y,z);o.castShadow=true;return o}

function jerseyNumberTexture(number,color){
 const canvas=document.createElement("canvas");canvas.width=128;canvas.height=128;
 const ctx=canvas.getContext("2d");ctx.clearRect(0,0,128,128);
 ctx.font="900 76px Arial";ctx.textAlign="center";ctx.textBaseline="middle";
 ctx.lineWidth=10;ctx.strokeStyle="rgba(0,0,0,.55)";ctx.strokeText(String(number),64,66);
 ctx.fillStyle=color;ctx.fillText(String(number),64,66);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
const ENABLE_RIGGED_GLTF=false; // Stable mobile shipping path; enable only after a local GLTF validation/playtest gate.
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
   try{mixer.update(dt)}catch(err){a.userData.rigMixer=null;a.userData.rigActions=null;a.userData.rigAnim="";window.__lastGameError=String(err?.message||err);window.__lastGameStack=String(err?.stack||"");}
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
const ball=new THREE.Mesh(new THREE.SphereGeometry(.48,20,14),ballMat);
ball.castShadow=true;
ball.position.set(0,.48,0);
ball.userData={vx:0,vz:0,vy:0,spinX:0,spinZ:0,owner:null,lastTouchTeam:blue};
const ballSeamMat=new THREE.MeshBasicMaterial({color:0x1a1a1a,transparent:true,opacity:.48});
const ballSeamA=new THREE.Mesh(new THREE.TorusGeometry(.485,.018,5,32),ballSeamMat);
ballSeamA.rotation.x=Math.PI/2;ballSeamA.rotation.z=.28;ball.add(ballSeamA);
const ballSeamB=new THREE.Mesh(new THREE.TorusGeometry(.485,.014,5,32),ballSeamMat);
ballSeamB.rotation.y=Math.PI/2;ballSeamB.rotation.z=-.22;ball.add(ballSeamB);
scene.add(ball);

function allHome(){return [player,...mates]}
function controlled(){return allHome()[state.selected]}
function selectPlayer(n){
 state.selected=((n%allHome().length)+allHome().length)%allHome().length;
 allHome().forEach((p,i)=>p.userData.controlled=i===state.selected);
}
function selectBestDefender(){
 const hs=allHome(), target=ball.userData.owner&&ball.userData.owner.userData.team===red?ball.userData.owner:ball;
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
 ball.position.set(-1.2,.48,0);ball.userData.vx=ball.userData.vz=ball.userData.vy=0;ball.userData.owner=player;ball.userData.lastTouchTeam=blue;
 state.firstKickoff=true;state.aiEnabled=false;state.matchPhase="kickoff";state.userTouched=false;state.lastPossessionChange=performance.now();enhancedState.passTarget=null;enhancedState.firstTouchLock=0;
 player.position.set(-1.2,0,0);mates.forEach((p,i)=>p.position.set(...homePos[i],0));foes.forEach((p,i)=>p.position.set(...awayPos[i],0));
 gks[0].position.set(-50,0,0);gks[1].position.set(50,0,0);selectPlayer(0);
 msg.textContent=text;setTimeout(()=>{if(msg.textContent===text)msg.textContent=""},1100)
}
function dist(a,b){return Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)}
function tacticalTarget(p,team,hasBall){
 const role=p.userData.role||"MID",baseX=p.userData.homeX||0,baseZ=p.userData.homeZ||0;
 const ballX=ball.position.x,ballZ=ball.position.z,dir=team===blue?1:-1;
 const pressTarget=ball.userData.owner?.userData?.team!==team?ball.position:null;
 const defensiveLine=dir===1?Math.min(28,Math.max(-10,ballX+13)):Math.max(-28,Math.min(10,ballX-13));
 let tx=baseX,tz=baseZ;
 if(role==="DEF"){
   const lineBlend=hasBall?0.18:0.62;
   tx=baseX+(defensiveLine-baseX)*lineBlend;
   tz=baseZ+(ballZ-baseZ)*(Math.abs(ballX-baseX)<32?.30:.16);
 }else if(role==="MID"){
   tx=baseX+(ballX-baseX)*(hasBall?.34:.20);
   tz=baseZ+(ballZ-baseZ)*(hasBall?.40:.25);
 }else if(role==="FWD"){
   tx=baseX+(hasBall?5:0)+(ballX-baseX)*(hasBall?.25:.12);
   tz=baseZ+(ballZ-baseZ)*.18;
 }
 if(!hasBall&&pressTarget){
   const teamArr=team===blue?allHome():foes,idx=teamArr.indexOf(p);
   const nearest=teamArr.reduce((b,x)=>dist(x,pressTarget)<dist(b,pressTarget)?x:b,teamArr[0]);
   if(p===nearest) { tx=pressTarget.x;tz=pressTarget.z; }
   else if(role==="DEF") { tz+=(pressTarget.z-baseZ)*.08; }
 }
 if(hasBall)tx+=dir*3.2;
 return {x:THREE.MathUtils.clamp(tx,-49,49),z:THREE.MathUtils.clamp(tz,-30,30)}
}
function move(a,x,z,s,dt){
  const dx=x-a.position.x,dz=z-a.position.z,d=Math.hypot(dx,dz);
  const maxSpeed=Math.max(.1,s),agility=THREE.MathUtils.clamp((a.userData.profile?.pace||70)/90,.65,1.12);
  const accel=17*agility,decel=23*agility;
  const vx=a.userData.vx||0,vz=a.userData.vz||0,cur=Math.hypot(vx,vz);
  let tx=0,tz=0;
  if(d>.08){tx=dx/d*maxSpeed;tz=dz/d*maxSpeed}
  const rate=(Math.hypot(tx,tz)>cur?accel:decel)*dt;
  const nv=Math.min(maxSpeed,cur+rate);
  let nx=vx,nz=vz;
  if(cur>.001){nx=vx/cur*nV(nv,cur,rate);nz=vz/cur*nV(nv,cur,rate)}else{nx=tx; nz=tz}
  function approach(a,b,r){return a+(b-a)*Math.min(1,r)}
  nx=approach(vx,tx,Math.min(1,rate/Math.max(cur,.5)));nz=approach(vz,tz,Math.min(1,rate/Math.max(cur,.5)));
  const nl=Math.hypot(nx,nz);
  if(nl>maxSpeed){nx=nx/nl*maxSpeed;nz=nz/nl*maxSpeed}
  a.userData.vx=nx;a.userData.vz=nz;
  a.position.x+=nx*dt;a.position.z+=nz*dt;
  const facingSpeed=Math.hypot(nx,nz);
  if(facingSpeed>.12){
    const desired=Math.atan2(nx,nz);
    let da=Math.atan2(Math.sin(desired-a.rotation.y),Math.cos(desired-a.rotation.y));
    const turnRate=(a.userData.profile?.dribbling||70)/90*8.5;
    a.rotation.y+=THREE.MathUtils.clamp(da,-turnRate*dt,turnRate*dt);
  }
}
function nV(target,current,rate){return Math.max(0,current+Math.min(rate,target-current))}
function nearestMate(){
 return mates.reduce((b,p)=>dist(p,controlled())<dist(b,controlled())?p:b,mates[0])
}
function kickTo(tx,tz,power){
 const p=controlled(),dx=ball.position.x-p.position.x,dz=ball.position.z-p.position.z;
 if(Math.hypot(dx,dz)>3.1||performance.now()<state.kickLock)return;
 const x=tx-ball.position.x,z=tz-ball.position.z,l=Math.hypot(x,z)||1;
 p.userData.animState="kick";p.userData.animTimer=.34;
 ball.userData.owner=null;state.firstKickoff=false;state.aiEnabled=true;state.userTouched=true;state.matchPhase="play";advancedState.lastPass={team:p.userData.team,from:p.position.clone(),time:performance.now()};state.lastPossessionChange=performance.now();const passScale=p.userData.profile.passing/80;
 ball.userData.vx=x/l*power*passScale;ball.userData.vz=z/l*power*passScale;
 ball.userData.vy=Math.max(0,power-22)*.12;
 // Kick-induced spin: direction-sensitive, clamped for stable mobile simulation.
 const sideSpin=THREE.MathUtils.clamp((tz-p.position.z)*.018-(tx-p.position.x)*.018,-1.8,1.8);
 ball.userData.spinX=THREE.MathUtils.clamp(-ball.userData.vz*.045,-1.8,1.8);
 ball.userData.spinZ=THREE.MathUtils.clamp(ball.userData.vx*.045+sideSpin,-1.8,1.8);
 state.kickLock=performance.now()+260; if(power>28)sfxKick();else sfxPass()
}
function stealBall(taker,carrier,force=false){
 if(!taker||!carrier||carrier===taker||ball.userData.owner!==carrier)return false;
 const d=dist(taker,carrier),def=(taker.userData.profile.defending||50)*.62+(taker.userData.profile.physical||70)*.38;
 const atk=(carrier.userData.profile.dribbling||70)*.72+(carrier.userData.profile.physical||70)*.28;
 if(d>1.9&&!force)return false;
 const shielding=carrier.userData.shielding?0.22:0;
 const facing=Math.cos(carrier.rotation.y-(Math.atan2(taker.position.x-carrier.position.x,taker.position.z-carrier.position.z)));
 const bodyAdv=Math.max(0,facing)*.08;
 const chance=THREE.MathUtils.clamp(.42+(def-atk)*.012-shielding-bodyAdv,.08,.88);
 if(!force&&Math.random()>chance)return false;
 ball.userData.owner=taker;ball.userData.vx=0;ball.userData.vz=0;
 taker.userData.aiPossessionSince=taker.userData.team===red?performance.now():0;
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
   const ownedFoe=ball.userData.owner&&ball.userData.owner.userData.team===red?ball.userData.owner:null;
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
   if(!a.userData.rigMixer&&a.userData.legL&&a.userData.legR){
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
 if(p.userData.sharpTouchUntil&&performance.now()<p.userData.sharpTouchUntil){
   const v=p.userData.sharpTouchDir||{x:Math.sin(p.rotation.y),z:Math.cos(p.rotation.y)};
   if(state.firstKickoff){state.firstKickoff=false;state.userTouched=true;state.aiEnabled=true;state.matchPhase="play";state.lastPossessionChange=performance.now()}
   move(p,p.position.x+v.x,p.position.z+v.z,s*1.38,dt);
 }else if(Math.hypot(state.joy.x,state.joy.y)>.08){
   if(state.firstKickoff){state.firstKickoff=false;state.userTouched=true;state.aiEnabled=true;state.matchPhase="play";state.lastPossessionChange=performance.now()}
   move(p,p.position.x+state.joy.x,p.position.z+state.joy.y,s,dt);
 }
 p.position.x=THREE.MathUtils.clamp(p.position.x,-51,51);p.position.z=THREE.MathUtils.clamp(p.position.z,-32,32);
 const blueHas=ball.userData.owner?.userData?.team===blue,redHas=ball.userData.owner?.userData?.team===red;
 mates.forEach((m,i)=>{
   const q=tacticalTarget(m,blue,blueHas), speed=4.2+.9*(m.userData.profile.pace/100);
   move(m,q.x,q.z,speed,dt);
 });
 foes.forEach((f,i)=>{
   const q=tacticalTarget(f,red,redHas);
   const threat=ball.userData.owner?.userData?.team===blue?ball.userData.owner:ball;
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
 if(state.aiEnabled===true&&state.firstKickoff!==true && owner && owner.userData.team===red && owner.position.x>0 && performance.now()>owner.userData.aiKick){
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
   const shielding=owner.userData.shielding?1:0;
   const lead=.62+.44*control+(shielding?.18:0);
   const faceX=Math.sin(owner.rotation.y),faceZ=Math.cos(owner.rotation.y);
   const behind=owner.userData.shielding?-0.22:0;
   const touch=owner.userData.firstTouchOffset||{x:0,z:0};
   ball.position.x=owner.position.x+faceX*(lead+behind)+touch.x;
   ball.position.z=owner.position.z+faceZ*(lead+behind)+touch.z;
   ball.userData.lastTouchTeam=owner.userData.team;
   ball.position.y=.5;ball.userData.vy=0;
   if(owner.userData.firstTouchOffset){
     owner.userData.firstTouchOffset.x*=Math.pow(.001,dt);
     owner.userData.firstTouchOffset.z*=Math.pow(.001,dt);
     if(Math.hypot(owner.userData.firstTouchOffset.x,owner.userData.firstTouchOffset.z)<.03)owner.userData.firstTouchOffset=null;
   }
   const opponents=owner.userData.team===blue?foes:allHome();
   const contact=opponents.reduce((b,x)=>dist(x,owner)<dist(b,owner)?x:b,opponents[0]);
   if(contact&&dist(contact,owner)<1.18)stealBall(contact,owner,false);
 }else{
   // Lightweight Magnus + aerodynamic drag model, tuned for the browser 120 Hz kernel.
 const vx=ball.userData.vx||0,vz=ball.userData.vz||0,vy=ball.userData.vy||0;
 const sx=ball.userData.spinX||0,sz=ball.userData.spinZ||0;
 const speed=Math.hypot(vx,vz);
 const magnus=THREE.MathUtils.clamp(.018*speed,0,.42);
 const ax=sz*vz*magnus,az=-sx*vx*magnus;
 ball.userData.vx+=ax*dt;ball.userData.vz+=az*dt;
 ball.position.x+=ball.userData.vx*dt;ball.position.z+=ball.userData.vz*dt;ball.position.y+=vy*dt;
 ball.userData.vy=vy-17*dt;
 const air=Math.pow(.985,dt*60);ball.userData.vx*=air;ball.userData.vz*=air;
 ball.userData.spinX*=Math.pow(.992,dt*60);ball.userData.spinZ*=Math.pow(.992,dt*60);
 if(ball.position.y<.48){ball.position.y=.48;if((ball.userData.vy||0)<-1.1){ball.userData.vy=-(ball.userData.vy||0)*.42;ball.userData.vx*=.84;ball.userData.vz*=.84;ball.userData.spinX*=.72;ball.userData.spinZ*=.72}else ball.userData.vy=0}
   const candidates=allHome().concat(foes);
   const near=candidates.reduce((b,x)=>dist(x,ball)<dist(b,ball)?x:b,candidates[0]);
   if(dist(near,ball)<1.45&&Math.hypot(ball.userData.vx,ball.userData.vz)<10){ball.userData.owner=near;ball.userData.lastTouchTeam=near.userData.team;ball.userData.vy=0;applyFirstTouch(near,ball.userData.vx/(Math.hypot(ball.userData.vx,ball.userData.vz)||1),ball.userData.vz/(Math.hypot(ball.userData.vx,ball.userData.vz)||1),Math.hypot(ball.userData.vx,ball.userData.vz));enhancedState.passTarget=null;}
 }
 ball.rotation.x+=ball.userData.vz*dt*1.8;ball.rotation.z-=ball.userData.vx*dt*1.8;
 if(ball.position.z<-34||ball.position.z>34){
   const side=ball.position.z>34?34:-34;
   const restartTeam=ball.userData.lastTouchTeam===blue?red:blue;
   stageSetPiece("THROW IN",ball.position.x,side,restartTeam);
 }
 if(ball.position.x<-53||ball.position.x>53){
   const towardAway=ball.position.x>53&&ball.userData.vx>0, towardHome=ball.position.x<-53&&ball.userData.vx<0;
   if(ball.position.y<3.55&&Math.abs(ball.position.z)<7&&(towardAway||towardHome)&&state.matchPhase==="play"){
     const home=towardAway;state.score[home?0:1]++;scoreEl.textContent=state.score.join(" - ");state.matchPhase="goal";resumeAudio();sfxGoal();showMatchEvent(home?"GOAL!":"AWAY GOAL",1800);reset(home?"GOAL!":"AWAY GOAL");
   } else {
     const defendingTeam=towardAway?red:blue;
     const last=ball.userData.lastTouchTeam;
     const attackingTeam=last===defendingTeam?(defendingTeam===blue?red:blue):last;
     const isCorner=last===defendingTeam;
     if(isCorner){
       const cz=ball.position.z>=0?33.1:-33.1;
       stageSetPiece("CORNER",towardAway?52.2:-52.2,cz,attackingTeam||red);
     }else{
       stageSetPiece("GOAL KICK",towardAway?49.6:-49.6,0,defendingTeam);
     }
   }
 }
 gks.forEach((g,i)=>{g.position.z=THREE.MathUtils.clamp(ball.position.z,-6,6);g.rotation.y=i?-Math.PI/2:Math.PI/2});
 const dir=p.userData.team===blue?1:-1;
 const ballSpeed=Math.hypot(ball.userData.vx||0,ball.userData.vz||0);
 const blendX=p.position.x*.54+ball.position.x*.46,blendZ=p.position.z*.54+ball.position.z*.46;
 const sideOffset=THREE.MathUtils.clamp((ball.position.z-p.position.z)*.24,-8,8);
 const danger=Math.max(0,Math.abs(ball.position.x)-35)/18;
 updateBroadcastCamera(dt);
animatePlayers(dt);updateRadar();updatePlayerCard();
 if(state.time<=0){state.over=true;resumeAudio();sfxWhistle();msg.textContent=`FULL TIME  ${state.score[0]} - ${state.score[1]}  (SHOOTで再開)`}
 const sprintHeld=!!state.actions?.sprint,shieldHeld=!!state.actions?.shield;state.actions={sprint:sprintHeld,shield:shieldHeld}
}
function updateBroadcastCamera(dt){
  // Endline broadcast camera: the pitch length runs along X, so the camera
  // sits beyond the goal line instead of looking across the touchline.
  const aspect=THREE.MathUtils.clamp(camera.aspect,.7,2.4);
  const targetX=THREE.MathUtils.clamp(ball.position.x*.10,-6,6);
  const targetZ=THREE.MathUtils.clamp(ball.position.z*.10,-4,4);
  const desired=new THREE.Vector3(96,52,targetZ);
  const alpha=1-Math.pow(.0002,Math.min(.05,dt));
  camera.position.lerp(desired,alpha);
  camera.fov=landscapeOrPortraitFov(aspect);
  camera.near=.1;
  camera.far=500;
  camera.updateProjectionMatrix();
  camera.lookAt(targetX,0,targetZ);
}
function landscapeOrPortraitFov(aspect){
  return aspect>=1.0?48:43;
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
function getViewportSize(){
 const app=document.querySelector("#app");
 const rect=app?.getBoundingClientRect();
 const vv=window.visualViewport;
 // Prefer the actual game container. Some iOS embedded browsers expose a bogus
 // visualViewport/innerHeight (occasionally tens of thousands of CSS pixels).
 const wRaw=app?.clientWidth||rect?.width||vv?.width||document.documentElement.clientWidth||innerWidth||1;
 const hRaw=app?.clientHeight||rect?.height||document.documentElement.clientHeight||vv?.height||innerHeight||1;
 const w=Math.max(1,Math.min(Math.round(wRaw),2400));
 const h=Math.max(1,Math.min(Math.round(hRaw),2400));
 return {w,h};
}
function resize(){
 const {w,h}=getViewportSize();
 camera.aspect=w/h;
 camera.updateProjectionMatrix();
 const memory=Number(navigator.deviceMemory||4);
 const maxPixels=memory<=2?900000:memory<=4?1400000:1900000;
 const dpr=Math.min(devicePixelRatio||1,1.35,Math.sqrt(maxPixels/Math.max(1,w*h)));
 renderer.setPixelRatio(Math.max(1,dpr));
 renderer.setSize(w,h,false);
 renderer.domElement.style.width="100%";
 renderer.domElement.style.height="100%";
 renderer.domElement.style.maxWidth="100%";
 renderer.domElement.style.maxHeight="100%";
 if(sun.shadow.mapSize.x>(memory<=4?512:1024))sun.shadow.mapSize.set(memory<=4?512:1024,memory<=4?512:1024);
}
addEventListener("resize",resize,{passive:true});
window.visualViewport?.addEventListener("resize",resize,{passive:true});
window.visualViewport?.addEventListener("scroll",resize,{passive:true});
resize();
const stick=document.querySelector("#stick"),knob=document.querySelector("#knob");
let pid=null;
function joyFromPoint(x,y){
 const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
 const dx=x-cx,dy=y-cy,max=r.width*.34,l=Math.hypot(dx,dy)||1,k=Math.min(1,max/l);
 state.joy={x:dx/l*k,y:dy/l*k};
 knob.style.transform=`translate(${dx*k}px,${dy*k}px)`;
 return {x:state.joy.x,y:state.joy.y,magnitude:k};
}
stick.addEventListener("pointerdown",e=>{pid=e.pointerId;stick.setPointerCapture(pid);joyFromPoint(e.clientX,e.clientY)});
stick.addEventListener("pointermove",e=>{if(e.pointerId===pid)joyFromPoint(e.clientX,e.clientY)});
function stopJoy(){pid=null;state.joy={x:0,y:0};knob.style.transform=""}
stick.addEventListener("pointerup",stopJoy);stick.addEventListener("pointercancel",stopJoy);

const touchControl={
 leftId:null,rightId:null,leftStart:null,rightStart:null,leftAt:0,rightAt:0,
 lastLeftTap:0,lastRightTap:0,rightHeld:false,sharpTriggered:false
};
const gameSurface=document.querySelector("#game");
if(gameSurface)gameSurface.style.touchAction="none";
// Touch & Flick input follows the same two-sided interaction model as modern
// mobile touch-and-flick football controls: left side = movement/dribble,
// right side = kick/press intent. There are no visible action buttons.
function isGameplayPointer(e){
 const t=e.target;
 return !!t && !t.closest?.("#controls,button,#stick,#actions,#matchbar,#topTools,#radarWrap,#playerCard");
}
function isLeftSide(x){return x<innerWidth*.50}
function isRightSide(x){return x>=innerWidth*.50}
function directionFrom(dx,dy){
 const l=Math.hypot(dx,dy)||1;
 return {x:dx/l,z:dy/l,mag:Math.min(1,l/95)};
}
function setGestureJoy(x,y){
 const v=directionFrom(x,y);
 state.joy={x:v.x*v.mag,y:v.z*v.mag};
}
function nearestActionFlick(dx,dy){
 const ax=Math.abs(dx),ay=Math.abs(dy),m=Math.hypot(dx,dy);
 if(m<34)return "tap";
 if(ay>ax*1.15)return dy<0?"through":"lob";
 return "shoot";
}
function performTouchFlickAction(kind,dx,dy){
 const p=controlled();
 if(!p)return;
 const v=directionFrom(dx,dy);
 if(kind==="shoot"){
   state.joy={x:v.x,y:v.z};
   state.chargePower=THREE.MathUtils.clamp(v.mag,.25,1);
   state.actions.shoot=true;
 }else if(kind==="through"){
   state.joy={x:v.x,y:v.z};
   state.chargePower=THREE.MathUtils.clamp(v.mag,.25,1);
   state.actions.through=true;
 }else if(kind==="lob"){
   state.joy={x:v.x,y:v.z};
   state.chargePower=THREE.MathUtils.clamp(v.mag,.25,1);
   state.actions.lob=true;
 }else{
   // Tap is a short pass in possession; without possession it is pressure/tackle.
   if(ball.userData.owner===p){
     state.actions.pass=true;
     state.chargePower=.52;
   }else{
     state.actions.tackle=true;
   }
 }
}
function sharpTouch(){
 const p=controlled();
 if(!p)return;
 // On attack, a double-tap/gesture is a sharp touch. On defense the same
 // natural two-tap gesture becomes a close-range tackle/shoulder challenge.
 if(ball.userData.owner===p){
   const v=Math.hypot(state.joy.x,state.joy.y)>0.2
     ?directionFrom(state.joy.x*120,state.joy.y*120)
     :{x:Math.sin(p.rotation.y),z:Math.cos(p.rotation.y),mag:1};
   p.userData.sharpTouchUntil=performance.now()+360;
   p.userData.sharpTouchDir={x:v.x,z:v.z};
   p.userData.stamina=Math.max(0,p.userData.stamina-2.2);
 }else{
   state.actions.tackle=true;
 }
}
function handleFieldPointerDown(e){
 if(!isGameplayPointer(e))return;
 e.preventDefault();
 resumeAudio();
 const now=performance.now(),x=e.clientX,y=e.clientY;
 if(isLeftSide(x)){
   touchControl.leftId=e.pointerId;
   touchControl.leftStart={x,y};
   touchControl.leftAt=now;
   touchControl.sharpTriggered=false;
   if(now-touchControl.lastLeftTap<280)sharpTouch();
   touchControl.lastLeftTap=now;
 }else{
   touchControl.rightId=e.pointerId;
   touchControl.rightStart={x,y};
   touchControl.rightAt=now;
   touchControl.rightHeld=true;
   // Holding the right side provides the continuous body-shield/match-up
   // intent; releasing it returns to neutral.
   state.actions.shield=true;
 }
 gameplayCanvas.setPointerCapture?.(e.pointerId);
}
function handleFieldPointerMove(e){
 if(e.pointerId===touchControl.leftId&&touchControl.leftStart){
   e.preventDefault();
   const dx=e.clientX-touchControl.leftStart.x,dy=e.clientY-touchControl.leftStart.y;
   setGestureJoy(dx,dy);
   const mag=Math.hypot(dx,dy);
   state.actions.sprint=mag>105;
   // Official-style two-finger interaction: if the right side is held,
   // a left flick immediately performs a sharp touch rather than waiting
   // for a second visible control.
   if(touchControl.rightHeld&&!touchControl.sharpTriggered&&mag>42){
     sharpTouch();
     touchControl.sharpTriggered=true;
   }
 }
}
function handleFieldPointerUp(e){
 if(e.pointerId===touchControl.leftId){
   e.preventDefault();
   const st=touchControl.leftStart||{x:e.clientX,y:e.clientY};
   const dx=e.clientX-st.x,dy=e.clientY-st.y,mag=Math.hypot(dx,dy);
   if(mag<24)sharpTouch();
   touchControl.leftId=null;
   touchControl.leftStart=null;
   state.joy={x:0,y:0};
   state.actions.sprint=false;
 }else if(e.pointerId===touchControl.rightId){
   const st=touchControl.rightStart||{x:e.clientX,y:e.clientY};
   const dx=e.clientX-st.x,dy=e.clientY-st.y,mag=Math.hypot(dx,dy);
   const held=performance.now()-touchControl.rightAt;
   // A held right side is shield/match-up; a quick release becomes the
   // directional kick gesture. This prevents accidental passes while holding.
   state.actions.shield=false;
   if(held<520||mag>34){
     const kind=nearestActionFlick(dx,dy);
     performTouchFlickAction(kind,dx,dy);
   }
   touchControl.rightHeld=false;
   touchControl.rightId=null;
   touchControl.rightStart=null;
 }
}
const gameplayCanvas=renderer.domElement;
gameplayCanvas.addEventListener("pointerdown",handleFieldPointerDown,{passive:false});
gameplayCanvas.addEventListener("pointermove",handleFieldPointerMove,{passive:false});
gameplayCanvas.addEventListener("pointerup",handleFieldPointerUp,{passive:false});
gameplayCanvas.addEventListener("pointercancel",handleFieldPointerUp,{passive:false});
function updateTouchControlHint(){
 const has=document.getElementById("touchHint");
 if(!has)return;
 const p=controlled(),attacking=ball.userData.owner?.userData?.team===p?.userData?.team;
 has.textContent=attacking?"左ドラッグ=ドリブル / 右フリック=シュート・スルー・ロブ":"左ドラッグ=移動 / 右タップ=プレス";
}
function updateChargeUI(){
 const power=THREE.MathUtils.clamp(Number.isFinite(state.chargePower)?state.chargePower:0,0,1);
 const active=state.chargeAction||"";
 document.querySelectorAll("#actions button").forEach(btn=>{
   const bar=btn.querySelector(".charge"); if(!bar)return;
   const action=btn.dataset.action||"";
   bar.style.width=action===active?(power*100)+"%":"0%";
 });
}


/* Enhanced match layer: input-only enhancement.
   IMPORTANT: this layer never replaces the core AI kick/steal functions.
   That keeps AI actions deterministic and prevents player-control state from
   leaking into the opponent simulation. */
/* Advanced football simulation layer: deterministic 120 Hz-friendly state,
   first touch, shielding, body orientation, tactical lines, pressing, offside,
   set-piece staging, goalkeeper positioning, formations and substitutions. */
const advancedState={
  formation:"4-3-3",
  mentality:"balanced",
  pressIntensity:.72,
  shieldHeld:false,
  firstTouchUntil:0,
  firstTouchTarget:null,
  lastPass:null,
  offsideUntil:0,
  setPiece:null,
  setPieceTimer:0,
  substitutions:0,
  maxSubstitutions:5,
  half:1,
  lastBallX:ball.position.x,
  lastBallZ:ball.position.z,
  event:"KICK OFF",
  passTarget:null,
  firstTouchLock:0,
  lastKick:0
};
function showMatchEvent(text,duration=1100){
  msg.textContent=text;
  setTimeout(()=>{if(msg.textContent===text)msg.textContent=""},duration);
}
function isOffsideAtRelease(p,t){
  if(!t||t.userData.team!==p.userData.team)return false;
  const dir=p.userData.team===blue?1:-1;
  const opponents=p.userData.team===blue?foes:allHome();
  const xs=opponents.map(o=>o.position.x*dir).sort((a,b)=>b-a);
  const secondLast=xs[1]??-999;
  const receiver=t.position.x*dir,ballX=ball.position.x*dir;
  return receiver>0.001 && receiver>secondLast+0.15 && receiver>ballX+0.15;
}
function applyFirstTouch(receiver,passDirX,passDirZ,speed){
  const control=THREE.MathUtils.clamp((receiver.userData.profile?.dribbling||70)/90,.55,1.08);
  const bodyAngle=receiver.rotation.y;
  const faceX=Math.sin(bodyAngle),faceZ=Math.cos(bodyAngle);
  const toward=Math.max(-1,Math.min(1,faceX*passDirX+faceZ*passDirZ));
  const cushion=(1.0+(1-control)*1.1)*(toward>.25?.72:1.12);
  receiver.userData.firstTouchUntil=performance.now()+180;
  receiver.userData.firstTouchOffset={x:passDirX*cushion,z:passDirZ*cushion};
  receiver.userData.firstTouchQuality=control;
  advancedState.firstTouchTarget=receiver;
  advancedState.firstTouchUntil=performance.now()+220;
  receiver.userData.animState="locomotion";
  receiver.userData.touchAnim=0;
  if(speed>16) receiver.userData.stamina=Math.max(0,receiver.userData.stamina-1.2);
}
function defensiveLineAndPress(){
  const teams=[[...allHome(),blue],[...foes,red]];
  for(const [arr,team] of teams){
    const dir=team===blue?1:-1;
    const opp=team===blue?foes:allHome();
    const owner=ball.userData.owner;
    const attacking=owner?.userData?.team===team;
    const threat=owner&&owner.userData.team!==team?owner:ball;
    const lineX=THREE.MathUtils.clamp(threat.position.x*0.35-dir*6,-34,34);
    const candidates=arr.filter(p=>p.userData.role!=="GK");
    const pressor=candidates.reduce((best,p)=>dist(p,threat)<dist(best,threat)?p:best,candidates[0]);
    for(const p of candidates){
      p.userData.pressTarget=(p===pressor&&!attacking&&advancedState.pressIntensity>.45)?threat:null;
      p.userData.defensiveLineX=lineX;
    }
  }
}
function goalkeeperBrain(){
  const goalKeepers=gks;
  goalKeepers.forEach((g,i)=>{
    const team=i===0?blue:red,dir=team===blue?1:-1;
    const goalX=dir*50.1;
    const danger=ball.position.x*dir;
    const z=THREE.MathUtils.clamp(ball.position.z,-6.3,6.3);
    const depth=THREE.MathUtils.clamp((danger-28)*.20,0,4.2);
    const targetX=goalX-dir*depth;
    const dx=targetX-g.position.x,dz=z-g.position.z;
    const d=Math.hypot(dx,dz);
    if(d>.05){g.position.x+=dx/d*Math.min(d,7*dtForAI);g.position.z+=dz/d*Math.min(d,8*dtForAI)}
    g.rotation.y=Math.atan2(dir,0);
    g.userData.gkDive=(Math.abs(ball.position.z-g.position.z)>2.8&&danger>35);
  });
}
let dtForAI=.008333;
function runAutomaticSubstitution(){
  if(advancedState.substitutions>=advancedState.maxSubstitutions)return;
  const low=allHome().find(p=>p.userData.role!=="GK"&&p.userData.stamina<12&&!p.userData.subbed);
  if(!low)return;
  low.userData.subbed=true;low.userData.stamina=72;low.userData.profile.pace=Math.min(99,low.userData.profile.pace+3);
  advancedState.substitutions++;
  showMatchEvent("SUBSTITUTION  #"+low.userData.number,1300);
}
function stageSetPiece(type,x,z,team){
  advancedState.setPiece={type,x,z,team};
  advancedState.setPieceTimer=performance.now()+850;
  state.matchPhase="setpiece";ball.userData.owner=null;ball.userData.vx=ball.userData.vz=ball.userData.vy=0;
  ball.position.set(THREE.MathUtils.clamp(x,-52.2,52.2),.48,THREE.MathUtils.clamp(z,-33.2,33.2));
  showMatchEvent(type.toUpperCase(),900);sfxWhistle();
  const arr=team===blue?allHome():foes;
  arr.forEach((p,i)=>{
    const side=(i%2?1:-1);
    p.position.x=THREE.MathUtils.clamp(p.position.x,-50,50);
    p.position.z=THREE.MathUtils.clamp(p.position.z,-31,31);
    if(Math.abs(p.position.x-x)<3&&Math.abs(p.position.z-z)<3)p.position.z=THREE.MathUtils.clamp(z+side*4,-31,31);
  });
}
function releaseSetPiece(){
  if(!advancedState.setPiece)return;
  const sp=advancedState.setPiece,arr=sp.team===blue?allHome():foes;
  const taker=arr.filter(p=>p.userData.role!=="GK").sort((a,b)=>Math.hypot(a.position.x-sp.x,a.position.z-sp.z)-Math.hypot(b.position.x-sp.x,b.position.z-sp.z))[0]||arr[0];
  ball.userData.owner=taker;
  state.matchPhase="play";state.firstKickoff=false;state.aiEnabled=true;state.userTouched=sp.team===blue||state.userTouched;
  advancedState.setPiece=null;
}
const enhancedState={
  lastKick:0,
  passTarget:null,
  firstTouchLock:0,
  ballHeight:0,
  ballVz:0
};

function getAimVector(p){
  const x=Number(state.joy.x)||0,y=Number(state.joy.y)||0;
  if(Math.hypot(x,y)>.18){
    const l=Math.hypot(x,y);
    return {x:x/l,z:y/l};
  }
  return {x:Math.sin(p.rotation.y),z:Math.cos(p.rotation.y)};
}

function teamMatesOf(p){
  const group=p?.userData?.team===blue?allHome():foes;
  return group.filter(x=>x!==p);
}

function findAimedTeammate(p,through=false){
  const aim=getAimVector(p),team=teamMatesOf(p);
  let best=null,bestScore=-1e9;
  for(const t of team){
    const dx=t.position.x-p.position.x,dz=t.position.z-p.position.z,d=Math.hypot(dx,dz)||1;
    if(d>46)continue;
    const dot=(dx*aim.x+dz*aim.z)/d;
    const forward=Math.max(0,dot);
    const space=through?Math.max(0,18-d):Math.max(0,12-d)*.35;
    const rolePenalty=t.userData.role==="DEF"?1.0:0;
    const score=dot*5+forward*2.5+space-rolePenalty;
    if(score>bestScore){bestScore=score;best=t}
  }
  return best||team[0]||p;
}

function playerKick(kind,power){
  const p=controlled();
  if(!p||performance.now()<state.kickLock)return false;
  const d=dist(p,ball);
  if(ball.userData.owner!==p&&d>3.2)return false;
  const target=kind==="shoot"?null:findAimedTeammate(p,kind==="through");
  if(target&&isOffsideAtRelease(p,target)){
    stageSetPiece("OFFSIDE",target.position.x,target.position.z,p.userData.team===blue?red:blue);
    advancedState.offsideUntil=performance.now()+900;
    return false;
  }

  const charge=THREE.MathUtils.clamp(Number(power??.65),0,1);
  const aim=getAimVector(p);
  let tx,tz,speed,vy=0;

  if(kind==="shoot"){
    const goalX=p.userData.team===blue?53:-53;
    tx=goalX;
    tz=THREE.MathUtils.clamp(p.position.z+aim.z*(7+4*charge),-6.4,6.4);
    speed=25+14*charge*(p.userData.profile.shooting/80);
    vy=1.0+1.8*charge;
  }else{
    const through=kind==="through";
    const t=findAimedTeammate(p,through);
    const lead=through?(5+10*charge):(1.2+3.2*charge);
    tx=t.position.x+aim.x*lead;
    tz=t.position.z+aim.z*lead;
    speed=(kind==="lob"?15:11.5)+(kind==="lob"?12:10.5)*charge;
    vy=kind==="lob"?(6.5+6.5*charge):(kind==="through"?0.8+1.2*charge:0);
    enhancedState.passTarget=t;
  }

  const dx=tx-ball.position.x,dz=tz-ball.position.z,l=Math.hypot(dx,dz)||1;
  ball.userData.owner=null;
  ball.userData.lastTouchTeam=p.userData.team;
  ball.userData.vx=dx/l*speed;
  ball.userData.vz=dz/l*speed;
  ball.userData.vy=vy;
  ball.userData.spin=kind==="shoot"?(state.joy.x||0)*.8:0;

  enhancedState.lastKick=performance.now();
  enhancedState.firstTouchLock=performance.now()+160;
  state.firstKickoff=false;
  state.aiEnabled=true;
  state.userTouched=true;
  state.matchPhase="play";
  state.lastPossessionChange=performance.now();
  p.userData.animState="kick";
  p.userData.animTimer=.36;
  state.kickLock=performance.now()+260;

  if(kind==="shoot"||kind==="lob")sfxKick();else sfxPass();
  return true;
}

function runEnhancedActions(){
  const a=state.actions||{};
  state.shield=!!a.shield;
  const cp=controlled(); if(cp)cp.userData.shielding=!!a.shield;
  if(a.switch){
    selectBestDefender();
    state.actions.switch=false;
  }
  if(a.pass){
    playerKick("pass",state.chargePower??.55);
    state.actions.pass=false;
    state.chargePower=null;
    state.chargeAction=null;
  }
  if(a.through){
    playerKick("through",state.chargePower??.65);
    state.actions.through=false;
    state.chargePower=null;
    state.chargeAction=null;
  }
  if(a.lob){
    playerKick("lob",state.chargePower??.70);
    state.actions.lob=false;
    state.chargePower=null;
    state.chargeAction=null;
  }
  if(a.shoot){
    playerKick("shoot",state.chargePower??.65);
    state.actions.shoot=false;
    state.chargePower=null;
    state.chargeAction=null;
  }
  // Sprint intentionally remains held in state.actions so core update() can
  // consume it continuously while the button is held.
  if(a.tackle&&performance.now()>state.tackleLock){
    const p=controlled();
    state.tackleLock=performance.now()+650;
    resumeAudio();
    sfxTackle();
    const ownedFoe=ball.userData.owner&&ball.userData.owner.userData.team===red?ball.userData.owner:null;
    const target=ownedFoe||(foes.length?foes.reduce((b,x)=>dist(x,p)<dist(b,p)?x:b,foes[0]):null);
    if(target&&dist(target,p)<4.4){
      p.userData.animState="tackle";
      p.userData.animTimer=.42;
      stealBall(p,target,true);
    }
    state.actions.tackle=false;
  }
}

actions=runEnhancedActions;

const coreUpdate=update;
update=function(dt){
  if(advancedState.setPiece){
    if(performance.now()>=advancedState.setPieceTimer)releaseSetPiece();
    else {updateChargeUI();return;}
  }
  coreUpdate(dt);
  if(state.over)return;

  if(enhancedState.firstTouchLock>0&&performance.now()<enhancedState.firstTouchLock){
    updateChargeUI();
    return;
  }

  const t=enhancedState.passTarget;
  if(!ball.userData.owner&&t&&t.userData.team===controlled()?.userData?.team){
    const d=dist(t,ball);
    const speed=Math.hypot(ball.userData.vx,ball.userData.vz);
    if(d<1.9&&speed<18){
      ball.userData.owner=t;
      ball.userData.vx=0;
      ball.userData.vz=0;
      ball.userData.vy=0;
      enhancedState.passTarget=null;
      const hs=allHome(),idx=hs.indexOf(t);
      if(idx>=0)selectPlayer(idx);
    }else if(d>7&&speed<4){
      enhancedState.passTarget=null;
    }
  }
  updateChargeUI();
};

let last=performance.now(),simAcc=0;
const runtimeHealth={actions:true,update:true,press:true,gk:true,subs:true,diagnostic:""};
function isolateRuntimeError(phase,err){
  const message=String(err?.message||err||"runtime error");
  runtimeHealth.diagnostic=phase+": "+message;
  window.__lastGameError=runtimeHealth.diagnostic;
  window.__lastGameStack=String(err?.stack||"");
  // Never kill the match loop because of one optional subsystem. Disable only the
  // failing layer and keep rendering/input alive so mobile browsers can recover.
  if(phase==="actions")runtimeHealth.actions=false;
  if(phase==="update")runtimeHealth.update=false;
  if(phase==="press")runtimeHealth.press=false;
  if(phase==="gk")runtimeHealth.gk=false;
  if(phase==="subs")runtimeHealth.subs=false;
  state.actions=state.actions||{};
}
function loop(now){
  const frameDt=Math.min(.05,(now-last)/1000);last=now;simAcc=Math.min(.5,simAcc+frameDt);
  const fixed=1/120;let steps=0;
  while(simAcc>=fixed&&steps<8){
    dtForAI=fixed;
    if(runtimeHealth.actions){try{actions()}catch(err){isolateRuntimeError("actions",err)}}
    if(runtimeHealth.update){
      try{update(fixed)}
      catch(err){
        isolateRuntimeError("update",err);
        // The enhanced wrapper is optional. Fall back to the original core simulation.
        try{coreUpdate(fixed)}catch(coreErr){isolateRuntimeError("coreUpdate",coreErr)}
      }
    }else{
      try{coreUpdate(fixed)}catch(err){isolateRuntimeError("coreUpdate",err)}
    }
    if(runtimeHealth.press){try{defensiveLineAndPress()}catch(err){isolateRuntimeError("press",err)}}
    if(runtimeHealth.gk){try{goalkeeperBrain()}catch(err){isolateRuntimeError("gk",err)}}
    simAcc-=fixed;steps++;
  }
  if(runtimeHealth.subs){try{runAutomaticSubstitution()}catch(err){isolateRuntimeError("subs",err)}}
  try{updateChargeUI()}catch(err){isolateRuntimeError("ui",err)}
  clockEl.textContent=`${String(Math.floor(state.time/60)).padStart(2,"0")}:${String(Math.floor(state.time%60)).padStart(2,"0")}`;
  if(!renderPaused){
    try{renderer.render(scene,camera)}
    catch(err){
      window.__lastGameError="render: "+String(err?.message||err);
      window.__lastGameStack=String(err?.stack||"");
      renderPaused=true;
      window.__activateFallback?.("WebGL render failed — recovery");
    }
  }
  requestAnimationFrame(loop)
}
try{reset()}catch(err){isolateRuntimeError("reset",err)}
if(boot)boot.classList.add("ready");
requestAnimationFrame(loop);