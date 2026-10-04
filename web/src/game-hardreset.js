import * as THREE from "three";
import { PLAYER_POOL } from "./player-pool.generated.js";

const $ = (s) => document.querySelector(s);
const mount = $("#game");
const boot = $("#boot");
const scoreEl = $("#score");
const clockEl = $("#clock");
const stateEl = $("#matchState");
const playerLabel = $("#playerLabel");
const playerNo = $("#playerNo");
const playerRole = $("#playerRole");
const staminaFill = $("#staminaFill");
const knob = $("#knob");
const message = $("#message");

const FIELD = { w: 105, d: 68, goalW: 14.64 };
const MATCH_TIME_SCALE = 60;
const MATCH_DURATION = 90 * 60;
const HALF_TIME_AT = 45 * 60;
const HOME = 0;
const AWAY = 1;
const savedOwnedIds = JSON.parse(localStorage.getItem("football_owned") || "[]");
const ownedSet = new Set(savedOwnedIds);
const homePool = [...PLAYER_POOL.filter(p => ownedSet.has(p.id)), ...PLAYER_POOL.filter(p => !ownedSet.has(p.id))];

const state = {
  time: 0,
  score: [0, 0],
  selected: 9,
  joy: { x: 0, y: 0 },
  sprint: false,
  paused: false,
  matchActive: false,
  matchState: "idle",
  half: 1,
  finished: false,
  lastGoalAt: 0,
  cameraMode: "broadcast",
  rightGesture: null,
  leftPointerId: null,
  leftTapAt: 0,
  rightHeld: false,
  matchUp: false,
  teamPressUntil: 0,
  lastSharpTouchAt: 0,
  sharpTouchTriggered: false,
  shieldUntil: 0,
  rightTapAt: 0,
  pressUntil: 0,
  lastTouchAt: 0,
  lastDefensiveContactAt: 0
};

let renderer;
let scene;
let camera;
let ball;
let clock;
let players = [];
let home = [];
let away = [];
let lastFrame = performance.now();

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(a, b) { return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z); }
function mat(color, roughness = 0.8) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}
let sharedShadowTexture=null;
function softShadowTexture(){
  if(sharedShadowTexture)return sharedShadowTexture;
  const c=document.createElement("canvas");
  c.width=c.height=64;
  const x=c.getContext("2d");
  const g=x.createRadialGradient(32,32,2,32,32,31);
  g.addColorStop(0,"rgba(0,0,0,.36)");
  g.addColorStop(.48,"rgba(0,0,0,.17)");
  g.addColorStop(1,"rgba(0,0,0,0)");
  x.fillStyle=g;x.fillRect(0,0,64,64);
  sharedShadowTexture=new THREE.CanvasTexture(c);
  return sharedShadowTexture;
}
function showMessage(text, ms = 900) {
  message.textContent = text;
  clearTimeout(showMessage.t);
  showMessage.t = setTimeout(() => { message.textContent = ""; }, ms);
}

function gameplayAttributes(player,role,index){
 const overall=clamp(Number(player?.overall)||70,58,99);
 const sourcePos=String(player?.position||role).toUpperCase();
 const seed=((((Number(player?.id)||index+1)*37)%23)-11);
 const posBoost=sourcePos==="FW"?{pace:4,acceleration:4,shooting:5,passing:-2,dribbling:5,defending:-18,physical:-2}:sourcePos==="MF"?{pace:0,acceleration:1,shooting:-3,passing:5,dribbling:3,defending:3,physical:0}:sourcePos==="DF"?{pace:-2,acceleration:-1,shooting:-15,passing:1,dribbling:-5,defending:8,physical:5}:sourcePos==="GK"?{pace:-12,acceleration:-10,shooting:-30,passing:-5,dribbling:-20,defending:5,physical:2}:{pace:0,acceleration:0,shooting:0,passing:0,dribbling:0,defending:0,physical:0};
 const clampStat=v=>Math.max(45,Math.min(99,Math.round(v)));
 return {pace:clampStat(overall+posBoost.pace+seed*.22),acceleration:clampStat(overall+posBoost.acceleration+seed*.18),shooting:clampStat(overall+posBoost.shooting+seed*.16),passing:clampStat(overall+posBoost.passing+seed*.12),dribbling:clampStat(overall+posBoost.dribbling+seed*.20),defending:clampStat(overall+posBoost.defending-seed*.10),physical:clampStat(overall+posBoost.physical+seed*.10),stamina:clampStat(overall+(role==="MF"?5:role==="DF"?3:-2)+seed*.14),gkReflexes:clampStat(overall+(role==="GK"?9:0)+seed*.08)};
}

function makePlayer(team,index,role){
 const g=new THREE.Group();
 const shirtColor=team===HOME?0x2e72e5:0xd83c55,shortsColor=team===HOME?0x173c79:0x771827;
 const sockColor=0xf1f3f5,bootColor=0x11151a;
 const d=team===HOME?homePool[index%homePool.length]:PLAYER_POOL[(11+index)%PLAYER_POOL.length];
 const id=Number(d?.id)||index,skin=[0xb97858,0xc98b6b,0xd49a78,0xe0ad88,0x8f5b43,0x704735][id%6],hair=[0x14100d,0x2a1b12,0x3a2518,0x6a4328][id%4];
 const gameplay=gameplayAttributes(d,role,id);
 const roleHeight=role==="GK"?1.08:role==="DF"?1.03:role==="MF"?1.00:0.99;
 const roleFrame=role==="DF"?1.045:role==="GK"?1.02:role==="FW"?0.95:1;
 const stature=(0.94+(id%9)*0.018)*roleHeight;
 const frame=clamp((0.96+(gameplay.physical-72)*0.0032-(gameplay.pace-72)*0.0008)*roleFrame,0.89,1.08);
 const shoulder=frame*(role==="GK"?1.06:role==="DF"?1.01:1);
 const headScale=(0.94+(id%5)*0.025)*(role==="GK"?0.98:1);
 const part=(geo,material,parent,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);parent.add(m);return m};
 const limb=(parent,x,y,material,len,rad)=>{const j=new THREE.Group();j.position.set(x,y,0);parent.add(j);part(new THREE.CapsuleGeometry(rad,len,5,8),material,j,0,-(len*.5+rad),0);return j};
 const hips=new THREE.Group();hips.position.y=.94;g.add(hips);

 // Athletic human proportions: tapered torso, compact head, true joint pivots, covered lower legs.
 part(new THREE.CylinderGeometry(.30*frame,.33*frame,.24,10),mat(shortsColor,.68),hips,0,.04,0);
 const torso=part(new THREE.CylinderGeometry(.34*shoulder,.285*frame,.70,12),mat(shirtColor,.56),hips,0,.43,0);
 torso.scale.z=.76;
 part(new THREE.TorusGeometry(.145*frame,.022,6,12),mat(shirtColor,.60),hips,0,.78,0);
 part(new THREE.CylinderGeometry(.11,.13,.16,10),mat(skin,.82),hips,0,.88,0);

 const face=part(new THREE.SphereGeometry(.255,16,12),mat(skin,.78),hips,0,1.10,0);
 face.scale.set(headScale,1.04,.94);
 part(new THREE.CapsuleGeometry(.045,.07,4,7),mat(skin,.80),hips,0,1.10,.245);
 for(const sx of [-1,1])part(new THREE.SphereGeometry(.055,8,6),mat(skin,.80),hips,sx*.245,1.10,0);
 const hairTop=part(new THREE.SphereGeometry(.272,16,10,0,Math.PI*2,0,Math.PI*.55),mat(hair,.94),hips,0,1.24,0);
 hairTop.scale.set(1.03,.92,.99);
 const eyeMat=new THREE.MeshBasicMaterial({color:0x181818});
 for(const sx of [-.075,.075])part(new THREE.SphereGeometry(.018,8,6),eyeMat,hips,sx,1.105,.237);

 const armMat=mat(shirtColor,.60),foreMat=mat(skin,.82),upperArmTotal=.43,forearmTotal=.34;
 const leftArm=limb(hips,-.36*shoulder,.66,armMat,.25,.09),rightArm=limb(hips,.36*shoulder,.66,armMat,.25,.09);
 const leftFore=limb(leftArm,0,-upperArmTotal,foreMat,.18,.075),rightFore=limb(rightArm,0,-upperArmTotal,foreMat,.18,.075);
 part(new THREE.SphereGeometry(.073,8,6),foreMat,leftFore,0,-forearmTotal,0);
 part(new THREE.SphereGeometry(.073,8,6),foreMat,rightFore,0,-forearmTotal,0);

 const thighTotal=.47,calfTotal=.46;
 const leftThigh=limb(hips,-.13*frame,-.01,mat(shortsColor,.66),.21,.13),rightThigh=limb(hips,.13*frame,-.01,mat(shortsColor,.66),.21,.13);
 const leftCalf=limb(leftThigh,0,-thighTotal,mat(sockColor,.62),.26,.10),rightCalf=limb(rightThigh,0,-thighTotal,mat(sockColor,.62),.26,.10);
 const sockAccent=mat(shirtColor,.62);
 part(new THREE.TorusGeometry(.101,.014,5,12),sockAccent,leftCalf,0,-.09,0);
 part(new THREE.TorusGeometry(.101,.014,5,12),sockAccent,rightCalf,0,-.09,0);
 const leftFoot=part(new THREE.BoxGeometry(.19,.11,.37),mat(bootColor,.34),leftCalf,0,-calfTotal+.035,.075);
 const rightFoot=part(new THREE.BoxGeometry(.19,.11,.37),mat(bootColor,.34),rightCalf,0,-calfTotal+.035,.075);
 leftFoot.scale.x=.96;rightFoot.scale.x=.96;

 const num=document.createElement("canvas");num.width=num.height=128;
 const ctx=num.getContext("2d");ctx.clearRect(0,0,128,128);ctx.fillStyle="#fff";ctx.font="900 68px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(String(d?.number||index+1),64,64);
 const tex=new THREE.CanvasTexture(num);
 const nm=part(new THREE.PlaneGeometry(.34,.34),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}),g,0,1.38,-.49);nm.rotation.y=Math.PI;
 const shadow=new THREE.Mesh(
   new THREE.PlaneGeometry(1.42,.72),
   new THREE.MeshBasicMaterial({map:softShadowTexture(),transparent:true,depthWrite:false,opacity:.72})
 );
 shadow.rotation.x=-Math.PI/2;
 shadow.position.y=.012;
 g.add(shadow);

 const ring=new THREE.Mesh(new THREE.RingGeometry(.72,.82,32),new THREE.MeshBasicMaterial({color:team===HOME?0x71b7ff:0xff7f91,transparent:true,opacity:.22,side:THREE.DoubleSide}));
 ring.rotation.x=-Math.PI/2;ring.position.y=.04;g.add(ring);

 const selectorArrow=new THREE.Mesh(new THREE.ConeGeometry(.085,.19,4),new THREE.MeshBasicMaterial({color:0xaef6d2}));
 selectorArrow.rotation.x=Math.PI;
 selectorArrow.position.y=2.02;
 selectorArrow.visible=false;
 g.add(selectorArrow);

 const rootScale=.90+(id%6)*.018;
 g.scale.set(frame*rootScale,stature*rootScale,frame*rootScale);
 g.userData={team,index,role,number:d?.number||index+1,bodyScale:rootScale,heightScale:stature,animationPhase:(id*.73)%6.28,player:d,name:d?.name||("PLAYER "+(index+1)),overall:d?.overall||70,position:d?.position||role,
   speed:role==="GK"?3.8+gameplay.pace*.025:4.2+gameplay.pace*.025,acceleration:7.5+gameplay.acceleration*.075,pace:gameplay.pace,shooting:gameplay.shooting,passing:gameplay.passing,dribbling:gameplay.dribbling,defending:gameplay.defending,physical:gameplay.physical,staminaRating:gameplay.stamina,gkReflexes:gameplay.gkReflexes,currentSpeed:0,stamina:100,homeX:0,homeZ:0,aiSeed:(id*1.17)%10,aiNextDecisionAt:0,selectedRing:ring,selectorArrow,moving:false,sprint:false,action:"idle",actionUntil:0,
   rig:{hips,torso,leftArm,rightArm,leftFore,rightFore,leftThigh,rightThigh,leftCalf,rightCalf,leftFoot,rightFoot}};
 return g;
}
const FORMATION = [
  ["GK", -49, 0],
  ["DF", -38, -24], ["DF", -39, -8], ["DF", -39, 8], ["DF", -38, 24],
  ["MF", -20, -20], ["MF", -14, -6], ["MF", -14, 6], ["MF", -20, 20],
  ["FW", 0, -12], ["FW", 3, 12]
];

function placeTeams() {
  home = [];
  away = [];
  players = [];

  for (let i = 0; i < FORMATION.length; i++) {
    const [role, x, z] = FORMATION[i];
    const p = makePlayer(HOME, i, role);
    p.userData.homeX = x;
    p.userData.homeZ = z;
    p.position.set(x, 0, z);
    scene.add(p);
    home.push(p);
    players.push(p);
  }

  for (let i = 0; i < FORMATION.length; i++) {
    const [role, x, z] = FORMATION[i];
    const p = makePlayer(AWAY, i, role);
    p.userData.homeX = -x;
    p.userData.homeZ = -z;
    p.position.set(-x, 0, -z);
    scene.add(p);
    away.push(p);
    players.push(p);
  }
}

function addLine(x1, z1, x2, z2, y = 0.055) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.035, len),
    new THREE.MeshBasicMaterial({ color: 0xf5f7f5 })
  );
  m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  m.rotation.y = Math.atan2(x2 - x1, z2 - z1);
  scene.add(m);
}

function buildPitch() {
  scene.background = new THREE.Color(0x08151f);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 220),
    new THREE.MeshBasicMaterial({ color: 0x07100d, side: THREE.DoubleSide })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.12;
  scene.add(ground);

  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD.w, FIELD.d),
    new THREE.MeshBasicMaterial({ color: 0x16723b, side: THREE.DoubleSide })
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = 0;
  scene.add(pitch);

  const stripeColors = [0x1a7b40, 0x156c38];
  for (let i = 0; i < 10; i++) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD.w, FIELD.d / 10 + 0.03),
      new THREE.MeshBasicMaterial({ color: stripeColors[i % 2], side: THREE.DoubleSide })
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0.008, -FIELD.d / 2 + (i + 0.5) * FIELD.d / 10);
    scene.add(stripe);
  }

  addLine(-52.5, -34, 52.5, -34);
  addLine(-52.5, 34, 52.5, 34);
  addLine(-52.5, -34, -52.5, 34);
  addLine(52.5, -34, 52.5, 34);
  addLine(0, -34, 0, 34);

  const circle = new THREE.Mesh(
    new THREE.RingGeometry(9.08, 9.2, 96),
    new THREE.MeshBasicMaterial({ color: 0xf5f7f5, side: THREE.DoubleSide })
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.06;
  scene.add(circle);

  const spot = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 24),
    new THREE.MeshBasicMaterial({ color: 0xf5f7f5 })
  );
  spot.rotation.x = -Math.PI / 2;
  spot.position.y = 0.061;
  scene.add(spot);

  for (const side of [-1, 1]) {
    const x = side * 52.5;
    addLine(x, -20, x - side * 16, -20);
    addLine(x, 20, x - side * 16, 20);
    addLine(x - side * 16, -20, x - side * 16, 20);
    addLine(x, -9, x - side * 5.5, -9);
    addLine(x, 9, x - side * 5.5, 9);
    addLine(x - side * 5.5, -9, x - side * 5.5, 9);
  }

  const goalMat = mat(0xf4f6f5, 0.5);
  for (const side of [-1, 1]) {
    const x = side * 52.65;
    for (const z of [-FIELD.goalW / 2, FIELD.goalW / 2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.6, 12), goalMat);
      post.position.set(x, 1.8, z);
      scene.add(post);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, FIELD.goalW), goalMat);
    bar.position.set(x, 3.6, 0);
    scene.add(bar);
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, FIELD.goalW), goalMat);
    base.position.set(x - side * 2, 0.06, 0);
    scene.add(base);
    const netMat=new THREE.MeshBasicMaterial({color:0xe9efed,transparent:true,opacity:.24,wireframe:true});
    const net=new THREE.Mesh(new THREE.BoxGeometry(3.8,3.15,FIELD.goalW-.2),netMat);
    net.position.set(x-side*1.9,1.65,0);
    scene.add(net);
  }

  const standMat=mat(0x151d28,0.92), crowdMat=mat(0xd8d0b8,1);
  for(const side of [-1,1]){for(let row=0;row<4;row++){const stand=new THREE.Mesh(new THREE.BoxGeometry(125,2.2,4.8),standMat);stand.position.set(0,1.2+row*1.8,side*(39+row*4.2));scene.add(stand);for(let k=0;k<24;k+=2){const c=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.75,0.9),mat((k+row)%4===0?0xd8d0b8:0x7d8a96,1));c.position.set(-49+k*4.1,2.7+row*1.8,side*(38+row*4.2));scene.add(c)}}const led=new THREE.Mesh(new THREE.BoxGeometry(106,0.55,0.35),new THREE.MeshBasicMaterial({color:0x263b4c}));led.position.set(0,0.65,side*35.2);scene.add(led)}
  for(const x of [-57,57])for(const z of [-39,39]){const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.3,18,8),standMat);pole.position.set(x,9,z);scene.add(pole);const lamp=new THREE.PointLight(0xffffff,8,75,2);lamp.position.set(x,18,z);scene.add(lamp)}
}

function buildBall() {
  const c=document.createElement("canvas");
  c.width=c.height=96;
  const x=c.getContext("2d");
  x.fillStyle="#f5f6f4";
  x.fillRect(0,0,96,96);
  x.fillStyle="#c8cdca";
  for(let iy=0;iy<6;iy++)for(let ix=0;ix<6;ix++){x.beginPath();x.arc(ix*17+5,iy*17+7,2.5,0,Math.PI*2);x.fill();}
  x.fillStyle="#15191b";
  const poly=(cx,cy,r,rot=.0)=>{x.beginPath();for(let i=0;i<5;i++){const a=rot+i*Math.PI*2/5;const px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;i?x.lineTo(px,py):x.moveTo(px,py)}x.closePath();x.fill()};
  poly(48,46,10,.1);poly(16,18,5,.25);poly(78,19,5,.4);poly(20,76,5,.1);poly(76,76,5,.35);
  const ballTex=new THREE.CanvasTexture(c);
  ballTex.colorSpace=THREE.SRGBColorSpace;
  ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 20, 14),
    new THREE.MeshStandardMaterial({map:ballTex,color:0xffffff,roughness:.62,metalness:0})
  );
  ball.position.set(0, 0.48, 0);
  const ballShadow=new THREE.Mesh(
    new THREE.PlaneGeometry(.95,.95),
    new THREE.MeshBasicMaterial({map:softShadowTexture(),transparent:true,depthWrite:false,opacity:.58})
  );
  ballShadow.rotation.x=-Math.PI/2;
  ballShadow.position.y=.018;
  ballShadow.name="ballShadow";
  scene.add(ballShadow);
  ball.userData = { owner: null, vx: 0, vy: 0, vz: 0, lastTeam: HOME, lastKicker: null, lastKickerUntil: 0 };
  scene.add(ball);
}

function resetPositions(kickoffTeam = HOME) {
  for (const p of players) {
    p.position.set(p.userData.homeX, 0, p.userData.homeZ);
    p.userData.currentSpeed = 0;
    p.userData.stamina = 100;
  }
  ball.position.set(0, 0.48, 0);
  ball.userData.vx = ball.userData.vy = ball.userData.vz = 0;
  ball.userData.owner = kickoffTeam === HOME ? home[9] : away[9];
  selectPlayer(kickoffTeam === HOME ? 9 : 9);
}

function selectPlayer(index) {
  state.selected = clamp(index, 0, home.length - 1);
  for (const p of home) {
    p.userData.selectedRing.visible = false;
    if(p.userData.selectorArrow)p.userData.selectorArrow.visible=false;
  }
  const p = home[state.selected];
  if (!p) return;
  p.userData.selectedRing.visible = true;
  if(p.userData.selectorArrow)p.userData.selectorArrow.visible = true;
  playerLabel.textContent = p.userData.name + " • " + p.userData.overall;
  playerNo.textContent = "#" + p.userData.number;
  playerRole.textContent = p.userData.role;
}

function initBallPossession() {
  ball.userData.owner = home[9];
  ball.position.set(home[9].position.x, 0.48, home[9].position.z + 0.8);
}

function moveControlled(dt) {
  const p=home[state.selected];
  if(!p)return;
  const u=p.userData;
  const now=performance.now();
  const owner=ball.userData.owner;
  const defending=owner?.userData?.team===AWAY;
  const mag=Math.hypot(state.joy.x,state.joy.y);

  if(mag<0.04){
    u.moving=false;
    u.currentSpeed=Math.max(0,u.currentSpeed-u.acceleration*dt*1.25);
    u.sprint=!defending&&state.rightHeld;
    if(state.pressUntil>now&&defending&&owner){
      const dx=owner.position.x-p.position.x,dz=owner.position.z-p.position.z,len=Math.hypot(dx,dz)||1;
      p.position.x=clamp(p.position.x+dx/len*u.speed*0.72*dt,-51,51);
      p.position.z=clamp(p.position.z+dz/len*u.speed*0.72*dt,-32.5,32.5);
      p.rotation.y=Math.atan2(dx,dz);
      u.moving=true;
    }
    if(state.shieldUntil>now&&owner===p){
      const opp=away.slice().sort((a,b)=>dist(a,p)-dist(b,p))[0];
      if(opp)p.rotation.y=Math.atan2(opp.position.x-p.position.x,opp.position.z-p.position.z);
    }
    if(owner===p){
      const touch=Math.sin(now*0.014)*0.045;
      const carry=state.shieldUntil>now?0.64:state.rightHeld?0.88:0.74;
      ball.position.set(p.position.x+Math.sin(p.rotation.y)*(carry+touch),0.38+Math.abs(Math.sin(now*0.014))*0.03,p.position.z+Math.cos(p.rotation.y)*(carry+touch));
    }
    return;
  }

  const nx=state.joy.x/mag;
  const nz=state.joy.y/mag;
  const intensity=clamp(mag,0,1);
  const dash=!defending&&state.rightHeld;
  const shield=owner===p&&state.shieldUntil>now;
  const targetSpeed=p.userData.speed*intensity*(dash?1.36:shield?0.58:1);
  const response=clamp(p.userData.acceleration*dt,0,1);
  p.userData.currentSpeed+=((targetSpeed-p.userData.currentSpeed)*response);
  const speed=p.userData.currentSpeed;

  p.position.x=clamp(p.position.x+nx*speed*dt,-51,51);
  p.position.z=clamp(p.position.z+nz*speed*dt,-32.5,32.5);
  u.moving=true;
  u.sprint=dash;

  if(defending&&state.matchUp&&owner){
    p.rotation.y=Math.atan2(owner.position.x-p.position.x,owner.position.z-p.position.z);
    const gap=dist(p,owner);
    if(gap<1.7&&now>state.lastDefensiveContactAt){
      const defend=Number(u.defending)||70;
      const physical=Number(u.physical)||70;
      const dribble=Number(owner.userData.dribbling)||70;
      const chance=clamp(0.18+(defend-dribble)*0.004+(physical-70)*0.0025,0.08,0.52);
      state.lastDefensiveContactAt=now+650;
      if(Math.random()<chance){
        const dx=owner.position.x-p.position.x,dz=owner.position.z-p.position.z,len=Math.hypot(dx,dz)||1;
        ball.userData.owner=null;
        ball.userData.lastTeam=HOME;
        ball.userData.lastKicker=p;
        ball.userData.lastKickerUntil=now+260;
        ball.position.set(owner.position.x+dx/len*0.6,0.52,owner.position.z+dz/len*0.6);
        ball.userData.vx=dx/len*3.8;
        ball.userData.vz=dz/len*3.8;
        ball.userData.vy=0.9;
        setAction(p,"tackle",420);
        showMessage("PRESSURE WIN",430);
        return;
      }
    }
  }else{
    p.rotation.y=Math.atan2(nx,nz);
  }

  if(shield){
    const opp=away.slice().sort((a,b)=>dist(a,p)-dist(b,p))[0];
    if(opp)p.rotation.y=Math.atan2(opp.position.x-p.position.x,opp.position.z-p.position.z);
  }

  const staminaFactor=clamp(100/(u.staminaRating||70),0.72,1.35);
  u.stamina=clamp(u.stamina-(dash?5.0:shield?1.6:1.0)*staminaFactor*dt,0,100);

  if(owner===p){
    const touch=Math.sin(now*0.014)*0.045;
    const carry=shield?0.64:(dash?0.88:0.74);
    ball.position.set(
      p.position.x+Math.sin(p.rotation.y)*(carry+touch),
      0.38+Math.abs(Math.sin(now*0.014))*0.03,
      p.position.z+Math.cos(p.rotation.y)*(carry+touch)
    );
  }
}

function quickStopFaceGoal(){
  const p=home[state.selected];
  if(!p||ball.userData.owner!==p)return;
  p.userData.moving=false;
  state.sprint=false;
  p.rotation.y=0;
  state.leftTapAt=0;
  setAction(p,"quickStop",420);
  showMessage("QUICK STOP",360);
}

function activateShield(){
  const p=home[state.selected];
  if(!p||ball.userData.owner!==p)return;
  const opp=away.slice().sort((a,b)=>dist(a,p)-dist(b,p))[0];
  if(!opp||dist(p,opp)>4.4)return;
  state.shieldUntil=performance.now()+900;
  p.rotation.y=Math.atan2(opp.position.x-p.position.x,opp.position.z-p.position.z);
  setAction(p,"shield",620);
  state.leftTapAt=0;
  showMessage("SHIELD",360);
}

function triggerSharpTouch(dx,dz){
  const p=home[state.selected];
  if(!p||ball.userData.owner!==p||state.sharpTouchTriggered)return;
  const mag=Math.hypot(dx,dz);
  if(mag<42)return;
  const nx=dx/mag,nz=dz/mag;
  state.sharpTouchTriggered=true;
  p.position.x=clamp(p.position.x+nx*2.7,-50.5,50.5);
  p.position.z=clamp(p.position.z+nz*2.7,-31.5,31.5);
  p.userData.stamina=clamp(p.userData.stamina-1.6,0,100);
  state.lastSharpTouchAt=performance.now();
  setAction(p,"sharpTouch",380);
  showMessage("SHARP TOUCH",420);
}

function improvePlayerIdentity(p){
  const d=p.userData.player||{}; const id=Number(d.id)||p.userData.index||0;
  const hue=[0x111111,0x3b2418,0x6b4b2a,0x9b7653,0x201c35,0x5a1720][id%6];
  p.userData.identity={id,name:d.name||p.userData.name,number:p.userData.number||p.userData.number,skin:id%6,hair:hue};
  // Individual silhouette: height, shoulder width, head scale and limb length are deterministic per player.
  const hs=0.93+(id%11)*0.018, ws=0.92+(id%7)*0.025;
  p.scale.y*=hs; p.scale.x*=ws; p.scale.z*=ws;
  const r=p.userData.rig; if(r?.torso) r.torso.scale.x*=ws;
}

function autoSelectDefender(){
  const owner=ball.userData.owner;
  if(!owner||owner.userData.team!==AWAY||!home.length)return;
  const current=home[state.selected];
  if(!current||current.userData.role==="GK")return;
  const candidates=home.filter(p=>p.userData.role!=="GK");
  if(!candidates.length)return;
  const score=p=>{
    const d=dist(p,owner);
    const goalSide=Math.abs(p.position.x+49);
    const intercept=dist(p,ball);
    return d*1.0+intercept*.35+(goalSide<0?0:0);
  };
  let best=candidates[0];
  let bestScore=score(best);
  for(const p of candidates.slice(1)){
    const s=score(p);
    if(s<bestScore){best=p;bestScore=s;}
  }
  const curScore=score(current);
  if(best!==current && bestScore+1.35<curScore){
    selectPlayer(best.userData.index);
    showMessage("SWITCH",260);
  }
}
function teamAI(dt){
  const ballX=ball.position.x, ballZ=ball.position.z, owner=ball.userData.owner;
  const now=performance.now();

  // AI pressure: defenders can contest the carrier without teleporting the ball.
  if(owner){
    const defenders=owner.userData.team===HOME?away:home;
    const carrierStats=owner.userData;
    for(const d of defenders){
      if(d===home[state.selected])continue;
      if(d.userData.role==="GK")continue;
      const gap=dist(d,owner);
      if(gap>1.55)continue;
      if(now<(d.userData.contactCooldown||0))continue;
      const defend=Number(d.userData.defending)||70;
      const physical=Number(d.userData.physical)||70;
      const dribble=Number(carrierStats.dribbling)||70;
      const chance=clamp(0.12+(defend-dribble)*0.004+(physical-70)*0.0025,0.05,0.42);
      d.userData.contactCooldown=now+650;
      if(Math.random()<chance){
        const sideX=(d.position.x-owner.position.x),sideZ=(d.position.z-owner.position.z),len=Math.hypot(sideX,sideZ)||1;
        ball.userData.owner=null;
        ball.userData.lastTeam=d.userData.team;
        ball.userData.lastKicker=d;
        ball.userData.lastKickerUntil=now+260;
        ball.position.set(owner.position.x+sideX/len*0.55,0.52,owner.position.z+sideZ/len*0.55);
        ball.userData.vx=sideX/len*3.2;
        ball.userData.vz=sideZ/len*3.2;
        ball.userData.vy=0.85;
        setAction(d,"tackle",420);
        showMessage(d.userData.team===HOME?"AI TACKLE":"BALL LOST",320);
        break;
      }
    }
  }

  for(const team of [home,away]){
    const attack=team===home?1:-1;
    const controlled=team===home?home[state.selected]:null;

    for(const p of team){
      const role=p.userData.role;
      const homeX=p.userData.homeX;
      const homeZ=p.userData.homeZ;
      const isOwner=p===owner;
      if(p===controlled) continue;

      let tx=homeX,tz=homeZ;
      const attacking=owner&&owner.userData.team===p.userData.team;
      const pressTarget=p.userData.pressTarget;
      const teammatePressing=(p.userData.pressUntil||0)>now&&pressTarget?.userData?.team===AWAY;

      if(role==='GK'){
        tx=attack*49;
        tz=clamp(ballZ,-9,9);
      }else if(attacking){
        const advance=clamp((ballX*attack)*0.16,-8,14);
        tx=homeX+advance;
        tz=homeZ+clamp((ballZ-homeZ)*0.24,-8,8);
        if(isOwner){
          tx=p.position.x+attack*4;
          tz=p.position.z+clamp((ballZ-p.position.z)*0.18,-4,4);
        }
      }else{
        const danger=clamp(16-Math.abs(ballX-p.position.x),0,16);
        tx=homeX+clamp((ballX*attack)*0.10,-9,9);
        tz=homeZ+clamp((ballZ-homeZ)*0.25,-9,9);
        if(danger>7&&(role==='DF'||role==='MF')){
          tx=lerp(tx,ballX,0.16);
          tz=lerp(tz,ballZ,0.14);
        }
      }

      if(teammatePressing){
        const dx=pressTarget.position.x-p.position.x,dz=pressTarget.position.z-p.position.z,len=Math.hypot(dx,dz)||1;
        tx=pressTarget.position.x-dx/len*2.4;
        tz=pressTarget.position.z-dz/len*2.4;
      }

      const dx=tx-p.position.x,dz=tz-p.position.z,len=Math.hypot(dx,dz);
      if(len>0.25){
        const intensity=clamp(len/4,0.28,1.08);
        const desiredSpeed=p.userData.speed*intensity;
        const response=clamp((p.userData.acceleration||7)*dt,0,1);
        p.userData.currentSpeed=lerp(p.userData.currentSpeed||0,desiredSpeed,response);
        const staminaFactor=clamp(100/(p.userData.staminaRating||70),0.78,1.22);
        const drain=(p===owner?0.9:0.45)*staminaFactor*dt;
        p.userData.stamina=clamp((p.userData.stamina??100)-drain,0,100);
        p.position.x+=dx/len*p.userData.currentSpeed*dt;
        p.position.z+=dz/len*p.userData.currentSpeed*dt;
        p.rotation.y=Math.atan2(dx,dz);
        p.userData.moving=true;
        p.userData.sprint=p.userData.currentSpeed>p.userData.speed*.82;
      }else{
        p.userData.currentSpeed=Math.max(0,(p.userData.currentSpeed||0)-(p.userData.acceleration||7)*dt*1.1);
        p.userData.moving=false;
      }

      p.position.x=clamp(p.position.x,-51,51);
      p.position.z=clamp(p.position.z,-32.5,32.5);
      if(p!==owner&&!p.userData.moving)p.userData.sprint=false;
    }
  }

  resolvePlayerSeparation();

  // One decision clock prevents per-frame actions and keeps the opponent readable.
  if(owner&&owner.userData.team===AWAY&&owner.userData.role!=='GK'&&now>=owner.userData.aiNextDecisionAt){
    const goalDistance=owner.position.x+52.5;
    const nearestHome=home.slice().sort((a,b)=>dist(a,owner)-dist(b,owner))[0];
    const pressure=nearestHome?dist(nearestHome,owner):99;
    const candidates=away
      .filter(p=>p!==owner&&p.userData.role!=='GK')
      .sort((a,b)=>{
        const av=(owner.position.x-a.position.x)*0.75-Math.abs(owner.position.z-a.position.z)*0.12;
        const bv=(owner.position.x-b.position.x)*0.75-Math.abs(owner.position.z-b.position.z)*0.12;
        return bv-av;
      });
    const target=candidates[0];

    let acted=false;
    if(goalDistance<18&&Math.abs(owner.position.z)<11&&pressure>3.0&&Math.random()<0.42){
      kick(owner,-53,clamp(owner.position.z*0.45,-8,8),14.5,"shoot");
      acted=true;
    }
    if(!acted&&target&&Math.random()<0.48){
      kick(owner,target.position.x,target.position.z,9.2,"pass");
      acted=true;
    }
    owner.userData.aiNextDecisionAt=now+(acted?900:420);
  }
}

function resolvePlayerSeparation(){
  const minDist=.74;
  for(let i=0;i<players.length;i++){
    const a=players[i];
    for(let j=i+1;j<players.length;j++){
      const b=players[j];
      const dx=b.position.x-a.position.x,dz=b.position.z-a.position.z;
      const d=Math.hypot(dx,dz);
      if(d<=.001||d>=minDist)continue;
      const nx=dx/d,nz=dz/d,push=(minDist-d)*.38;
      const aMov=a!==ball.userData.owner,bMov=b!==ball.userData.owner;
      const wa=aMov&&bMov ? .5 : (aMov||bMov ? 1 : 0);
      if(aMov){a.position.x-=nx*push*wa;a.position.z-=nz*push*wa}
      if(bMov){b.position.x+=nx*push*wa;b.position.z+=nz*push*wa}
      a.position.x=clamp(a.position.x,-51,51);a.position.z=clamp(a.position.z,-32.5,32.5);
      b.position.x=clamp(b.position.x,-51,51);b.position.z=clamp(b.position.z,-32.5,32.5);
    }
  }
}
function setAction(player,type,duration=520){if(!player?.userData)return;player.userData.action=type;player.userData.actionUntil=performance.now()+duration;}
function kick(player, tx, tz, speed, actionType="pass") {
  const dx=tx-ball.position.x,dz=tz-ball.position.z,len=Math.hypot(dx,dz)||1;
  const skill=actionType==="shoot"?(player.userData.shooting||70):(player.userData.passing||70);
  const skillFactor=0.84+clamp(skill,45,99)*0.0018;
  speed*=skillFactor;
  setAction(player,actionType,actionType==="shoot"?620:430);
  ball.userData.owner=null;
  ball.userData.lastTeam=player.userData.team;
  ball.userData.lastKicker=player;
  ball.userData.lastKickerUntil=performance.now()+340;
  ball.userData.vx=dx/len*speed;
  ball.userData.vz=dz/len*speed;
  ball.userData.vy=actionType==="shoot"?Math.min(7.0,1.8+speed*0.16):Math.min(4.0,1.1+speed*0.12);
}

function tackleControlled(){
  const tackler=home[state.selected];
  if(!tackler||tackler.userData.role==="GK") return;
  setAction(tackler,"tackle",520);

  const owner=ball.userData.owner;
  if(owner&&owner.userData.team===HOME){
    showMessage("NO BALL",350);
    return;
  }

  const forwardX=Math.sin(tackler.rotation.y);
  const forwardZ=Math.cos(tackler.rotation.y);
  const candidates=away.filter(p=>{
    const d=dist(tackler,p);
    if(d>2.65)return false;
    const dx=p.position.x-tackler.position.x,dz=p.position.z-tackler.position.z;
    const len=Math.hypot(dx,dz)||1;
    return (forwardX*dx+forwardZ*dz)/len>0.15;
  }).sort((a,b)=>dist(tackler,a)-dist(tackler,b));
  const target=candidates[0];

  if(target&&owner===target){
    const id=Number(tackler.userData.player?.id)||tackler.userData.index||0;
    const atk=Number(tackler.userData.defending)||Number(tackler.userData.overall)||70;
    const physical=Number(tackler.userData.physical)||70;
    const oppDef=Number(target.userData.physical)||Number(target.userData.overall)||70;
    const success=clamp(0.48+(atk-oppDef)*0.0045+(physical-70)*0.0035,0.25,0.84);
    if(Math.random()<success){
      const tx=tackler.position.x+forwardX*0.85,tz=tackler.position.z+forwardZ*0.85;
      ball.userData.owner=tackler;
      ball.position.set(tx,0.48,tz);
      ball.userData.vx=ball.userData.vy=ball.userData.vz=0;
      ball.userData.lastTeam=HOME;
      ball.userData.lastKicker=null;
      ball.userData.lastKickerUntil=0;
      showMessage("TACKLE WIN",500);
    }else{
      const dx=ball.position.x-tackler.position.x,dz=ball.position.z-tackler.position.z,len=Math.hypot(dx,dz)||1;
      ball.userData.owner=null;
      ball.userData.lastTeam=AWAY;
      ball.userData.lastKicker=target;
      ball.userData.lastKickerUntil=performance.now()+260;
      ball.userData.vx=dx/len*4.5;
      ball.userData.vz=dz/len*4.5;
      ball.userData.vy=1.0;
      showMessage("TACKLE",400);
    }
    return;
  }

  if(!owner&&dist(tackler,ball)<2.6&&ball.position.y<1.5){
    ball.userData.owner=tackler;
    ball.userData.vx=ball.userData.vy=ball.userData.vz=0;
    ball.userData.lastKicker=null;
    ball.userData.lastKickerUntil=0;
    showMessage("BALL WON",450);
  }else{
    showMessage("TACKLE",350);
  }
}

function passOrShoot(mode, power = 0.8, aim = null, stunning = false) {
  const p = home[state.selected];
  if (!p) return;

  if (ball.userData.owner !== p) {
    if (dist(p, ball) < 2.1 && performance.now() >= (ball.userData.lastKickerUntil||0)) {
      ball.userData.owner = p;
      ball.userData.vx = ball.userData.vy = ball.userData.vz = 0;
      return;
    }
    return;
  }

  const dir = aim ? new THREE.Vector3(aim.x,0,aim.z).normalize() : new THREE.Vector3(
    Math.sin(p.rotation.y),0,Math.cos(p.rotation.y)
  );
  let target;

  if(mode==="shoot"){
    setAction(p,"shoot",stunning?720:620);
    target=new THREE.Vector3(53,1.5,clamp(p.position.z+dir.z*18,-9.2,9.2));
  }else if(mode==="through"){
    setAction(p,stunning?"stunningThrough":"through",stunning?560:480);
    target=new THREE.Vector3(
      clamp(p.position.x+dir.x*25,-48,50),
      0.8,
      clamp(p.position.z+dir.z*25,-30,30)
    );
  }else{
    setAction(p,stunning?"stunningPass":"pass",stunning?620:430);
    const candidates=home
      .filter(x=>x!==p&&x.userData.role!=="GK")
      .map(x=>{
        const vx=x.position.x-p.position.x,vz=x.position.z-p.position.z,len=Math.hypot(vx,vz)||1;
        const align=(vx*dir.x+vz*dir.z)/len;
        const forward=x.position.x-p.position.x;
        return {p:x,score:align*7+forward*0.18-Math.abs(vz)*0.02};
      })
      .sort((a,b)=>b.score-a.score);
    target=candidates[0]?.p?.position?.clone()||p.position.clone().add(dir.multiplyScalar(10));
  }

  const rawSkill=mode==="shoot"?(p.userData.shooting||70):(p.userData.passing||70);
  const error=(100-clamp(rawSkill,45,99))*.018*clamp(power,.45,1.2);
  if(error>0.02){
    target.x+=((Math.random()*2)-1)*error;
    target.z+=((Math.random()*2)-1)*error;
  }
  const dx=target.x-ball.position.x,dz=target.z-ball.position.z,len=Math.hypot(dx,dz)||1;
  const base=mode==="shoot"?18:mode==="through"?13.5:10;
  const skill=mode==="shoot"?(p.userData.shooting||70):(p.userData.passing||70);
   const skillFactor=0.82+clamp(skill,45,99)*0.0020;
   const speed=base*clamp(power,0.35,1.2)*skillFactor*(stunning?1.12:1);

  ball.userData.owner=null;
  ball.userData.lastTeam=HOME;
  ball.userData.lastKicker=p;
  ball.userData.lastKickerUntil=performance.now()+360;
  ball.userData.vx=dx/len*speed;
  ball.userData.vz=dz/len*speed;
  ball.userData.vy=mode==="shoot"?Math.min(7.2,1.8+power*2.2):mode==="through"?0.65+power*1.0:0.65+power*1.25;
  navigator.vibrate?.(mode==="shoot"?[18,24,18]:stunning?16:10);
  showMessage(stunning?(mode==="shoot"?"STUNNING SHOT":"STUNNING PASS"):mode==="shoot"?"SHOOT":mode==="through"?"THROUGH":"PASS",460);
}

function touchBall() {
  if (ball.userData.owner) {
    const p = ball.userData.owner;
    const speed=Math.max(0,p.userData?.currentSpeed||0);
    ball.position.set(
      p.position.x + Math.sin(p.rotation.y) * 0.78,
      0.48,
      p.position.z + Math.cos(p.rotation.y) * 0.78
    );
    ball.userData.vx = ball.userData.vy = ball.userData.vz = 0;
    if(speed>0.08){
      ball.rotation.z += speed*0.035;
      ball.rotation.x += speed*0.020;
    }
    const bs=scene.getObjectByName("ballShadow");
    if(bs){bs.position.x=ball.position.x;bs.position.z=ball.position.z;bs.scale.setScalar(.92)}
    return;
  }

  const speed=Math.hypot(ball.userData.vx,ball.userData.vz);
  const controlRadius=speed<4.5?1.65:1.22;
  const now=performance.now();
  let closest = null;
  let closestD = Infinity;
  for (const p of players) {
    const d = dist(p, ball);
    if (p===ball.userData.lastKicker && now < (ball.userData.lastKickerUntil||0) && d < 2.25) continue;
    if (d < controlRadius && d < closestD && ball.position.y < 1.35) {
      closest = p;
      closestD = d;
    }
  }
  if (closest) {
    ball.userData.owner = closest;
    ball.userData.vx = ball.userData.vy = ball.userData.vz = 0;
    if (closest.userData.team === HOME) selectPlayer(closest.userData.index);
  }
}

function showGoalFX(team, scorer){const fx=$("#goalFx");if(!fx)return;$("#goalFxText").textContent=team===HOME?"GOAL":"GOAL";$("#goalFxPlayer").textContent=scorer?.userData?.name||"MATCH GOAL";fx.classList.remove("show");void fx.offsetWidth;fx.classList.add("show");setTimeout(()=>fx.classList.remove("show"),1400)}

function goalkeeperAI(dt){
  const now=performance.now();
  for(const team of [home,away]){
    const gk=team.find(p=>p.userData.role==="GK");
    if(!gk)continue;
    const goalX=team===HOME?-49:49;
    const attackDir=team===HOME?1:-1;
    let targetZ=clamp(ball.position.z,-9,9);

    if(!ball.userData.owner&&Math.abs(ball.userData.vx)>3.5&&Math.sign(ball.userData.vx)!==attackDir){
      const timeToGoal=(goalX-ball.position.x)/ball.userData.vx;
      if(timeToGoal>0&&timeToGoal<1.7){
        targetZ=clamp(ball.position.z+ball.userData.vz*timeToGoal,-8.8,8.8);
        gk.userData.gkThreatUntil=now+500;
      }
    }else if(ball.userData.owner&&ball.userData.owner.userData.team!==team){
      const attacker=ball.userData.owner;
      if(Math.abs(goalX-attacker.position.x)<18){
        targetZ=clamp(attacker.position.z,-8.5,8.5);
        gk.userData.gkThreatUntil=now+500;
      }
    }

    const threatened=(gk.userData.gkThreatUntil||0)>now;
    if(threatened){
      const dx=goalX-gk.position.x;
      gk.position.x=lerp(gk.position.x,goalX+attackDir*1.8,clamp(dt*4.2,0,1));
      const dz=targetZ-gk.position.z;
      gk.position.z+=clamp(dz,-4.8*dt,4.8*dt);
      gk.userData.moving=Math.abs(dz)>0.12;
      if(!ball.userData.owner&&Math.abs(ball.position.x-goalX)<3.2&&Math.abs(ball.position.z-gk.position.z)<2.6&&ball.position.y<3.1){
        const quality=0.38+((Number(gk.userData.gkReflexes||gk.userData.overall)||70)-70)*0.007;
        if(Math.random()<clamp(quality,0.38,0.72)){
          const awayFromGoal=team===HOME?1:-1;
          ball.userData.owner=null;
          ball.userData.lastKicker=gk;
          ball.userData.lastKickerUntil=now+240;
          ball.userData.vx=awayFromGoal*(7+Math.random()*3);
          ball.userData.vz=(ball.position.z-gk.position.z)*1.8;
          ball.userData.vy=2.4;
          setAction(gk,"save",700);
          showMessage("SAVE",700);
        }
      }
    }else{
      gk.position.x=lerp(gk.position.x,goalX,clamp(dt*1.5,0,1));
      gk.position.z=lerp(gk.position.z,clamp(ball.position.z,-8,8),clamp(dt*1.2,0,1));
      gk.userData.moving=Math.abs(ball.position.z-gk.position.z)>0.2;
    }
    gk.position.x=clamp(gk.position.x,team===HOME?-51:-51,team===HOME?51:51);
    gk.position.z=clamp(gk.position.z,-9,9);
  }
}

function physics(dt) {
  if (ball.userData.owner) return;

  ball.userData.vy -= 18 * dt;
  const horizontalSpeed=Math.hypot(ball.userData.vx,ball.userData.vz);
  ball.position.x += ball.userData.vx * dt;
  ball.position.z += ball.userData.vz * dt;
  ball.position.y += ball.userData.vy * dt;
  if(horizontalSpeed>0.05){
    ball.rotation.z += ball.userData.vx*dt*1.8;
    ball.rotation.x += ball.userData.vz*dt*1.8;
  }
  const bs=scene.getObjectByName("ballShadow");
  if(bs){
    bs.position.x=ball.position.x;
    bs.position.z=ball.position.z;
    bs.scale.setScalar(clamp(1.02-ball.position.y*.10,.56,1.02));
    bs.material.opacity=clamp(.64-ball.position.y*.08,.22,.64);
  }

  const drag = Math.pow(0.985, dt * 60);
  ball.userData.vx *= drag;
  ball.userData.vz *= drag;

  if (ball.position.y < 0.43) {
    ball.position.y = 0.43;
    if (Math.abs(ball.userData.vy) > 0.8) ball.userData.vy *= -0.38;
    else ball.userData.vy = 0;
    ball.userData.vx *= 0.93;
    ball.userData.vz *= 0.93;
  }

  if (Math.abs(ball.position.z) > 34) {
    ball.position.z = clamp(ball.position.z, -34, 34);
    ball.userData.vz *= -0.7;
  }

  if (ball.position.x > 54 || ball.position.x < -54) {
    const goal = Math.abs(ball.position.z) <= FIELD.goalW / 2;
    if (goal) {
      const now = performance.now();
      if (now - state.lastGoalAt > 1200) {
        const scoringTeam = ball.position.x > 0 ? HOME : AWAY;
        state.score[scoringTeam]++;
        state.lastGoalAt = now;
        const scorer = scoringTeam === HOME ? home[state.selected] : away.slice().sort((a,b)=>dist(a,ball)-dist(b,ball))[0];
        updateScore();
        showGoalFX(scoringTeam, scorer);
        showMessage("GOAL", 1300);
        window.dispatchEvent(new Event("football:goal"));
        resetPositions(ball.position.x > 0 ? AWAY : HOME);
      }
    } else {
      ball.position.x = clamp(ball.position.x, -54, 54);
      ball.userData.vx *= -0.7;
    }
  }
}

function updateScore() {
  scoreEl.textContent = state.score[HOME] + " - " + state.score[AWAY];
}

function updateRadar() {
  const radar = document.querySelector("#radar");
  if (!radar) return;
  if (!radar.childElementCount) {
    const h = document.createElement("div"); h.className="radarLine"; h.style.cssText="left:50%;top:0;width:1px;height:100%;transform:translateX(-50%)";
    const v = document.createElement("div"); v.className="radarLine"; v.style.cssText="left:0;top:50%;width:100%;height:1px;transform:translateY(-50%)";
    radar.append(h,v);
    players.forEach((p,i)=>{const d=document.createElement("span");d.className="radarDot "+(p.userData.team===HOME?"home":"away");d.dataset.i=String(i);radar.append(d)});
    const bd=document.createElement("span");bd.className="radarDot ball";bd.id="radarBall";radar.append(bd);
  }
  players.forEach((p,i)=>{
    const d=radar.querySelector('[data-i="'+i+'"]'); if(!d) return;
    d.style.left=((p.position.x+52.5)/105*100).toFixed(1)+"%";
    d.style.top=((p.position.z+34)/68*100).toFixed(1)+"%";
    d.style.opacity=p.visible?"1":"0";
  });
  const bd=document.querySelector("#radarBall");
  if(bd){bd.style.left=((ball.position.x+52.5)/105*100).toFixed(1)+"%";bd.style.top=((ball.position.z+34)/68*100).toFixed(1)+"%"}
  const enemy=away.slice().sort((a,b)=>dist(a,ball)-dist(b,ball))[0];
  const on=document.querySelector("#opponentName"), oo=document.querySelector("#opponentNo");
  if(enemy){if(on)on.textContent=enemy.userData.name;if(oo)oo.textContent="#"+enemy.userData.number}
}

function updateHUD() {
  const total = Math.min(MATCH_DURATION, Math.max(0, Math.floor(state.time)));
  const min = String(Math.floor(total / 60)).padStart(2, "0");
  const sec = String(total % 60).padStart(2, "0");
  clockEl.textContent = min + ":" + sec;

  const p = home[state.selected];
  if (p) staminaFill.style.width = p.userData.stamina.toFixed(1) + "%";
  stateEl.textContent = state.matchState==="halftime" ? "HALF TIME" : state.finished ? "FULL TIME" : (state.paused ? "PAUSED" : "LIVE");
  const modeEl=document.querySelector("#controlMode");
  const ownerTeam=ball.userData.owner?.userData?.team;
  if(modeEl){
    modeEl.textContent=ownerTeam===AWAY?"DEFENSE":"ATTACK";
    modeEl.style.color=ownerTeam===AWAY?"#ff8796":"#72e2ad";
  }
  const halfEl=document.querySelector("#halfLabel");
  if(halfEl)halfEl.textContent=state.half===2?"2ND HALF":"1ST HALF";
  updateRadar();
}

function updateMatchClock() {
  if(!state.matchActive||state.finished||state.paused)return;

  if(state.half===1 && state.time>=HALF_TIME_AT){
    state.time=HALF_TIME_AT;
    state.half=2;
    state.paused=true;
    state.matchState="halftime";
    resetPositions(AWAY);
    showMessage("HALF TIME",1400);
    setTimeout(()=>{
      if(state.matchActive&&!state.finished){
        state.paused=false;
        state.matchState="live";
        showMessage("SECOND HALF",900);
      }
    },1600);
    return;
  }

  if(state.time>=MATCH_DURATION){
    state.time=MATCH_DURATION;
    state.finished=true;
    state.paused=true;
    state.matchState="fulltime";
    updateHUD();
    showMessage("FULL TIME",1500);
    window.dispatchEvent(new Event("football:fulltime"));
  }
}

function updateBroadcastCamera(dt) {
  const p=home[state.selected]||home[9];
  const ballPos=ball?.position||p?.position;
  const forwardX=1;
  const bx=ballPos?.x??0,bz=ballPos?.z??0;
  const px=p?.position.x??0,pz=p?.position.z??0;
  const midX=lerp(px,bx,.34),midZ=lerp(pz,bz,.34);
  const ballGap=Math.hypot(bx-px,bz-pz);
  const zoom=clamp(1+ballGap/22,1,1.45);
  const target=new THREE.Vector3(midX+forwardX*(7+ballGap*.10),1.0,midZ);
  const desired=new THREE.Vector3(
    px-forwardX*(15+ballGap*1.8/zoom),
    9.5+ballGap*.14,
    pz+4.0+ballGap*.10
  );
  const blend=1-Math.pow(0.00002,Math.min(.065,dt));
  camera.position.lerp(desired,blend);
  camera.fov=camera.aspect<1.05?56:52;
  camera.near=.05;
  camera.far=320;
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}
function updateJoystickVisual() {
  const max = 46;
  knob.style.transform =
    "translate(" + (state.joy.x * max).toFixed(1) + "px," +
    (state.joy.y * max).toFixed(1) + "px)";
}

function pointerIsGameplay(e) {
  return !!e.target && !e.target.closest?.("#controls,#matchbar,#topTools,#playerCard");
}

function setJoyFromPointer(e, start) {
  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;
  const len = Math.hypot(dx, dy);
  const scale = Math.min(1, len / 55);
  state.joy.x = len ? dx / len * scale : 0;
  state.joy.y = len ? dy / len * scale : 0;
  state.sprint = len > 75;
  updateJoystickVisual();
}

function leftDown(e) {
  e.preventDefault();
  const now=performance.now();
  const doubleTap=now-(state.leftTapAt||0)<280;
  const owner=ball.userData.owner;

  if(doubleTap){
    if(state.rightHeld&&owner?.userData?.team===HOME){
      activateShield();
      return;
    }
    if(owner?.userData?.team===AWAY){
      tackleControlled();
      state.leftTapAt=0;
      state.lastTouchAt=now;
      return;
    }
    if(owner?.userData?.team===HOME){
      quickStopFaceGoal();
      return;
    }
  }

  state.leftPointerId=e.pointerId;
  state.leftStart={x:e.clientX,y:e.clientY};
  state.sharpTouchTriggered=false;
  state.lastTouchAt=now;
  $("#stick").setPointerCapture?.(e.pointerId);
}

function leftMove(e) {
  if(e.pointerId!==state.leftPointerId||!state.leftStart)return;
  e.preventDefault();
  const dx=e.clientX-state.leftStart.x;
  const dy=e.clientY-state.leftStart.y;
  setJoyFromPointer(e,state.leftStart);
  if(state.rightHeld&&ball.userData.owner?.userData?.team===HOME){
    triggerSharpTouch(dx,dy);
  }
}

function leftUp(e) {
  if(e.pointerId!==state.leftPointerId)return;
  e.preventDefault();
  const now=performance.now();
  const start=state.leftStart;
  const mag=start?Math.hypot(e.clientX-start.x,e.clientY-start.y):0;
  if(mag<20)state.leftTapAt=now;
  state.leftPointerId=null;
  state.leftStart=null;
  state.joy.x=0;
  state.joy.y=0;
  state.sprint=false;
  state.sharpTouchTriggered=false;
  updateJoystickVisual();
}

function rightDown(e) {
  if(!pointerIsGameplay(e))return;
  e.preventDefault();
  const now=performance.now();
  state.rightHeld=true;
  state.rightGesture={id:e.pointerId,startX:e.clientX,startY:e.clientY,downAt:now,moved:false};

  if(ball.userData.owner?.userData?.team===AWAY){
    state.matchUp=false;
    state.pressUntil=now+1200;
    showMessage("PRESS",300);
  }else{
    state.sprint=true;
  }
}

function rightMove(e) {
  const g=state.rightGesture;
  if(!g||g.id!==e.pointerId)return;
  const dx=e.clientX-g.startX,dy=e.clientY-g.startY;
  if(Math.hypot(dx,dy)>16){
    g.moved=true;
    if(ball.userData.owner?.userData?.team===AWAY){
      state.matchUp=true;
      state.pressUntil=0;
    }
  }
}

function callTeamPressure() {
  state.teamPressUntil=performance.now()+1800;
  const target=ball.userData.owner;
  if(target?.userData?.team!==AWAY){showMessage("PRESS",350);return;}
  const pressers=home
    .filter(p=>p!==home[state.selected]&&p.userData.role!=="GK")
    .sort((a,b)=>dist(a,target)-dist(b,target))
    .slice(0,2);
  for(const p of pressers){
    p.userData.pressTarget=target;
    p.userData.pressUntil=state.teamPressUntil;
  }
  showMessage("TEAM PRESS",520);
}

function rightUp(e) {
  const g=state.rightGesture;
  if(!g||g.id!==e.pointerId)return;
  const now=performance.now();
  const dx=e.clientX-g.startX,dy=e.clientY-g.startY;
  const mag=Math.hypot(dx,dy);
  const duration=now-g.downAt;
  const defending=ball.userData.owner?.userData?.team===AWAY;

  state.rightGesture=null;
  state.rightHeld=false;
  state.matchUp=false;
  state.sprint=false;

  if(defending){
    if(g.moved&&mag>70)callTeamPressure();
    else if(g.moved)showMessage("MATCH-UP",300);
    else{
      state.pressUntil=now+900;
      showMessage("PRESS",400);
    }
    return;
  }

  const len=mag||1;
  const aim={x:dx/len,z:-dy/len};
  const recentLeftTap=now-(state.leftTapAt||0)<520;

  if(recentLeftTap){
    if(mag>=28){
      passOrShoot("shoot",clamp(mag/110,0.55,1.15),aim,true);
    }else{
      passOrShoot("pass",0.95,aim,true);
    }
    state.leftTapAt=0;
    return;
  }

  if(mag<20&&duration<220){
    if(now-(state.rightTapAt||0)<280){
      passOrShoot("shoot",0.92,null,false);
      state.rightTapAt=0;
    }else{
      passOrShoot("pass",0.78,null,false);
      state.rightTapAt=now;
    }
    return;
  }

  if(dy<-18&&Math.abs(dy)>Math.abs(dx)*0.82){
    passOrShoot("through",clamp(mag/100,0.55,1.12),aim,false);
  }else if(dy>18&&Math.abs(dy)>Math.abs(dx)*0.82){
    passOrShoot("pass",clamp(mag/92,0.55,1.1),aim,false);
  }else{
    passOrShoot("pass",clamp(mag/90,0.5,1.1),aim,false);
  }
}

function keyboardDown(e) {
  const key = e.key.toLowerCase();
  if (key === "shift") state.sprint = true;
  if (key === "j") passOrShoot("pass", 0.9);
  if (key === "k") passOrShoot("shoot", 1);
  if (key === " " && performance.now() - state.lastTouchAt > 500) {
    state.paused = !state.paused;
    showMessage(state.paused ? "PAUSED" : "RESUME");
  }
  if (/^[1-9]$/.test(key)) selectPlayer(Number(key) - 1);
}

function keyboardUp(e) {
  if (e.key.toLowerCase() === "shift") state.sprint = false;
}

function keyboardMove() {
  let x=0,y=0;
  const keys=new Set(window.__keys||[]);
  if(keys.has("a")||keys.has("arrowleft"))x-=1;
  if(keys.has("d")||keys.has("arrowright"))x+=1;
  if(keys.has("w")||keys.has("arrowup"))y-=1;
  if(keys.has("s")||keys.has("arrowdown"))y+=1;
  if(x||y){
    const len=Math.hypot(x,y); state.joy.x=x/len; state.joy.y=y/len;
  }else if(state.leftPointerId===null){
    state.joy.x=0; state.joy.y=0;
  }
}

function switchPlayer(){
  const current=home[state.selected],candidates=home.filter(p=>p!==current&&p.userData.role!=="GK");
  if(!candidates.length)return;candidates.sort((a,b)=>dist(a,ball)-dist(b,ball));selectPlayer(candidates[0].userData.index);showMessage("SWITCH",350);
}

function initInput() {
  window.__keys=[];
  addEventListener("keydown",(e)=>{if(!window.__keys.includes(e.key.toLowerCase()))window.__keys.push(e.key.toLowerCase());keyboardDown(e);});
  addEventListener("keyup",(e)=>{window.__keys=window.__keys.filter(k=>k!==e.key.toLowerCase());keyboardUp(e);});
  const stick=$("#stick");
  stick?.addEventListener("pointerdown",leftDown,{passive:false});
  stick?.addEventListener("pointermove",leftMove,{passive:false});
  stick?.addEventListener("pointerup",leftUp,{passive:false});
  stick?.addEventListener("pointercancel",leftUp,{passive:false});

  mount.addEventListener("pointerdown",(e)=>{
    if(!pointerIsGameplay(e))return;
    if(e.clientX<innerWidth*0.48){
      if(state.leftPointerId===null)leftDown(e);
    }else{
      rightDown(e);
    }
  },{passive:false});
  mount.addEventListener("pointermove",(e)=>{
    if(e.pointerId===state.leftPointerId)leftMove(e);
    else rightMove(e);
  },{passive:false});
  mount.addEventListener("pointerup",(e)=>{
    if(e.pointerId===state.leftPointerId)leftUp(e);
    else rightUp(e);
  },{passive:false});
  mount.addEventListener("pointercancel",(e)=>{
    if(e.pointerId===state.leftPointerId)leftUp(e);
    else rightUp(e);
  },{passive:false});

  // Desktop keyboard remains available for diagnostics; mobile gameplay uses Touch & Flick.
  document.querySelectorAll("#actionPad .matchAction").forEach(b=>b.tabIndex=-1);
}


function initRenderer() {
  renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: "default",
    precision: "mediump",
    depth: true,
    stencil: false,
    failIfMajorPerformanceCaveat: false
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  mount.replaceChildren(renderer.domElement);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
  camera.position.set(0, 48, 69);

  const hemi = new THREE.HemisphereLight(0xd9f1ff, 0x10251a, 1.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(0, 90, 30);
  scene.add(sun);
  clock = new THREE.Clock();

  addEventListener("resize", resize);
}

function resize() {
  if (!renderer || !camera) return;
  const canvas = renderer.domElement;
  const width = clamp(Math.round(canvas.clientWidth || mount.clientWidth || innerWidth || 390), 320, 2400);
  const height = clamp(Math.round(canvas.clientHeight || mount.clientHeight || innerHeight || 390), 240, 1400);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animatePlayer(p, now) {
  const u=p.userData;
  if(!u?.rig)return;
  const moving=!!u.moving;
  const speedRatio=u.sprint?1.16:1;
  const phase=now*0.0102*speedRatio+u.animationPhase;
  const cycle=moving?Math.sin(phase):0;
  const stride= u.sprint ? 0.92 : 0.68;
  const r=u.rig;
  const action=u.actionUntil>now?u.action:"idle";
  if(u.actionUntil<=now)u.action="idle";

  // Neutral athletic stance.
  r.hips.rotation.x=moving?(u.sprint?-0.10:-0.045):0;
  r.hips.rotation.z=moving?cycle*0.018:0;
  r.torso.rotation.x=moving?(u.sprint?-0.035:-0.018):0;
  r.torso.rotation.z=moving?cycle*0.012:0;

  // Legs: hip swing + delayed knee flex + planted-foot recovery.
  r.leftThigh.rotation.x=moving?-cycle*stride:0.06;
  r.rightThigh.rotation.x=moving?cycle*stride:-0.06;
  const leftKnee=Math.max(0,cycle);
  const rightKnee=Math.max(0,-cycle);
  r.leftCalf.rotation.x=moving?leftKnee*(u.sprint?1.02:.82):0.04;
  r.rightCalf.rotation.x=moving?rightKnee*(u.sprint?1.02:.82):0.04;
  r.leftFoot.rotation.x=moving?-leftKnee*.20:.02;
  r.rightFoot.rotation.x=moving?-rightKnee*.20:.02;

  // Arms swing from the shoulder, not sideways, which removes the old "T-pose" look.
  const armSwing=u.sprint?.48:.38;
  r.leftArm.rotation.x=moving?cycle*armSwing:0.05;
  r.rightArm.rotation.x=moving?-cycle*armSwing:-0.05;
  r.leftArm.rotation.z=moving?0.035:0;
  r.rightArm.rotation.z=moving?-0.035:0;
  r.leftFore.rotation.x=moving?-leftKnee*.18:0;
  r.rightFore.rotation.x=moving?-rightKnee*.18:0;

  // Match actions override the run cycle with short, readable football motions.
  if(action==="shoot"){
    const k=clamp((now-(u.actionUntil-680))/680,0,1);
    const wind=clamp(k/.42,0,1);
    const strike=clamp((k-.48)/.52,0,1);
    r.hips.rotation.x=-.075;
    r.torso.rotation.x=-.055;
    r.rightThigh.rotation.x=-.86*wind+1.18*strike;
    r.rightCalf.rotation.x=.82*wind-1.30*strike;
    r.rightFoot.rotation.x=-.32+.75*strike;
    r.leftArm.rotation.x=-.38;
    r.rightArm.rotation.x=.48;
  }else if(action==="tackle"){
    const k=clamp((now-(u.actionUntil-540))/540,0,1),swing=Math.sin(k*Math.PI);
    r.hips.rotation.x=-.10*swing;
    r.torso.rotation.x=-.08*swing;
    r.rightThigh.rotation.x=-.98*swing;
    r.rightCalf.rotation.x=.88*swing;
    r.leftArm.rotation.x=-.30*swing;
    r.rightArm.rotation.x=.36*swing;
  }else if(action==="save"){
    const k=clamp((now-(u.actionUntil-720))/720,0,1),dive=Math.sin(k*Math.PI);
    r.hips.rotation.z=.34*dive;
    r.torso.rotation.z=.14*dive;
    r.leftArm.rotation.z=-.72*dive;
    r.rightArm.rotation.z=.72*dive;
    r.leftThigh.rotation.x=-.28*dive;
    r.rightThigh.rotation.x=-.20*dive;
  }else if(action==="pass"||action==="through"||action==="stunningPass"||action==="stunningThrough"){
    const k=clamp((now-(u.actionUntil-500))/500,0,1),swing=Math.sin(k*Math.PI);
    const strong=action.startsWith("stunning")?1.15:1;
    r.hips.rotation.x=-.035*strong;
    r.rightThigh.rotation.x=-(action==="through"||action==="stunningThrough" ? .72 : .50)*swing*strong;
    r.rightCalf.rotation.x=.62*swing*strong;
    r.rightFoot.rotation.x=-.30*swing*strong;
    r.leftArm.rotation.x=.18*swing;
    r.rightArm.rotation.x=-.28*swing;
  }

  // Keep every foot planted: no artificial vertical bobbing that reads as floating.
  p.position.y=0.01;
}
function gameLoop(now) {
  const dt = Math.min(0.033, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  const matchVisible=document.body.classList.contains("inMatch");

  if(matchVisible){
    keyboardMove();
    if (!state.paused && state.matchActive) {
      state.time += dt * MATCH_TIME_SCALE;
      updateMatchClock();
      moveControlled(dt);
      autoSelectDefender();
      teamAI(dt);
      goalkeeperAI(dt);
      physics(dt);
      touchBall();
      updateBroadcastCamera(dt);
    }

    for(const p of players)animatePlayer(p,now);
    updateHUD();
    renderer.render(scene,camera);
  }
  requestAnimationFrame(gameLoop);
}

function bootGame() {
  try {
    initRenderer();
    resize();
    buildPitch();
    buildBall();
    placeTeams();
    selectPlayer(state.selected);
    resetPositions(HOME);
    initBallPossession();
    initInput();
    updateScore();
    updateHUD();

    window.__gameReady = true;
    window.__gameVersion = "match-presentation-20261004-04";
    window.__rendererMode = renderer.capabilities.isWebGL2 ? "webgl2" : "webgl1";
    boot.classList.add("ready");
    setTimeout(() => boot.remove(), 500);
  } catch (error) {
    window.__gameReady = false;
    window.__lastGameError = error?.stack || String(error);
    boot.innerHTML = "GAME ERROR<br><small>Reload the page</small>";
    boot.classList.remove("ready");
    throw error;
  }

  requestAnimationFrame(gameLoop);
}

window.addEventListener("football:match-start",()=>{
  const intro=$("#matchIntro");
  if(intro){intro.style.animation="none";intro.offsetHeight;intro.style.animation="introOut 1.8s 1.1s forwards"}
  state.matchActive=true;
  state.matchState="live";
  state.half=1;
  state.finished=false;
  state.paused=false;
  state.time=0;
  state.score=[0,0];
  state.lastGoalAt=0;
  resetPositions(HOME);
  initBallPossession();
  updateScore();
  updateHUD();
  showMessage("MATCH START",900);
});
window.addEventListener("football:match-exit",()=>{
  state.matchActive=false;
  state.paused=true;
  state.matchState="idle";
});
bootGame();
