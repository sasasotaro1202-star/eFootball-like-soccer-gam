import { PLAYER_POOL } from "./player-pool.generated.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s), screens={home:$("#homeScreen"),panel:$("#panelScreen"),match:$("#matchScreen")};
const state={gp:+localStorage.getItem("football_gp")||10000,coins:+localStorage.getItem("football_coins")||100,owned:JSON.parse(localStorage.getItem("football_owned")||"[]")};
let cloudUser=null;
const localSave=()=>{localStorage.setItem("football_gp",state.gp);localStorage.setItem("football_coins",state.coins);localStorage.setItem("football_owned",JSON.stringify(state.owned))};
const cloudSave=async()=>{if(!cloudUser)return;const {error}=await supabase.from("game_saves").upsert({user_id:cloudUser.id,gp:state.gp,coins:state.coins,owned_player_ids:state.owned});if(error)console.warn("Supabase save skipped",error.message)};
const save=()=>{localSave();void cloudSave()};
async function initCloudSave(){
  try{
    let {data:{session}}=await supabase.auth.getSession();
    if(!session){
      const r=await supabase.auth.signInAnonymously();
      session=r.data?.session||null;
    }
    cloudUser=session?.user||null;
    if(!cloudUser)return;
    const {data,error}=await supabase.from("game_saves").select("gp,coins,owned_player_ids").eq("user_id",cloudUser.id).maybeSingle();
    if(error){console.warn("Supabase load skipped",error.message);return}
    if(data){
      state.gp=Number.isFinite(data.gp)?data.gp:state.gp;
      state.coins=Number.isFinite(data.coins)?data.coins:state.coins;
      state.owned=Array.isArray(data.owned_player_ids)?data.owned_player_ids:state.owned;
      localSave();wallet();
    }else{
      await cloudSave();
    }
  }catch(e){console.warn("Supabase unavailable; local save remains active",e?.message||e)}
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])), money=n=>Math.max(0,Math.floor(n)).toLocaleString("ja-JP");
function wallet(){$("#gp").textContent=money(state.gp);$("#gp2").textContent=money(state.gp);$("#coins").textContent=money(state.coins);$("#ownedCount").textContent=state.owned.length}
function screen(n){Object.values(screens).forEach(x=>x.classList.remove("active"));screens[n].classList.add("active");document.body.classList.toggle("inMatch",n==="match");}
function playerStats(p){const o=Number(p.overall)||80,pos=p.position;return{pace:clampStat(o+(pos==="FW"?4:pos==="DF"?-2:0)),shot:clampStat(o+(pos==="FW"?5:pos==="GK"?-18:0)),pass:clampStat(o+(pos==="MF"?5:0)),drib:clampStat(o+(pos==="FW"||pos==="MF"?3:-2)),def:clampStat(o+(pos==="DF"?6:pos==="GK"?8:-16)),phys:clampStat(o+(pos==="DF"?3:0))}}\nfunction clampStat(v){return Math.max(45,Math.min(99,Math.round(v)))}\nfunction playerArchetype(p){return p.position==="FW"?"Goal Poacher":p.position==="MF"?"Creative Playmaker":p.position==="DF"?"Build Up":"Offensive Goalkeeper"}\nfunction card(p){const s=playerStats(p);return `<article class="playerCardItem ${String(p.rarity).toLowerCase()}"><div class="cardRating"><b>${p.overall}</b><small>${esc(p.position)}</small></div><div class="cardPortrait"><span>${esc((p.name||"P").split(" ").map(x=>x[0]).join("").slice(0,2))}</span></div><span class="rarity">${esc(p.rarity)}</span><strong>${esc(p.name)}</strong><span>${esc(playerArchetype(p))}</span><small>${esc(p.nation||"World")} • PAC ${s.pace} • SHO ${s.shot} • PAS ${s.pass}</small></article>`}
function panel(kind){
 const title={gacha:"GACHA",squad:"SQUAD",collection:"COLLECTION",training:"TRAINING"}[kind]||"MENU";$("#panelTitle").textContent=title;$("#panelSubtitle").textContent={gacha:"LEGENDARY PLAYER DRAW",squad:"TACTICAL TEAM MANAGEMENT",collection:"YOUR PLAYER ARCHIVE",training:"PLAYER DEVELOPMENT"}[kind]||"";screen("panel");
 if(kind==="gacha"){const f=PLAYER_POOL.filter(p=>p.rarity==="LEGEND").slice(0,8);$("#panelBody").innerHTML=`<div class="gachaHero"><div><span class="eyebrow">SPECIAL DRAW</span><h2>LEGENDARY<br>SHOWCASE</h2><p>Historical player pool with a 2,000-player generated database.</p></div><div class="gachaOrb">✦</div></div><div class="drawRow"><button class="drawBtn" data-draw="1">DRAW ×1<small>100 ◆</small></button><button class="drawBtn gold" data-draw="10">DRAW ×10<small>900 ◆</small></button></div><div class="sectionTitle">FEATURED LEGENDS <span>${PLAYER_POOL.length.toLocaleString()} PLAYERS</span></div><div class="playerGrid">${f.map(card).join("")}</div>`;document.querySelectorAll("[data-draw]").forEach(b=>b.onclick=()=>draw(+b.dataset.draw));return}
 if(kind==="squad"){const ps=PLAYER_POOL.slice(0,11);$("#panelBody").innerHTML=`<div class="formation"><div class="pitchMini">${ps.map((p,i)=>`<div class="miniPlayer" style="--i:${i}">${esc(p.name.split(" ").pop())}</div>`).join("")}</div><div class="formationInfo"><span>4-3-3</span><b>WORLD XI</b><small>Possession • Balanced</small></div></div><div class="sectionTitle">STARTING XI <span>11 / 11</span></div><div class="playerList">${ps.map((p,i)=>{const s=playerStats(p);return `<div class="listRow"><b>${p.overall}</b><span><strong>${esc(p.name)}</strong><small>${esc(playerArchetype(p))}</small></span><small>PAC ${s.pace} • PAS ${s.pass} • SHO ${s.shot}</small></div>`}).join("")}</div><button class="primary wide" id="squadPlay">PLAY WITH THIS XI</button>`;$("#squadPlay").onclick=start;return}
 if(kind==="collection"){const own=new Set(state.owned),ps=PLAYER_POOL.filter(p=>own.has(p.id));$("#panelBody").innerHTML=`<div class="collectionStats"><div><b>${ps.length}</b><small>OWNED</small></div><div><b>${PLAYER_POOL.length}</b><small>DATABASE</small></div><div><b>${Math.round(ps.length/PLAYER_POOL.length*100)}%</b><small>COLLECTED</small></div></div><div class="sectionTitle">PLAYER ARCHIVE</div><div class="playerGrid">${(ps.length?ps:PLAYER_POOL.slice(0,8)).map(card).join("")}</div>`;return}
 $("#panelBody").innerHTML=`<div class="trainingHero"><span class="eyebrow">PLAYER DEVELOPMENT</span><h2>TRAINING<br>CENTER</h2><p>Spend GP to develop the squad. Progress is stored locally on this device.</p><div class="trainingStat"><span>TEAM LEVEL</span><b>${Math.min(99,80+Math.floor(state.owned.length/5))}</b></div><div class="trainingStat"><span>GP</span><b>${money(state.gp)}</b></div></div><button class="primary wide" id="trainingReward">CLAIM DAILY +500 GP</button>`;$("#trainingReward").onclick=()=>{state.gp+=500;save();wallet();panel("training")}
}
function pickPlayer(){const r=Math.random(),pool=r<.03?PLAYER_POOL.filter(p=>p.rarity==="LEGEND"):r<.18?PLAYER_POOL.filter(p=>p.rarity==="EPIC"):r<.45?PLAYER_POOL.filter(p=>p.rarity==="HIGHLIGHT"):PLAYER_POOL;return pool[Math.floor(Math.random()*pool.length)]||PLAYER_POOL[0]}
function showSigning(results){const stage=$("#gachaStage");if(!stage)return;const p=results[results.length-1];$("#stageName").textContent=p.name;$("#stageRarity").textContent=p.rarity+" • "+p.position+" • "+p.overall;$("#gachaResult").innerHTML=results.map(x=>`<div class="miniResult"><b>${esc(x.name)}</b><small>${esc(x.rarity)} • ${x.overall}</small></div>`).join("");stage.classList.add("show");setTimeout(()=>stage.classList.remove("show"),2600)}
function draw(n){const cost=n===10?900:100;if(state.coins<cost){showMessage("コインが足りません");return}state.coins-=cost;const results=[];for(let i=0;i<n;i++){const p=pickPlayer();results.push(p);if(p&&!state.owned.includes(p.id))state.owned.push(p.id)}state.gp+=n*120;save();wallet();showSigning(results);setTimeout(()=>panel("gacha"),2800)}
function showMessage(t){let el=$("#panelBody");if(el){const old=el.querySelector(".drawMessage");if(old)old.remove();const x=document.createElement("div");x.className="drawMessage";x.textContent=t;el.prepend(x);setTimeout(()=>x.remove(),1600)}}
function start(){screen("match");window.dispatchEvent(new Event("football:match-start"));dispatchEvent(new Event("resize"))}function home(){screen("home")}
$("#playNow").onclick=start;$("#matchExit").onclick=home;$("#panelBack").onclick=home;
document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>b.dataset.nav==="home"?home():panel(b.dataset.nav));wallet();void initCloudSave();