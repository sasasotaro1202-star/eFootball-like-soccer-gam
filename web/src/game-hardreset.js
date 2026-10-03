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
 const g=new THREE.Group(), shirtColor=team===HOME?0x2e72e5:0xd83c55, shortsColor=team===HOME?0x173c79:0x771827;
 const d=team===HOME?homePool[index%homePool.length]:PLAYER_POOL[(11+index)%PLAYER_POOL.length], id=Number(d?.id)||index;
 const skin=[0xb97858,0xc98b6b,0xd49a78,0xe0ad88,0x8f5b43,0x704735][id%6], hair=[0x14100d,0x2a1b12,0x3a2518,0x6a4328][id%4], gameplay=gameplayAttributes(d,role,id);
 const height=0.96+(id%9)*0.018, width=0.92+(id%7)*0.022, head=0.94+(id%5)*0.035;
 const part=(geo,material,parent,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);parent.add(m);return m};
 const limb=(parent,x,y,material,len,rad)=>{const j=new THREE.Group();j.position.set(x,y,0);parent.add(j);part(new THREE.CapsuleGeometry(rad,len,6,8),material,j,0,-len*.42,0);return j};
 const hips=new THREE.Group();hips.position.y=1.0;g.add(hips);
 const torso=part(new THREE.CapsuleGeometry(.53,.92,7,12),mat(shirtColor,.58),hips,0,.47,0);torso.scale.set(width,1,height);
 part(new THREE.CapsuleGeometry(.22,.18,5,8),mat(skin,.78),hips,0,1.02,0);
 const neck=part(new THREE.CylinderGeometry(.12,.14,.18,10),mat(skin,.82),hips,0,1.08,0);
 const face=part(new THREE.SphereGeometry(.30,18,14),mat(skin,.78),hips,0,1.39,0);face.scale.set(head,1.08,head*.92);
 const hairTop=part(new THREE.SphereGeometry(.315,18,10,0,Math.PI*2,0,Math.PI*.52),mat(hair,.94),hips,0,1.54,0);
 hairTop.scale.set(1.03,.9,1.02);
 const eyeMat=new THREE.MeshBasicMaterial({color:0x181818});
 for(const sx of [-.075,.075])part(new THREE.SphereGeometry(.022,8,6),eyeMat,hips,sx,1.42,.282);
 const leftArm=limb(hips,-.55,.83,mat(shirtColor,.62),.43,.105),rightArm=limb(hips,.55,.83,mat(shirtColor,.62),.43,.105);
 const leftFore=limb(leftArm,0,-.39,mat(skin,.82),.36,.09),rightFore=limb(rightArm,0,-.39,mat(skin,.82),.36,.09);
 const leftThigh=limb(hips,-.22,.04,mat(shortsColor,.65),.52,.14),rightThigh=limb(hips,.22,.04,mat(shortsColor,.65),.52,.14);
 const leftCalf=limb(leftThigh,0,-.5,mat(skin,.82),.55,.105),rightCalf=limb(rightThigh,0,-.5,mat(skin,.82),.55,.105);
 const leftFoot=part(new THREE.BoxGeometry(.20,.12,.52),mat(0x11151a,.35),leftCalf,0,-.32,.11),rightFoot=part(new THREE.BoxGeometry(.20,.12,.52),mat(0x11151a,.35),rightCalf,0,-.32,.11);
 const num=document.createElement("canvas");num.width=num.height=128;const ctx=num.getContext("2d");ctx.clearRect(0,0,128,128);ctx.fillStyle="#fff";ctx.font="900 68px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(String(d?.number||index+1),64,64);
 const tex=new THREE.CanvasTexture(num);const nm=part(new THREE.PlaneGeometry(.34,.34),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}),g,0,1.38,-.49);nm.rotation.y=Math.PI;
 const ring=new THREE.Mesh(new THREE.RingGeometry(.72,.82,32),new THREE.MeshBasicMaterial({color:team===HOME?0x71b7ff:0xff7f91,transparent:true,opacity:.22,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.04;g.add(ring);
 g.scale.setScalar(.88+(id%6)*.035);
 g.userData={team,index,role,number:d?.number||index+1,bodyScale:1,heightScale:height,animationPhase:(id*.73)%6.28,player:d,name:d?.name||("PLAYER "+(index+1)),overall:d?.overall||70,position:d?.position||role,speed:role==="GK"?3.8+gameplay.pace*.025:4.2+gameplay.pace*.025,acceleration:7.5+gameplay.acceleration*.075,pace:gameplay.pace,shooting:gameplay.shooting,passing:gameplay.passing,dribbling:gameplay.dribbling,defending:gameplay.defending,physical:gameplay.physical,staminaRating:gameplay.stamina,gkReflexes:gameplay.gkReflexes,currentSpeed:0,stamina:100,homeX:0,homeZ:0,aiSeed:(id*1.17)%10,aiNextDecisionAt:0,selectedRing:ring,moving:false,sprint:false,action:"idle",actionUntil:0,rig:{hips,torso,leftArm,rightArm,leftFore,rightFore,leftThigh,rightThigh,leftCalf,rightCalf,leftFoot,rightFoot}};
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
  }

  const standMat=mat(0x151d28,0.92), crowdMat=mat(0xd8d0b8,1);
  for(const side of [-1,1]){for(let row=0;row<4;row++){const stand=new THREE.Mesh(new THREE.BoxGeometry(125,2.2,4.8),standMat);stand.position.set(0,1.2+row*1.8,side*(39+row*4.2));scene.add(stand);for(let k=0;k<24;k+=2){const c=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.75,0.9),mat((k+row)%4===0?0xd8d0b8:0x7d8a96,1));c.position.set(-49+k*4.1,2.7+row*1.8,side*(38+row*4.2));scene.add(c)}}const led=new THREE.Mesh(new THREE.BoxGeometry(106,0.55,0.35),new THREE.MeshBasicMaterial({color:0x263b4c}));led.position.set(0,0.65,side*35.2);scene.add(led)}
  for(const x of [-57,57])for(const z of [-39,39]){const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.3,18,8),standMat);pole.position.set(x,9,z);scene.add(pole);const lamp=new THREE.PointLight(0xffffff,8,75,2);lamp.position.set(x,18,z);scene.add(lamp)}
}

function buildBall() {
  ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 18, 12),
    mat(0xf4f6f4, 0.5)
  );
  ball.position.set(0, 0.48, 0);
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
  for (const p of home) p.userData.selectedRing.visible = false;
  const p = home[state.selected];
  if (!p) return;
  p.userData.selectedRing.visible = true;
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
        const speed=p.userData.speed*dt*clamp(len/4,0.28,1.08);
        p.position.x+=dx/len*speed;
        p.position.z+=dz/len*speed;
        p.rotation.y=Math.atan2(dx,dz);
        p.userData.moving=true;
      }else{
        p.userData.moving=false;
      }

      p.position.x=clamp(p.position.x,-51,51);
      p.position.z=clamp(p.position.z,-32.5,32.5);
      if(p!==owner&&!p.userData.moving)p.userData.sprint=false;
    }
  }

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
    ball.position.set(
      p.position.x + Math.sin(p.rotation.y) * 0.78,
      0.48,
      p.position.z + Math.cos(p.rotation.y) * 0.78
    );
    ball.userData.vx = ball.userData.vy = ball.userData.vz = 0;
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
  ball.position.x += ball.userData.vx * dt;
  ball.position.z += ball.userData.vz * dt;
  ball.position.y += ball.userData.vy * dt;

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
  // eFootball-style behind-player camera: elevated, forward-facing, and locked to the
  // selected player. The previous camera looked from the goal end of the X/Z plane,
  // which made mobile portrait/landscape captures appear like a view from below the pitch.
  const p = home[state.selected] || home[9];
  const forwardX = 1; // Home attacks toward +X.
  const target = new THREE.Vector3(
    p ? p.position.x + forwardX * 11 : 11,
    1.2,
    p ? p.position.z : 0
  );
  const desired = new THREE.Vector3(
    p ? p.position.x - forwardX * 16 : -16,
    10.5,
    p ? p.position.z + 4.5 : 4.5
  );
  const blend = 1 - Math.pow(0.00001, Math.min(0.05, dt));
  camera.position.lerp(desired, blend);
  camera.fov = camera.aspect < 1.05 ? 54 : 50;
  camera.near = 0.05;
  camera.far = 320;
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
  const u=p.userData;if(!u?.rig)return;
  const moving=!!u.moving,speedRatio=u.sprint?1.18:1,phase=now*0.0105*speedRatio+u.animationPhase;
  const cycle=moving?Math.sin(phase):Math.sin(phase*0.55),action=u.actionUntil>now?u.action:"idle";
  if(u.actionUntil<=now)u.action="idle";
  const r=u.rig;
  r.hips.rotation.z=moving?cycle*0.035:0; r.hips.rotation.x=moving?(u.sprint?-0.08:-0.045):0;
  r.leftThigh.rotation.x=moving?-cycle*(u.sprint?0.92:0.68):0.02; r.rightThigh.rotation.x=moving?cycle*(u.sprint?0.92:0.68):-0.02;
  r.leftCalf.rotation.x=moving?Math.max(0,cycle)*0.75:0.02; r.rightCalf.rotation.x=moving?Math.max(0,-cycle)*0.75:0.02;
  r.leftArm.rotation.z=moving?cycle*(u.sprint?0.30:0.22):0.04; r.rightArm.rotation.z=moving?-cycle*(u.sprint?0.30:0.22):-0.04;
  r.leftFore.rotation.z=moving?-cycle*0.12:0; r.rightFore.rotation.z=moving?cycle*0.12:0;
  r.leftFoot.rotation.x=moving?Math.max(0,-cycle)*0.22:0; r.rightFoot.rotation.x=moving?Math.max(0,cycle)*0.22:0;
  if(action==="shoot"){
    const k=clamp((now-(u.actionUntil-620))/620,0,1),wind=k<0.42?k/0.42:1,strike=k<0.58?0:(k-0.58)/0.42;
    r.hips.rotation.x=-0.04; r.rightThigh.rotation.x=-0.9*wind+1.35*strike; r.rightCalf.rotation.x=1.0*wind-1.35*strike; r.rightFoot.rotation.x=-0.55+1.0*strike;
    r.leftArm.rotation.z=-0.32;r.rightArm.rotation.z=0.30;
  }else if(action==="tackle"){
    const k=clamp((now-(u.actionUntil-520))/520,0,1);
    const swing=Math.sin(k*Math.PI);
    r.hips.rotation.x=-0.10*swing;
    r.rightThigh.rotation.x=-1.05*swing;
    r.rightCalf.rotation.x=0.9*swing;
    r.leftArm.rotation.z=-0.28*swing;r.rightArm.rotation.z=0.28*swing;
  }else if(action==="save"){
    const k=clamp((now-(u.actionUntil-700))/700,0,1);
    const dive=Math.sin(k*Math.PI);
    r.hips.rotation.z=0.28*dive;
    r.leftArm.rotation.z=-0.75*dive;r.rightArm.rotation.z=0.75*dive;
    r.leftThigh.rotation.x=-0.32*dive;r.rightThigh.rotation.x=-0.18*dive;
  }else if(action==="pass"||action==="through"){
    const k=clamp((now-(u.actionUntil-480))/480,0,1),swing=Math.sin(k*Math.PI);
    r.rightThigh.rotation.x=(action==="through"?-0.72:-0.5)*swing; r.rightCalf.rotation.x=0.65*swing; r.rightFoot.rotation.x=-0.35*swing;
    r.leftArm.rotation.z=0.25*swing;r.rightArm.rotation.z=-0.25*swing;
  }
  p.position.y=0.01+(moving?Math.abs(Math.sin(phase))*0.018:Math.abs(Math.sin(phase*0.55))*0.006);
  p.rotation.z=moving?cycle*0.012:0;
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
    window.__gameVersion = "match-motion-20260920-01";
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
