import * as THREE from "three";

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

function makePlayer(team,number,controlled=false){
 const g=new THREE.Group(),body=cyl(.58,1.5,team,0,2.02,0);
 g.add(body,cyl(.38,.76,skin,0,3.2,0),cyl(.4,.24,hair,0,3.65,0));
 g.add(box(.22,1,.22,team,-.76,2.08,0),box(.22,1,.22,team,.76,2.08,0));
 g.add(box(.28,1.15,.3,black,-.28,.72,0),box(.28,1.15,.3,black,.28,.72,0));
 g.add(box(.32,.18,.62,white,-.28,.14,-.18),box(.32,.18,.62,white,.28,.14,-.18));
 const ring=new THREE.Mesh(new THREE.RingGeometry(.72,.9,32),new THREE.MeshBasicMaterial({color:controlled?0xffdf3f:0xffffff,transparent:true,opacity:.75,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.04;g.add(ring);
 g.userData={number,homeX:0,homeZ:0,stamina:100,controlled,team};scene.add(g);return g;
}
const player=makePlayer(blue,10,true);
const mates=Array.from({length:10},(_,i)=>makePlayer(blue,[1,2,3,4,5,6,7,8,9,11][i]));
const foes=Array.from({length:11},(_,i)=>makePlayer(red,[1,2,3,4,5,6,7,8,9,10,11][i]));
const homePos=[[-44,0],[-36,-22],[-36,22],[-18,-25],[-18,-9],[-18,9],[-18,25],[4,-25],[7,-8],[7,8],[4,25]];
const awayPos=[[44,0],[36,-22],[36,22],[18,-25],[18,-9],[18,9],[18,25],[-4,-25],[-7,-8],[-7,8],[-4,25]];
mates.forEach((p,i)=>{p.position.set(...homePos[i],0);p.userData.homeX=homePos[i][0];p.userData.homeZ=homePos[i][1]});
foes.forEach((p,i)=>{p.position.set(...awayPos[i],0);p.userData.homeX=awayPos[i][0];p.userData.homeZ=awayPos[i][1]});
player.position.set(-40,0,0);player.userData.homeX=-40;player.userData.homeZ=0;
const gks=[makePlayer(white,1),makePlayer(white,1)];gks[0].scale.setScalar(.94);gks[1].scale.setScalar(.94);
const ball=new THREE.Mesh(new THREE.SphereGeometry(.48,16,12),ballMat);ball.castShadow=true;ball.position.set(0,.48,0);ball.userData={vx:0,vz:0,owner:null};scene.add(ball);

function allHome(){return [player,...mates]}
function controlled(){return allHome()[state.selected]}
function selectPlayer(n){
 state.selected=n%allHome().length;
 allHome().forEach((p,i)=>p.userData.controlled=i===state.selected);
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
 ball.userData.owner=null;ball.userData.vx=x/l*power;ball.userData.vz=z/l*power;state.kickLock=performance.now()+260
}
function actions(){
 const a=state.actions,p=controlled();
 if(a.switch){selectPlayer(state.selected+1);state.actions.switch=false}
 if(a.pass){const t=nearestMate();kickTo(t.position.x,t.position.z,22);state.actions.pass=false}
 if(a.shoot){kickTo(53,-p.position.z*.35,32);state.actions.shoot=false}
 if(a.tackle&&performance.now()>state.tackleLock){
   state.tackleLock=performance.now()+650;
   let target=foes.reduce((b,x)=>dist(x,p)<dist(b,p)?x:b,foes[0]);
   if(dist(target,p)<4.2){ball.userData.owner=null;const dx=target.position.x-p.position.x,dz=target.position.z-p.position.z,l=Math.hypot(dx,dz)||1;ball.position.set(target.position.x,target.position.y+.5,target.position.z);ball.userData.vx=dx/l*10;ball.userData.vz=dz/l*10}
   state.actions.tackle=false
 }
}
function update(dt){
 if(state.over)return;
 state.time=Math.max(0,state.time-dt);
 const p=controlled(),sprint=state.actions.sprint,s=(sprint?14:9.2)*(p.userData.stamina>0?1:.65);
 if(sprint)p.userData.stamina=Math.max(0,p.userData.stamina-20*dt);else p.userData.stamina=Math.min(100,p.userData.stamina+8*dt);
 move(p,p.position.x+state.joy.x,p.position.z+state.joy.y,s,dt);p.position.x=THREE.MathUtils.clamp(p.position.x,-51,51);p.position.z=THREE.MathUtils.clamp(p.position.z,-32,32);
 mates.forEach((m,i)=>{const q=homePos[i],tx=q[0]+(ball.position.x-q[0])*.18,tz=q[1]+(ball.position.z-q[1])*.18;move(m,tx,tz,5.0,dt)});
 foes.forEach((f,i)=>{const chase=i===0||dist(f,ball)<15,tx=chase?ball.position.x:f.userData.homeX,tz=chase?ball.position.z:f.userData.homeZ;move(f,tx,tz,5.6,dt)});
 const owner=ball.userData.owner;
 if(owner){
   ball.position.x=owner.position.x+Math.sin(owner.rotation.y)*.9;ball.position.z=owner.position.z+Math.cos(owner.rotation.y)*.9;ball.position.y=.5;
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