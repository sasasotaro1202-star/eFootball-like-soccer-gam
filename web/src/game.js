import * as THREE from "three";

const root = document.querySelector("#game");
const scoreEl = document.querySelector("#score");
const clockEl = document.querySelector("#clock");
const msg = document.querySelector("#message");

const FIELD = { w: 106, d: 68, goalW: 14 };
const state = {
  score: [0, 0],
  time: 180,
  over: false,
  joy: { x: 0, y: 0 },
  actions: {},
  lastKick: 0
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07140d);
scene.fog = new THREE.Fog(0x07140d, 75, 170);

const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 220);
camera.position.set(-18, 24, 27);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
root.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdceeff, 0x153d20, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 3.1);
sun.position.set(-35, 55, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -75;
sun.shadow.camera.right = 75;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
scene.add(sun);

const mat = (color, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
const pitchMat = mat(0x176b38);
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const blueMat = mat(0x3f8cff);
const redMat = mat(0xef4444);
const skinMat = mat(0xf0bd8a);
const hairMat = mat(0x2b211c);
const blackMat = mat(0x151515);
const whiteMat = mat(0xf4f4f4);

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cylinder(r, h, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, h, 10), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function line(x1, z1, x2, z2, width = 0.18) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const m = box(width, 0.035, len, lineMat);
  m.position.set((x1 + x2) / 2, 0.025, (z1 + z2) / 2);
  m.rotation.y = Math.atan2(x2 - x1, z2 - z1);
  return m;
}

function makeField() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(FIELD.w + 12, FIELD.d + 12), mat(0x0b301b));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(FIELD.w, FIELD.d), pitchMat);
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = 0.01;
  pitch.receiveShadow = true;
  scene.add(pitch);

  const markings = [
    line(-FIELD.w/2, -FIELD.d/2, FIELD.w/2, -FIELD.d/2),
    line(-FIELD.w/2, FIELD.d/2, FIELD.w/2, FIELD.d/2),
    line(-FIELD.w/2, -FIELD.d/2, -FIELD.w/2, FIELD.d/2),
    line(FIELD.w/2, -FIELD.d/2, FIELD.w/2, FIELD.d/2),
    line(0, -FIELD.d/2, 0, FIELD.d/2),
    line(-FIELD.w/2 + 16, -20, -FIELD.w/2 + 16, 20),
    line(FIELD.w/2 - 16, -20, FIELD.w/2 - 16, 20)
  ];
  markings.forEach(m => scene.add(m));

  const circle = new THREE.Mesh(
    new THREE.RingGeometry(8.95, 9.15, 64),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.035;
  scene.add(circle);

  [-FIELD.w/2 - 1.2, FIELD.w/2 + 1.2].forEach(x => {
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
    const g = new THREE.Group();
    g.add(cylinder(0.16, 3.1, postMat, -FIELD.goalW/2, 1.55, 0));
    g.add(cylinder(0.16, 3.1, postMat, FIELD.goalW/2, 1.55, 0));
    g.add(box(0.16, 0.16, FIELD.goalW, postMat, 0, 3.1, 0));
    g.position.x = x;
    scene.add(g);
  });
}
makeField();

function createPlayer(teamMat, number, controlled = false) {
  const g = new THREE.Group();
  const body = cylinder(0.58, 1.55, teamMat, 0, 2.05, 0);
  g.add(body);
  g.add(cylinder(0.38, 0.76, skinMat, 0, 3.22, 0));
  g.add(cylinder(0.4, 0.24, hairMat, 0, 3.67, 0));

  const armL = box(0.22, 1.0, 0.22, teamMat, -0.76, 2.08, 0);
  const armR = box(0.22, 1.0, 0.22, teamMat, 0.76, 2.08, 0);
  armL.rotation.z = -0.08; armR.rotation.z = 0.08;
  g.add(armL, armR);

  const legL = box(0.28, 1.15, 0.3, blackMat, -0.28, 0.75, 0);
  const legR = box(0.28, 1.15, 0.3, blackMat, 0.28, 0.75, 0);
  g.add(legL, legR);

  const footL = box(0.32, 0.18, 0.62, whiteMat, -0.28, 0.16, -0.18);
  const footR = box(0.32, 0.18, 0.62, whiteMat, 0.28, 0.16, -0.18);
  g.add(footL, footR);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 0.9, 32),
    new THREE.MeshBasicMaterial({ color: controlled ? 0xffdf3f : 0xffffff, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  g.add(ring);

  g.userData = { number, vx: 0, vz: 0, homeX: 0, homeZ: 0, controlled };
  scene.add(g);
  return g;
}

const player = createPlayer(blueMat, 10, true);
const mates = [
  createPlayer(blueMat, 7), createPlayer(blueMat, 9), createPlayer(blueMat, 8),
  createPlayer(blueMat, 11), createPlayer(blueMat, 6)
];
const foes = [
  createPlayer(redMat, 9), createPlayer(redMat, 10), createPlayer(redMat, 7),
  createPlayer(redMat, 11), createPlayer(redMat, 4), createPlayer(redMat, 5)
];

const homePos = [
  [-36,-20],[-36,20],[-14,-13],[-14,13],[6,0]
];
const awayPos = [
  [36,-20],[36,20],[15,-13],[15,13],[4,0],[-8,0]
];
mates.forEach((p, i) => { p.position.set(homePos[i][0],0,homePos[i][1]); p.userData.homeX=homePos[i][0]; p.userData.homeZ=homePos[i][1]; });
foes.forEach((p, i) => { p.position.set(awayPos[i][0],0,awayPos[i][1]); p.userData.homeX=awayPos[i][0]; p.userData.homeZ=awayPos[i][1]; });
player.position.set(-40,0,0);
player.userData.homeX = -40; player.userData.homeZ = 0;

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(0.48, 16, 12),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 })
);
ball.castShadow = true;
ball.position.set(0, 0.48, 0);
ball.userData = { vx: 0, vz: 0, spin: 0 };
scene.add(ball);

const goalkeepers = [
  createPlayer(whiteMat, 1), createPlayer(whiteMat, 1)
];
goalkeepers[0].scale.setScalar(0.94); goalkeepers[1].scale.setScalar(0.94);
goalkeepers[0].position.set(-50,0,0); goalkeepers[1].position.set(50,0,0);

function reset(text = "KICK OFF") {
  ball.position.set(0, 0.48, 0);
  ball.userData.vx = ball.userData.vz = 0;
  player.position.set(-40,0,0);
  mates.forEach((p,i)=>p.position.set(homePos[i][0],0,homePos[i][1]));
  foes.forEach((p,i)=>p.position.set(awayPos[i][0],0,awayPos[i][1]));
  goalkeepers[0].position.set(-50,0,0);
  goalkeepers[1].position.set(50,0,0);
  msg.textContent = text;
  setTimeout(()=>{ if(msg.textContent===text) msg.textContent=""; }, 1200);
}

function nearestTeammate() {
  return mates.reduce((best, p) =>
    p.position.distanceTo(player.position) < best.position.distanceTo(player.position) ? p : best, mates[0]);
}

function kick(vx, vz, power) {
  const dx = ball.position.x - player.position.x;
  const dz = ball.position.z - player.position.z;
  if (Math.hypot(dx, dz) > 3.4) return;
  ball.userData.vx = vx * power;
  ball.userData.vz = vz * power;
  state.lastKick = performance.now();
}

function action() {
  const a = state.actions;
  if (a.shoot) {
    const dx = FIELD.w/2 + 8 - ball.position.x;
    const dz = -ball.position.z * 0.35;
    const l = Math.hypot(dx,dz)||1;
    kick(dx/l, dz/l, 31);
  } else if (a.pass) {
    const t = nearestTeammate();
    const dx = t.position.x - ball.position.x;
    const dz = t.position.z - ball.position.z;
    const l = Math.hypot(dx,dz)||1;
    kick(dx/l, dz/l, 21);
  }
}

function moveActor(actor, x, z, speed, dt) {
  const dx = x - actor.position.x, dz = z - actor.position.z;
  const d = Math.hypot(dx,dz);
  if (d > 0.08) {
    const step = Math.min(d, speed * dt);
    actor.position.x += dx/d * step;
    actor.position.z += dz/d * step;
    actor.rotation.y = Math.atan2(dx,dz);
  }
}

function update(dt) {
  if (state.over) return;
  state.time = Math.max(0, state.time - dt);

  const sprint = state.actions.sprint;
  const speed = sprint ? 13.5 : 9.3;
  const jx = state.joy.x, jz = state.joy.y;
  moveActor(player, player.position.x + jx, player.position.z + jz, speed, dt);
  player.position.x = THREE.MathUtils.clamp(player.position.x, -FIELD.w/2+2, FIELD.w/2-2);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -FIELD.d/2+2, FIELD.d/2-2);

  mates.forEach((p,i)=>{
    const targetX = p.userData.homeX + (ball.position.x - p.userData.homeX) * 0.22;
    const targetZ = p.userData.homeZ + (ball.position.z - p.userData.homeZ) * 0.22;
    moveActor(p,targetX,targetZ,5.0,dt);
  });
  foes.forEach((p,i)=>{
    const chase = i===5 || p.position.distanceTo(ball.position) < 18;
    const tx = chase ? ball.position.x : p.userData.homeX;
    const tz = chase ? ball.position.z : p.userData.homeZ;
    moveActor(p,tx,tz,5.6,dt);
  });

  const bx = ball.position.x - player.position.x, bz = ball.position.z - player.position.z;
  if (Math.hypot(bx,bz) < 1.8 && Math.abs(ball.userData.vx)+Math.abs(ball.userData.vz)<2.5) {
    ball.userData.vx = jx * 4.2;
    ball.userData.vz = jz * 4.2;
  }

  ball.position.x += ball.userData.vx * dt;
  ball.position.z += ball.userData.vz * dt;
  ball.userData.vx *= Math.pow(0.985, dt*60);
  ball.userData.vz *= Math.pow(0.985, dt*60);
  ball.rotation.x += ball.userData.vz * dt * 1.8;
  ball.rotation.z -= ball.userData.vx * dt * 1.8;

  const side = FIELD.w/2 - 0.5, end = FIELD.d/2 - 0.5;
  if (ball.position.z < -end || ball.position.z > end) {
    ball.position.z = THREE.MathUtils.clamp(ball.position.z,-end,end);
    ball.userData.vz *= -0.78;
  }
  if (ball.position.x < -side || ball.position.x > side) {
    const inGoal = Math.abs(ball.position.z) < FIELD.goalW/2;
    if (inGoal) {
      const homeGoal = ball.position.x > side;
      state.score[homeGoal ? 0 : 1]++;
      scoreEl.textContent = state.score.join(" - ");
      reset(homeGoal ? "GOAL!" : "AWAY GOAL");
    } else {
      ball.position.x = THREE.MathUtils.clamp(ball.position.x,-side,side);
      ball.userData.vx *= -0.78;
    }
  }

  goalkeepers.forEach((g,i)=>{
    g.position.z = THREE.MathUtils.clamp(ball.position.z,-FIELD.goalW/2+1,FIELD.goalW/2-1);
    g.rotation.y = i===0 ? -Math.PI/2 : Math.PI/2;
  });

  const target = new THREE.Vector3(player.position.x, 0, player.position.z);
  const desired = new THREE.Vector3(target.x - 13, 19, target.z + 18);
  camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
  camera.lookAt(target.x + 6, 0, target.z);
  state.actions = {};

  if (state.time <= 0) {
    state.over = true;
    msg.textContent = `FULL TIME  ${state.score[0]} - ${state.score[1]}  (SHOOTで再開)`;
  }
}

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
}
addEventListener("resize", resize);
resize();

const stick = document.querySelector("#stick");
const knob = document.querySelector("#knob");
let pointerId = null;

function joy(e) {
  const r = stick.getBoundingClientRect();
  let x = e.clientX - (r.left + r.width/2);
  let y = e.clientY - (r.top + r.height/2);
  const max = r.width * 0.34;
  const l = Math.hypot(x,y) || 1;
  const k = Math.min(1,max/l);
  state.joy.x = x/l*k;
  state.joy.y = y/l*k;
  knob.style.transform = `translate(${x*k}px,${y*k}px)`;
}
stick.addEventListener("pointerdown", e=>{ pointerId=e.pointerId; stick.setPointerCapture(pointerId); joy(e); });
stick.addEventListener("pointermove", e=>{ if(e.pointerId===pointerId) joy(e); });
function stopJoy(){ pointerId=null; state.joy={x:0,y:0}; knob.style.transform=""; }
stick.addEventListener("pointerup",stopJoy);
stick.addEventListener("pointercancel",stopJoy);

document.querySelectorAll("[data-action]").forEach(button=>{
  const a=button.dataset.action;
  button.addEventListener("pointerdown",e=>{
    e.preventDefault();
    state.actions[a]=true;
    if(state.over && a==="shoot"){ state.over=false; state.score=[0,0]; state.time=180; scoreEl.textContent="0 - 0"; reset(); }
  });
  button.addEventListener("pointerup",()=>state.actions[a]=false);
  button.addEventListener("pointercancel",()=>state.actions[a]=false);
});

let last = performance.now();
function loop(now) {
  const dt=Math.min(0.033,(now-last)/1000);
  last=now;
  action();
  update(dt);
  clockEl.textContent=`${String(Math.floor(state.time/60)).padStart(2,"0")}:${String(Math.floor(state.time%60)).padStart(2,"0")}`;
  renderer.render(scene,camera);
  requestAnimationFrame(loop);
}
reset();
requestAnimationFrame(loop);
