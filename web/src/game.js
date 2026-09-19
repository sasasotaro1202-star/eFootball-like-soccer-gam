import * as THREE from "three";

const app = document.querySelector("#app");
const mount = document.querySelector("#game");
const boot = document.querySelector("#boot");
const scoreEl = document.querySelector("#score");
const clockEl = document.querySelector("#clock");
const stateEl = document.querySelector("#matchState");
const playerLabel = document.querySelector("#playerLabel");
const playerNo = document.querySelector("#playerNo");
const playerRole = document.querySelector("#playerRole");
const staminaFill = document.querySelector("#staminaFill");
const knob = document.querySelector("#knob");
const radar = document.querySelector("#radar");
const message = document.querySelector("#message");

const FIELD = { w: 105, d: 68, goalW: 14.64, goalD: 4.2 };
const BLUE = 0x4d8dff;
const RED = 0xff5369;
const WHITE = 0xf6f8f7;
const GREEN = 0x2d8b4d;
const DARK_GREEN = 0x176238;

const state = {
  time: 0,
  homeScore: 0,
  awayScore: 0,
  selected: 0,
  joy: { x: 0, y: 0 },
  pointer: { id: null, x: 0, y: 0, startX: 0, startY: 0 },
  rightGesture: { id: null, x: 0, y: 0, startX: 0, startY: 0, downAt: 0 },
  actions: { sprint: false },
  lastGoal: 0,
  kickoff: true,
  paused: false
};

let renderer, scene, camera, clock;
let ball;
let home = [];
let away = [];
let players = [];
let lastFrame = performance.now();

function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function dist2(a,b){ const dx=a.position.x-b.position.x,dz=a.position.z-b.position.z; return dx*dx+dz*dz; }
function showMessage(text,ms=900){
  message.textContent=text;
  window.clearTimeout(showMessage.timer);
  showMessage.timer=window.setTimeout(()=>message.textContent="",ms);
}

function makeMat(color,rough=.75,metal=0){
  return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
}

function makePlayer(team,index,role){
  const group=new THREE.Group();
  const shirt=makeMat(team===BLUE?0x3176dc:0xd62f4b,.62);
  const skin=makeMat(0xd7a27d,.86);
  const shorts=makeMat(team===BLUE?0x183d79:0x7b1728,.72);
  const boot=makeMat(0x111518,.55,.15);

  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.62,1.25,4,8),shirt);
  body.position.y=1.32;
  body.castShadow=true;
  group.add(body);

  const head=new THREE.Mesh(new THREE.SphereGeometry(.38,12,8),skin);
  head.position.y=2.38;
  head.castShadow=true;
  group.add(head);

  for(const sx of [-.23,.23]){
    const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.14,.62,3,6),shorts);
    leg.position.set(sx,0.65,0);
    leg.castShadow=true;
    group.add(leg);
    const foot=new THREE.Mesh(new THREE.BoxGeometry(.22,.13,.48),boot);
    foot.position.set(sx,.25,.12);
    foot.castShadow=true;
    group.add(foot);
  }

  const ring=new THREE.Mesh(
    new THREE.RingGeometry(.74,.84,28),
    new THREE.MeshBasicMaterial({color:team===BLUE?0x67a9ff:0xff7787,transparent:true,opacity:.18,side:THREE.DoubleSide})
  );
  ring.rotation.x=-Math.PI/2;
  ring.position.y=.06;
  group.add(ring);

  group.userData={
    team,index,role,number:index+1,
    speed: role==="GK"?4.1:5.0+Math.random()*1.2,
    stamina:100,
    homeX:0,homeZ:0,
    velX:0,velZ:0,
    aiPhase:Math.random()*Math.PI*2
  };
  return group;
}

const FORMATION = [
  ["GK",-50,0],
  ["DF",-38,-25],["DF",-38,-9],["DF",-38,9],["DF",-38,25],
  ["MF",-18,-20],["MF",-13,0],["MF",-18,20],
  ["FW",2,-23],["FW",5,0],["FW",2,23]
];

function placeTeams(){
  home=[];away=[];players=[];
  for(let i=0;i<11;i++){
    const [role,x,z]=FORMATION[i];
    const p=makePlayer(BLUE,i,role);
    p.userData.homeX=x;p.userData.homeZ=z;
    p.position.set(x,0,z);
    scene.add(p);home.push(p);players.push(p);
  }
  for(let i=0;i<11;i++){
    const [role,x,z]=FORMATION[i];
    const p=makePlayer(RED,i,role);
    p.userData.homeX=-x;p.userData.homeZ=-z;
    p.position.set(-x,0,-z);
    scene.add(p);away.push(p);players.push(p);
  }
}

function buildPitch(){
  scene.background=new THREE.Color(0x07131d);

  const world=new THREE.Mesh(
    new THREE.PlaneGeometry(320,250),
    new THREE.MeshBasicMaterial({color:0x0b1720,side:THREE.DoubleSide})
  );
  world.rotation.x=-Math.PI/2;
  world.position.y=-.12;
  scene.add(world);

  const pitch=new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD.w,FIELD.d),
    new THREE.MeshStandardMaterial({color:GREEN,roughness:1,metalness:0,side:THREE.DoubleSide})
  );
  pitch.rotation.x=-Math.PI/2;
  pitch.position.y=0;
  pitch.receiveShadow=true;
  scene.add(pitch);

  const stripeMat=[0x2f914f,0x2b8549];
  for(let i=0;i<12;i++){
    const stripe=new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD.w/12+.05,FIELD.d),
      new THREE.MeshBasicMaterial({color:stripeMat[i%2],side:THREE.DoubleSide,transparent:true,opacity:.22})
    );
    stripe.rotation.x=-Math.PI/2;
    stripe.position.set(-FIELD.w/2+(i+.5)*FIELD.w/12,.006,0);
    scene.add(stripe);
  }

  const lineMat=new THREE.MeshBasicMaterial({color:WHITE,side:THREE.DoubleSide});
  const line=(x1,z1,x2,z2,w=.11)=>{
    const len=Math.hypot(x2-x1,z2-z1);
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,.035,len),lineMat);
    m.position.set((x1+x2)/2,.035,(z1+z2)/2);
    m.rotation.y=Math.atan2(x2-x1,z2-z1);
    scene.add(m);
  };
  line(-52.5,-34,52.5,-34);line(-52.5,34,52.5,34);
  line(-52.5,-34,-52.5,34);line(52.5,-34,52.5,34);
  line(0,-34,0,34);
  const circle=new THREE.Mesh(new THREE.RingGeometry(9.1,9.22,96),lineMat);
  circle.rotation.x=-Math.PI/2;circle.position.y=.04;scene.add(circle);
  const spot=new THREE.Mesh(new THREE.CircleGeometry(.22,24),lineMat);
  spot.rotation.x=-Math.PI/2;spot.position.y=.041;scene.add(spot);

  for(const side of [-1,1]){
    const x=side*52.5;
    line(x,-20,x-side*16,-20);line(x,20,x-side*16,20);
    line(x-side*16,-20,x-side*16,20);
    line(x,-9,x-side*5.5,-9);line(x,9,x-side*5.5,9);
    line(x-side*5.5,-9,x-side*5.5,9);
    const arc=new THREE.Mesh(new THREE.RingGeometry(9.05,9.17,40,1,side<0?-.9:2.24,1.8),lineMat);
    arc.rotation.x=-Math.PI/2;arc.position.set(x-side*11,0.041,0);scene.add(arc);
  }

  const goalMat=makeMat(WHITE,.4,.05);
  for(const side of [-1,1]){
    const x=side*52.7;
    for(const z of [-FIELD.goalW/2,FIELD.goalW/2]){
      const post=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,3.6,12),goalMat);
      post.position.set(x,1.8,z);post.castShadow=true;scene.add(post);
    }
    const bar=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,FIELD.goalW),goalMat);
    bar.position.set(x,3.6,0);bar.castShadow=true;scene.add(bar);
    const back=new THREE.Mesh(new THREE.BoxGeometry(FIELD.goalD,.12,FIELD.goalW),goalMat);
    back.position.set(x-side*FIELD.goalD/2,.06,0);scene.add(back);
  }

  const standMat=makeMat(0x202b34,.92);
  const seatMat=makeMat(0x3b4750,.9);
  const boardMat=new THREE.MeshBasicMaterial({color:0x214e88});
  for(const z of [-42,42]){
    for(let row=0;row<3;row++){
      const stand=new THREE.Mesh(new THREE.BoxGeometry(145,2.4+row*1.2,5.5),standMat);
      stand.position.set(0,1.1+row*1.3,z);
      stand.castShadow=true;scene.add(stand);
      for(let i=0;i<25;i++){
        const seat=new THREE.Mesh(new THREE.BoxGeometry(3.7,.3,1.1),seatMat);
        seat.position.set(-46+i*3.85,3.1+row*1.25,z+(z>0?-2.8:2.8));
        scene.add(seat);
      }
    }
    const board=new THREE.Mesh(new THREE.BoxGeometry(108,.85,.16),boardMat);
    board.position.set(0,.62,z>0?-35.2:35.2);scene.add(board);
  }
  for(const x of [-61,61]){
    const side=new THREE.Mesh(new THREE.BoxGeometry(5,6,86),standMat);
    side.position.set(x,2.6,0);side.castShadow=true;scene.add(side);
  }
}

function buildBall(){
  const ballMat=makeMat(WHITE,.48,.05);
  ball=new THREE.Mesh(new THREE.SphereGeometry(.42,18,12),ballMat);
  ball.castShadow=true;
  ball.position.set(-.5,.55,0);
  ball.userData={owner:null,vx:0,vy:0,vz:0};
  scene.add(ball);
}

function resetMatch(kickoffTeam=BLUE){
  for(const p of players){
    p.position.set(p.userData.homeX,0,p.userData.homeZ);
    p.userData.stamina=100;
  }
  // Away formation mirrors the home formation in placeTeams().
  for(const p of away){
    p.position.set(p.userData.homeX,0,p.userData.homeZ);
  }
  ball.position.set(0,.55,0);
  ball.userData.owner=kickoffTeam===BLUE?home[9]:away[9];
  ball.userData.vx=ball.userData.vy=ball.userData.vz=0;
  state.kickoff=true;
}

function controlled(){ return home[state.selected]||home[9]; }

function selectPlayer(index){
  state.selected=clamp(index,0,home.length-1);
  const p=controlled();
  playerLabel.textContent="PLAYER "+String(p.userData.number).padStart(2,"0");
  playerNo.textContent="#"+p.userData.number;
  playerRole.textContent=p.userData.role;
}

function nearestHomeToBall(){
  let best=0,bestD=Infinity;
  for(let i=0;i<home.length;i++){
    const d=dist2(home[i],ball);
    if(d<bestD){bestD=d;best=i;}
  }
  return best;
}

function moveControlled(dt){
  const p=controlled();
  if(!p)return;
  const j=state.joy;
  const mag=Math.hypot(j.x,j.y);
  if(mag<.05)return;
  const len=Math.min(1,mag);
  const speed=p.userData.speed*(state.actions.sprint?1.45:1);
  const tx=j.x/Math.max(1,mag)*len*speed;
  const tz=j.y/Math.max(1,mag)*len*speed;
  p.position.x+=tx*dt;
  p.position.z+=tz*dt;
  p.position.x=clamp(p.position.x,-51,51);
  p.position.z=clamp(p.position.z,-32.5,32.5);
  p.rotation.y=Math.atan2(tx,tz);
  p.userData.stamina=clamp(p.userData.stamina-(state.actions.sprint?5.2:1.15)*dt,0,100);
  if(ball.userData.owner===p){
    ball.position.x=p.position.x+Math.sin(p.rotation.y)*.8;
    ball.position.z=p.position.z+Math.cos(p.rotation.y)*.8;
    ball.position.y=.48;
  }
}

function aiStep(dt){
  const owner=ball.userData.owner;
  for(const p of players){
    if(p===controlled())continue;
    const attackDir=p.userData.team===BLUE?1:-1;
    let tx=p.userData.homeX,tz=p.userData.homeZ;

    if(owner){
      const ownTeam=owner.userData.team;
      const isAttacking=p.userData.team===ownTeam;
      if(p.userData.role==="GK"){
        tx=p.userData.homeX;
        tz=clamp(ball.position.z,-8,8);
      }else if(isAttacking){
        tx += clamp((ball.position.x*attackDir)*.22,-12,14);
        tz += clamp((ball.position.z-p.userData.homeZ)*.18,-8,8);
      }else{
        tx += clamp((ball.position.x*attackDir)*.12,-10,8);
        tz += clamp((ball.position.z-p.userData.homeZ)*.16,-7,7);
      }
    }else{
      const d=Math.sqrt(dist2(p,ball));
      if(d<11 && p.userData.team!==ball.userData.lastTouchTeam){
        tx=ball.position.x;tz=ball.position.z;
      }else if(d<14 && p.userData.team===ball.userData.lastTouchTeam){
        tx=(p.userData.homeX+ball.position.x*.35);tz=(p.userData.homeZ+ball.position.z*.35);
      }
    }

    const dx=tx-p.position.x,dz=tz-p.position.z,d=Math.hypot(dx,dz);
    if(d>.25){
      const s=p.userData.speed*dt*clamp(d/5,.25,1);
      p.position.x+=dx/d*s;p.position.z+=dz/d*s;
      p.rotation.y=Math.atan2(dx,dz);
    }
    p.position.x=clamp(p.position.x,-51,51);
    p.position.z=clamp(p.position.z,-32.5,32.5);
  }

  if(owner && owner.userData.team!==BLUE){
    const d=Math.sqrt(dist2(owner,ball));
    if(d<2.5 && owner.userData.role!=="GK"){
      const dir=1;
      const target=home.filter(x=>x.userData.role!=="GK").sort((a,b)=>dist2(owner,a)-dist2(owner,b))[0];
      if(target && Math.random()<.008){
        kick(owner,target.position.x+dir*5,target.position.z,10);
      }
    }
  }
}

function kick(p,tx,tz,speed){
  if(!p)return;
  const dx=tx-ball.position.x,dz=tz-ball.position.z,l=Math.hypot(dx,dz)||1;
  ball.userData.owner=null;
  ball.userData.lastTouchTeam=p.userData.team;
  ball.userData.vx=dx/l*speed;
  ball.userData.vz=dz/l*speed;
  ball.userData.vy=.5;
}

function touchBall(){
  let owner=ball.userData.owner;
  if(owner){
    ball.position.x=owner.position.x+Math.sin(owner.rotation.y)*.8;
    ball.position.z=owner.position.z+Math.cos(owner.rotation.y)*.8;
    ball.position.y=.48;
    return;
  }
  for(const p of players){
    if(Math.sqrt(dist2(p,ball))<1.65 && ball.position.y<1.3){
      ball.userData.owner=p;
      ball.userData.vx=ball.userData.vy=ball.userData.vz=0;
      if(p.userData.team===BLUE)selectPlayer(p.userData.index);
      return;
    }
  }
}

function physics(dt){
  if(ball.userData.owner)return;
  ball.userData.vy-=18*dt;
  ball.position.x+=ball.userData.vx*dt;
  ball.position.z+=ball.userData.vz*dt;
  ball.position.y+=ball.userData.vy*dt;
  const drag=Math.pow(.985,dt*60);
  ball.userData.vx*=drag;ball.userData.vz*=drag;
  if(ball.position.y<.43){
    ball.position.y=.43;
    if(Math.abs(ball.userData.vy)>.8)ball.userData.vy*=-.38;
    else ball.userData.vy=0;
    ball.userData.vx*=.93;ball.userData.vz*=.93;
  }
  if(ball.position.z>34 || ball.position.z<-34){
    ball.position.z=clamp(ball.position.z,-34,34);
    ball.userData.vz*=-.7;
  }
  if(ball.position.x>54.2 || ball.position.x<-54.2){
    const insideGoal=Math.abs(ball.position.z)<FIELD.goalW/2;
    if(insideGoal){
      const now=performance.now();
      if(now-state.lastGoal>1200){
        if(ball.position.x>0)state.homeScore++;else state.awayScore++;
        state.lastGoal=now;
        scoreEl.textContent=state.homeScore+" - "+state.awayScore;
        showMessage("GOAL",1500);
        resetMatch(ball.position.x>0?RED:BLUE);
      }
      return;
    }
    ball.position.x=clamp(ball.position.x,-54.2,54.2);
    ball.userData.vx*=-.7;
  }
}

function rightFlick(dx,dy){
  const p=controlled();
  if(!p)return;
  const mag=Math.hypot(dx,dy);
  if(mag<24){
    if(ball.userData.owner===p){
      const target=home.filter(x=>x!==p).sort((a,b)=>dist2(p,a)-dist2(p,b))[0];
      if(target)kick(p,target.position.x+5,target.position.z,13);
    }
    return;
  }
  const len=mag||1,ax=dx/len,az=dy/len,power=clamp(mag/150,.25,1);
  if(ball.userData.owner!==p)return;
  if(Math.abs(dy)>Math.abs(dx)*1.25){
    kick(p,p.position.x+ax*(12+18*power),p.position.z+az*(12+18*power),10+10*power);
    ball.userData.vy=dy<0?4+4*power:2;
  }else{
    const goalX=53;
    const targetZ=clamp(p.position.z+az*(8+8*power),-6.5,6.5);
    const speed=17+15*power;
    kick(p,goalX,targetZ,speed);
    ball.userData.vy=1.2+2.2*power;
  }
}

function bindInput(){
  const canvas=renderer.domElement;
  const isGameplay=e=>!e.target.closest?.("#controls,#matchbar,#topTools,#radarWrap,#playerCard,#boot");

  canvas.addEventListener("pointerdown",e=>{
    if(!isGameplay(e))return;
    e.preventDefault();
    if(e.clientX<innerWidth*.48){
      state.pointer.id=e.pointerId;
      state.pointer.startX=state.pointer.x=e.clientX;
      state.pointer.startY=state.pointer.y=e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
      return;
    }
    state.rightGesture.id=e.pointerId;
    state.rightGesture.startX=state.rightGesture.x=e.clientX;
    state.rightGesture.startY=state.rightGesture.y=e.clientY;
    state.rightGesture.downAt=performance.now();
    canvas.setPointerCapture?.(e.pointerId);
  },{passive:false});

  canvas.addEventListener("pointermove",e=>{
    if(e.pointerId===state.pointer.id){
      e.preventDefault();
      const dx=e.clientX-state.pointer.startX,dy=e.clientY-state.pointer.startY;
      const r=76,m=Math.min(1,Math.hypot(dx,dy)/r);
      const l=Math.hypot(dx,dy)||1;
      state.joy.x=dx/l*m;state.joy.y=dy/l*m;
      state.actions.sprint=Math.hypot(dx,dy)>82;
      knob.style.transform="translate("+clamp(dx,-48,48)+"px,"+clamp(dy,-48,48)+"px)";
    }
  },{passive:false});

  const up=e=>{
    if(e.pointerId===state.pointer.id){
      e.preventDefault();
      state.pointer.id=null;state.joy.x=state.joy.y=0;state.actions.sprint=false;
      knob.style.transform="translate(0,0)";
    }
    if(e.pointerId===state.rightGesture.id){
      e.preventDefault();
      const g=state.rightGesture;
      rightFlick(e.clientX-g.startX,e.clientY-g.startY);
      state.rightGesture.id=null;
    }
  };
  canvas.addEventListener("pointerup",up,{passive:false});
  canvas.addEventListener("pointercancel",up,{passive:false});

  window.addEventListener("resize",resize);
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden)state.actions.sprint=false;
  });
}

function updateHUD(){
  const p=controlled();
  playerLabel.textContent="PLAYER "+String(p.userData.number).padStart(2,"0");
  playerNo.textContent="#"+p.userData.number;
  playerRole.textContent=p.userData.role;
  staminaFill.style.width=p.userData.stamina+"%";
  const sec=Math.min(90*60,state.time);
  clockEl.textContent=String(Math.floor(sec/60)).padStart(2,"0")+":"+String(Math.floor(sec%60)).padStart(2,"0");
  scoreEl.textContent=state.homeScore+" - "+state.awayScore;
  stateEl.textContent=state.paused?"PAUSED":"LIVE";
}

function updateRadar(){
  const ctx=radar.getContext("2d");
  const w=radar.width,h=radar.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle="#0b3d25";ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="#dceee4";ctx.lineWidth=1;ctx.strokeRect(2,2,w-4,h-4);
  ctx.beginPath();ctx.moveTo(w/2,2);ctx.lineTo(w/2,h-2);ctx.stroke();
  ctx.beginPath();ctx.arc(w/2,h/2,12,0,Math.PI*2);ctx.stroke();
  const dot=(p,c)=>{
    const x=2+(p.position.x+52.5)/105*(w-4),y=2+(p.position.z+34)/68*(h-4);
    ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,2.3,0,Math.PI*2);ctx.fill();
  };
  home.forEach(p=>dot(p,"#68a8ff"));away.forEach(p=>dot(p,"#ff6678"));
  dot(ball,"#fff");
}

function updateCamera(dt){
  const p=controlled();
  const targetX=clamp((ball.position.x+p.position.x)*.08,-8,8);
  const targetZ=clamp((ball.position.z+p.position.z)*.04,-2,4);
  const desired=new THREE.Vector3(targetX,58,72);
  camera.position.lerp(desired,1-Math.pow(.0001,Math.min(.05,dt)));
  camera.lookAt(targetX,0,targetZ);
}

function resize(){
  const w=mount.clientWidth||innerWidth,h=mount.clientHeight||innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  camera.fov=w/h<1.15?46:52;
  camera.updateProjectionMatrix();
}

function init(){
  renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:"high-performance",precision:"mediump",stencil:false,depth:true});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);

  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(52,1,.1,400);
  camera.position.set(0,58,72);
  clock=new THREE.Clock();

  const hemi=new THREE.HemisphereLight(0xc9e8ff,0x123b20,2.0);
  scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffffff,3.0);
  sun.position.set(-25,70,35);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-75;sun.shadow.camera.right=75;sun.shadow.camera.top=70;sun.shadow.camera.bottom=-70;
  scene.add(sun);

  buildPitch();
  placeTeams();
  buildBall();
  selectPlayer(9);
  resetMatch(BLUE);
  bindInput();
  resize();

  window.__gameReady=true;
  boot?.classList.add("ready");
}

function frame(now){
  const dt=Math.min(.033,(now-lastFrame)/1000);
  lastFrame=now;
  if(!state.paused){
    state.time+=dt;
    moveControlled(dt);
    aiStep(dt);
    physics(dt);
    touchBall();
    updateCamera(dt);
    updateHUD();
    updateRadar();
  }
  renderer.render(scene,camera);
  requestAnimationFrame(frame);
}

try{
  init();
  requestAnimationFrame(frame);
}catch(err){
  window.__lastGameError=String(err?.message||err);
  window.__lastGameStack=String(err?.stack||"");
  boot.classList.remove("ready");
  boot.innerHTML="3D ENGINE ERROR<br><small>"+String(err?.message||err).slice(0,120)+"</small>";
  throw err;
}
