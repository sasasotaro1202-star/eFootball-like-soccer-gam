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
  lastGoalAt: 0,
  cameraMode: "broadcast",
  rightGesture: null,
  leftPointerId: null,
  lastTouchAt: 0
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

function makePlayer(team, index, role) {
  const g = new THREE.Group();
  const shirtColor = team === HOME ? 0x2e72e5 : 0xd83c55;
  const shortsColor = team === HOME ? 0x173c79 : 0x771827;
  const skinColor = 0xd49a78;

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.58, 1.18, 4, 8), mat(shirtColor, 0.7));
  torso.position.y = 1.28;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8), mat(skinColor, 0.85));
  head.position.y = 2.36;
  g.add(head);

  for (const x of [-0.21, 0.21]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.6, 3, 6), mat(shortsColor, 0.78));
    leg.position.set(x, 0.62, 0);
    g.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.46), mat(0x11151a, 0.55));
    boot.position.set(x, 0.22, 0.1);
    g.add(boot);
  }

  const selector = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 0.82, 32),
    new THREE.MeshBasicMaterial({
      color: team === HOME ? 0x71b7ff : 0xff7f91,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    })
  );
  selector.rotation.x = -Math.PI / 2;
  selector.position.y = 0.04;
  g.add(selector);

  g.userData = {
    team, index, role, number: index + 1,
    name: (team === HOME ? homePool[index % homePool.length] : PLAYER_POOL[(11 + index) % PLAYER_POOL.length])?.name || `PLAYER ${index + 1}`,
    speed: role === "GK" ? 4.0 : 5.0 + Math.random() * 0.7,
    stamina: 100,
    homeX: 0, homeZ: 0,
    aiSeed: Math.random() * 10,
    selectedRing: selector
  };
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

  // Intentionally no stadium walls/stands in the render volume.
  // Keeping the presentation volume empty prevents clipping artifacts on mobile GPUs.
}

function buildBall() {
  ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 18, 12),
    mat(0xf4f6f4, 0.5)
  );
  ball.position.set(0, 0.48, 0);
  ball.userData = { owner: null, vx: 0, vy: 0, vz: 0, lastTeam: HOME };
  scene.add(ball);
}

function resetPositions(kickoffTeam = HOME) {
  for (const p of players) {
    p.position.set(p.userData.homeX, 0, p.userData.homeZ);
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
  playerLabel.textContent = p.userData.name;
  playerNo.textContent = "#" + p.userData.number;
  playerRole.textContent = p.userData.role;
}

function initBallPossession() {
  ball.userData.owner = home[9];
  ball.position.set(home[9].position.x, 0.48, home[9].position.z + 0.8);
}

function moveControlled(dt) {
  const p = home[state.selected];
  if (!p) return;
  const mag = Math.hypot(state.joy.x, state.joy.y);
  if (mag < 0.04) return;

  const nx = state.joy.x / mag;
  const nz = state.joy.y / mag;
  const intensity = clamp(mag, 0, 1);
  const speed = p.userData.speed * intensity * (state.sprint ? 1.38 : 1);
  p.position.x = clamp(p.position.x + nx * speed * dt, -51, 51);
  p.position.z = clamp(p.position.z + nz * speed * dt, -32.5, 32.5);
  p.rotation.y = Math.atan2(nx, nz);
  p.userData.stamina = clamp(
    p.userData.stamina - (state.sprint ? 5.5 : 1.0) * dt,
    0,
    100
  );

  if (ball.userData.owner === p) {
    ball.position.set(
      p.position.x + Math.sin(p.rotation.y) * 0.78,
      0.48,
      p.position.z + Math.cos(p.rotation.y) * 0.78
    );
  }
}

function aiStep(dt) {
  const owner = ball.userData.owner;
  for (const p of players) {
    if (p === home[state.selected]) continue;

    let tx = p.userData.homeX;
    let tz = p.userData.homeZ;
    const d = dist(p, ball);

    if (owner) {
      const attacking = p.userData.team === owner.userData.team;
      if (p.userData.role === "GK") {
        tx = p.userData.homeX;
        tz = clamp(ball.position.z, -8, 8);
      } else if (attacking) {
        tx += clamp((ball.position.x * (p.userData.team === HOME ? 1 : -1)) * 0.18, -10, 12);
        tz += clamp((ball.position.z - p.userData.homeZ) * 0.16, -7, 7);
      } else {
        tx += clamp((ball.position.x * (p.userData.team === HOME ? 1 : -1)) * 0.1, -8, 8);
        tz += clamp((ball.position.z - p.userData.homeZ) * 0.14, -6, 6);
      }
    } else if (d < 12) {
      tx = ball.position.x;
      tz = ball.position.z;
    }

    const dx = tx - p.position.x;
    const dz = tz - p.position.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.3) {
      const speed = p.userData.speed * dt * clamp(len / 5, 0.22, 1);
      p.position.x += dx / len * speed;
      p.position.z += dz / len * speed;
      p.rotation.y = Math.atan2(dx, dz);
    }
    p.position.x = clamp(p.position.x, -51, 51);
    p.position.z = clamp(p.position.z, -32.5, 32.5);
  }

  // Lightweight opponent passing/attacking behavior.
  if (owner && owner.userData.team === AWAY && owner.userData.role !== "GK") {
    const target = away
      .filter((p) => p !== owner && p.userData.role !== "GK")
      .sort((a, b) => dist(owner, a) - dist(owner, b))[0];
    if (target && Math.random() < 0.006) kick(owner, target.position.x, target.position.z, 9.5);
  }
}

function kick(player, tx, tz, speed) {
  const dx = tx - ball.position.x;
  const dz = tz - ball.position.z;
  const len = Math.hypot(dx, dz) || 1;
  ball.userData.owner = null;
  ball.userData.lastTeam = player.userData.team;
  ball.userData.vx = dx / len * speed;
  ball.userData.vz = dz / len * speed;
  ball.userData.vy = Math.min(4.0, 1.1 + speed * 0.12);
}

function passOrShoot(mode, power = 0.8) {
  const p = home[state.selected];
  if (!p) return;

  if (ball.userData.owner !== p) {
    if (dist(p, ball) < 2.1) {
      ball.userData.owner = p;
      return;
    }
    return;
  }

  const dir = new THREE.Vector3(
    Math.sin(p.rotation.y),
    0,
    Math.cos(p.rotation.y)
  );
  let target;

  if (mode === "shoot") {
    target = new THREE.Vector3(53, 1.5, clamp(p.position.z, -8, 8));
  } else if (mode === "through") {
    target = new THREE.Vector3(clamp(p.position.x + 22, -48, 50), 0.8, clamp(p.position.z, -30, 30));
  } else {
    const candidates = home
      .filter((x) => x !== p && x.userData.role !== "GK")
      .map((x) => ({ p: x, score: x.position.x - p.position.x + Math.abs(x.position.z - p.position.z) * 0.08 }))
      .sort((a, b) => b.score - a.score);
    target = candidates[0]?.p?.position?.clone() || p.position.clone().add(dir.multiplyScalar(10));
  }

  const dx = target.x - ball.position.x;
  const dz = target.z - ball.position.z;
  const len = Math.hypot(dx, dz) || 1;
  const speed = (mode === "shoot" ? 18 : mode === "through" ? 13.5 : 10) * clamp(power, 0.35, 1.15);

  ball.userData.owner = null;
  ball.userData.lastTeam = HOME;
  ball.userData.vx = dx / len * speed;
  ball.userData.vz = dz / len * speed;
  ball.userData.vy = mode === "shoot" ? 1.5 + power * 2.0 : mode === "through" ? 0.55 + power * 0.9 : 0.7 + power * 1.2;
  navigator.vibrate?.(mode === "shoot" ? [20, 25, 20] : 12);
  showMessage(mode === "shoot" ? "SHOOT" : mode === "through" ? "THROUGH" : "PASS", 450);
}

function touchBall() {
  if (ball.userData.owner) {
    const p = ball.userData.owner;
    ball.position.set(
      p.position.x + Math.sin(p.rotation.y) * 0.78,
      0.48,
      p.position.z + Math.cos(p.rotation.y) * 0.78
    );
    return;
  }

  let closest = null;
  let closestD = Infinity;
  for (const p of players) {
    const d = dist(p, ball);
    if (d < 1.65 && d < closestD && ball.position.y < 1.35) {
      closest = p;
      closestD = d;
    }
  }
  if (closest) {
    ball.userData.owner = closest;
    if (closest.userData.team === HOME) selectPlayer(closest.userData.index);
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
        if (ball.position.x > 0) state.score[HOME]++;
        else state.score[AWAY]++;
        state.lastGoalAt = now;
        updateScore();
        showMessage("GOAL", 1300);
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
  const total = Math.floor(state.time);
  const min = String(Math.floor(total / 60)).padStart(2, "0");
  const sec = String(total % 60).padStart(2, "0");
  clockEl.textContent = min + ":" + sec;

  const p = home[state.selected];
  if (p) staminaFill.style.width = p.userData.stamina.toFixed(1) + "%";
  stateEl.textContent = state.paused ? "PAUSED" : "LIVE";
  updateRadar();
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
  state.leftPointerId = e.pointerId;
  state.leftStart = { x: e.clientX, y: e.clientY };
  state.lastTouchAt = performance.now();
  $("#stick").setPointerCapture?.(e.pointerId);
}

function leftMove(e) {
  if (e.pointerId !== state.leftPointerId || !state.leftStart) return;
  e.preventDefault();
  setJoyFromPointer(e, state.leftStart);
}

function leftUp(e) {
  if (e.pointerId !== state.leftPointerId) return;
  e.preventDefault();
  state.leftPointerId = null;
  state.leftStart = null;
  state.joy.x = 0;
  state.joy.y = 0;
  state.sprint = false;
  updateJoystickVisual();
}

function rightDown(e) {
  if (!pointerIsGameplay(e)) return;
  e.preventDefault();
  state.rightGesture = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    startX: e.clientX,
    startY: e.clientY,
    downAt: performance.now()
  };
}

function rightUp(e) {
  const g = state.rightGesture;
  if (!g || g.id !== e.pointerId) return;
  const dx = e.clientX - g.startX;
  const dy = e.clientY - g.startY;
  const mag = Math.hypot(dx, dy);
  state.rightGesture = null;

  if (mag < 22) {
    passOrShoot("pass", 0.72);
    return;
  }
  if (dy < -20 && Math.abs(dy) > Math.abs(dx) * 1.05) {
    passOrShoot("shoot", clamp(mag / 90, 0.45, 1.15));
  } else if (dy > 20 && Math.abs(dy) > Math.abs(dx) * 1.05) {
    passOrShoot("through", clamp(mag / 90, 0.5, 1.1));
  } else {
    passOrShoot("pass", clamp(mag / 90, 0.45, 1.1));
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
  let x = 0, y = 0;
  const keys = new Set(window.__keys || []);
  if (keys.has("a") || keys.has("arrowleft")) x -= 1;
  if (keys.has("d") || keys.has("arrowright")) x += 1;
  if (keys.has("w") || keys.has("arrowup")) y -= 1;
  if (keys.has("s") || keys.has("arrowdown")) y += 1;
  if (x || y) {
    const len = Math.hypot(x, y);
    state.joy.x = x / len;
    state.joy.y = y / len;
  }
}

function initInput() {
  window.__keys = [];
  addEventListener("keydown", (e) => {
    if (!window.__keys.includes(e.key.toLowerCase())) window.__keys.push(e.key.toLowerCase());
    keyboardDown(e);
  });
  addEventListener("keyup", (e) => {
    window.__keys = window.__keys.filter((k) => k !== e.key.toLowerCase());
    keyboardUp(e);
  });

  const stick = $("#stick");
  stick.addEventListener("pointerdown", leftDown, { passive: false });
  stick.addEventListener("pointermove", leftMove, { passive: false });
  stick.addEventListener("pointerup", leftUp, { passive: false });
  stick.addEventListener("pointercancel", leftUp, { passive: false });

  mount.addEventListener("pointerdown", rightDown, { passive: false });
  mount.addEventListener("pointerup", rightUp, { passive: false });
  mount.addEventListener("pointercancel", rightUp, { passive: false });
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

function gameLoop(now) {
  const dt = Math.min(0.033, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;

  keyboardMove();
  if (!state.paused) {
    state.time += dt;
    moveControlled(dt);
    aiStep(dt);
    physics(dt);
    touchBall();
    updateBroadcastCamera(dt);
  }

  updateHUD();
  renderer.render(scene, camera);
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
    window.__gameVersion = "home-shell-20260920-01";
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

bootGame();
