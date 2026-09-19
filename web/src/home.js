import { PLAYER_POOL } from "./player-pool.generated.js";
const $=s=>document.querySelector(s), screens={home:$("#homeScreen"),panel:$("#panelScreen"),match:$("#matchScreen")};
// Robust UI binding: event delegation keeps navigation working even after panel DOM is rebuilt.
document.addEventListener("click",(e)=>{
  const b=e.target.closest("button");
  if(!b)return;
  const nav=b.dataset?.nav;
  if(nav){e.preventDefault();e.stopPropagation();if(nav==="home")home();else if(["gacha","squad","collection","training","missions","extras"].includes(nav))panel(nav);return;}
  if(b.id==="quickPlay"||b.id==="playNow"||b.id==="squadPlay"){e.preventDefault();e.stopPropagation();start();return;}
  if(b.id==="panelBack"||b.id==="matchExit"){e.preventDefault();e.stopPropagation();home();return;}
  if(b.dataset?.draw){e.preventDefault();e.stopPropagation();draw(Number(b.dataset.draw),Number(b.dataset.cost)||100);return;}
  if(b.dataset?.free){e.preventDefault();e.stopPropagation();draw(1,0,true);return;}
});


// Original card system: 1–5★ with 5★ as the strongest base rank.
// Limited strength: NORMAL < HIGHLIGHT < SHOWTIME = EPIC = LEGEND < BIG TIME.
const CARD_TYPES=[{id:"STANDARD",label:"NORMAL",mult:1,stars:1},{id:"HIGHLIGHT",label:"HIGHLIGHT",mult:1.035,stars:4},{id:"SHOWTIME",label:"SHOWTIME",mult:1.06,stars:5},{id:"EPIC",label:"EPIC",mult:1.06,stars:5},{id:"LEGEND",label:"LEGEND",mult:1.06,stars:5},{id:"BIG_TIME",label:"BIG TIME",mult:1.10,stars:5}];
const CARD_RANK={STANDARD:1,HIGHLIGHT:2,SHOWTIME:3,EPIC:3,LEGEND:3,BIG_TIME:4};
const starFor=o=>Math.max(1,Math.min(5,Math.ceil((Number(o)||60)/20)));
const typeByLegacy=r=>String(r||"STANDARD").toUpperCase()==="LEGEND"?"LEGEND":String(r||"STANDARD").toUpperCase()==="EPIC"?"EPIC":"STANDARD";
const CARD_POOL=PLAYER_POOL.flatMap(p=>{
 const baseType=typeByLegacy(p.rarity),variants=[{type:baseType,star:Math.max(starFor(p.overall),baseType==="STANDARD"?1:5)}];
 if(baseType==="STANDARD")variants.push({type:"HIGHLIGHT",star:4},{type:"SHOWTIME",star:5},{type:"EPIC",star:5},{type:"LEGEND",star:5},{type:"BIG_TIME",star:5});
 if(baseType==="EPIC")variants.push({type:"SHOWTIME",star:5},{type:"LEGEND",star:5},{type:"BIG_TIME",star:5});
 if(baseType==="LEGEND")variants.push({type:"SHOWTIME",star:5},{type:"EPIC",star:5},{type:"BIG_TIME",star:5});
 return variants.map((v,i)=>{const t=CARD_TYPES.find(x=>x.id===v.type)||CARD_TYPES[0],o=Math.min(99,Math.max(45,Math.round(Number(p.overall)*t.mult+(v.type==="BIG_TIME"?1:0))));return {...p,id:String(p.id)+"-"+v.type.toLowerCase(),baseId:p.id,rarity:v.type,cardType:v.type,cardLabel:t.label,star:v.star,overall:o,sourceRarity:p.rarity,variantIndex:i}});
});
const rarityRank=r=>CARD_RANK[String(r||"STANDARD").toUpperCase()]||1;
const rarityLabel=r=>({STANDARD:"NORMAL",HIGHLIGHT:"HIGHLIGHT",SHOWTIME:"SHOWTIME",EPIC:"EPIC",LEGEND:"LEGEND",BIG_TIME:"BIG TIME"}[String(r||"STANDARD").toUpperCase()]||r);
const starText=n=>{n=Math.max(1,Math.min(5,Number(n)||1));return "★".repeat(n)+"☆".repeat(5-n)};
const state={gp:+localStorage.getItem("football_gp")||10000,coins:+localStorage.getItem("football_coins")||100,owned:JSON.parse(localStorage.getItem("football_owned")||"[]"),progress:JSON.parse(localStorage.getItem("football_progress")||"{}")};
const localSave=()=>{localStorage.setItem("football_gp",state.gp);localStorage.setItem("football_coins",state.coins);localStorage.setItem("football_owned",JSON.stringify(state.owned));localStorage.setItem("football_progress",JSON.stringify(state.progress))};
const save=()=>localSave();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])), money=n=>Math.max(0,Math.floor(n)).toLocaleString("ja-JP");
function wallet(){$("#gp").textContent=money(state.gp);$("#gp2").textContent=money(state.gp);$("#coins").textContent=money(state.coins);$("#ownedCount").textContent=state.owned.length}
function screen(n){Object.values(screens).forEach(x=>x.classList.remove("active"));screens[n].classList.add("active");document.body.classList.toggle("inMatch",n==="match");}
function getProgress(p){const x=state.progress[p.id]||{};return{level:Math.max(1,Math.min(x.level||1,x.maxLevel||30)),maxLevel:Math.max(30,x.maxLevel||30),xp:Math.max(0,x.xp||0),breakthrough:Math.max(0,Math.min(x.breakthrough||0,5)),points:Math.max(0,x.points||0),positions:x.positions||[p.position]}}
function playerStats(p){
 const o=Number(p.overall)||80,pos=p.position,x=getProgress(p),boost=x.level-1+x.breakthrough*2,cardBoost=(rarityRank(p.cardType||p.rarity)-1)*2+(p.cardType==="BIG_TIME"?2:0);
 const s={offAwareness:o,ballControl:o,dribbling:o,tightPossession:o,lowPass:o,loftedPass:o,finishing:o,heading:o,setPiece:o,curl:o,speed:o,acceleration:o,kickingPower:o,jumping:o,physicalContact:o,balance:o,stamina:o,gkAwareness:o,gkCatching:o,gkParrying:o,gkReflexes:o,gkReach:o};
 if(pos==="FW"){s.offAwareness+=5;s.finishing+=5;s.dribbling+=3;s.speed+=3}
 if(pos==="MF"){s.ballControl+=4;s.lowPass+=5;s.loftedPass+=3;s.tightPossession+=4}
 if(pos==="DF"){s.physicalContact+=5;s.heading+=4}
 if(pos==="GK"){s.gkAwareness+=7;s.gkCatching+=7;s.gkParrying+=7;s.gkReflexes+=7;s.gkReach+=6}
 Object.keys(s).forEach(k=>s[k]=clampStat(s[k]+boost+cardBoost));return s
}
function clampStat(v){return Math.max(45,Math.min(99,Math.round(v)))}
function playerArchetype(p){return p.position==="FW"?"Goal Poacher":p.position==="MF"?"Creative Playmaker":p.position==="DF"?"Build Up":"Offensive Goalkeeper"}
function positionMap(p){const base=p.position==="FW"?["CF","ST","LWF","RWF"]:p.position==="MF"?["AMF","CMF","DMF","LMF","RMF"]:p.position==="DF"?["CB","LB","RB","DMF"]:["GK"];const x=getProgress(p);return [...new Set([...base,...x.positions])].slice(0,5)}
function portraitSeed(p){let h=0;for(const ch of String(p.id)+String(p.name||""))h=(h*31+ch.charCodeAt(0))>>>0;return h}
function portraitSvg(p,large=false){
 const h=portraitSeed(p),skin=["#f2c6a5","#d99b72","#b96f4d","#8f573f"][h%4],hair=["#17191b","#3b2418","#6b4a2e","#8a8f95"][Math.floor(h/7)%4],shirt=["#183c5d","#49316a","#174b3d","#5b2830"][Math.floor(h/13)%4],rx=large?44:32,ry=large?54:40;
 return '<svg class="facePortrait" viewBox="0 0 120 140" role="img" aria-label="'+esc(p.name)+' portrait"><defs><linearGradient id="bgPortrait'+p.id+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#253b49"/><stop offset="1" stop-color="#0a1117"/></linearGradient></defs><rect width="120" height="140" rx="18" fill="url(#bgPortrait'+p.id+')"/><ellipse cx="60" cy="132" rx="43" ry="27" fill="'+shirt+'"/><rect x="48" y="91" width="24" height="22" rx="9" fill="'+skin+'"/><ellipse cx="60" cy="62" rx="'+rx+'" ry="'+ry+'" fill="'+skin+'"/><path d="M18 62Q20 14 60 15Q100 14 102 62Q89 40 75 38Q50 47 18 62Z" fill="'+hair+'"/><circle cx="45" cy="65" r="3" fill="#10151a"/><circle cx="75" cy="65" r="3" fill="#10151a"/><path d="M52 82Q60 87 68 82" fill="none" stroke="#7d4536" stroke-width="3" stroke-linecap="round"/><path d="M34 52Q45 45 53 51M67 51Q76 45 86 52" fill="none" stroke="'+hair+'" stroke-width="5" stroke-linecap="round"/><text x="60" y="126" text-anchor="middle" fill="#fff" opacity=".82" font-size="8" font-weight="800">'+esc(p.position)+'</text></svg>'
}
function portraitLetters(p){return esc((p.name||"P").split(" ").map(x=>x[0]).join("").slice(0,2))}
function card(p){
 const s=playerStats(p),x=getProgress(p),nextXp=x.level*100,type=rarityLabel(p.cardType||p.rarity),stars=p.star||starFor(p.overall);
 return `<article class="playerCardItem playerCardTap rarityCard rarity-${String(p.cardType||p.rarity).toLowerCase()}" data-player-id="${p.id}" data-rarity="${esc(p.cardType||p.rarity)}"><div class="cardRating"><b>${p.overall}</b><small>${esc(p.position)}</small></div><div class="cardPortrait photoPortrait"><span class="portraitGlow"></span>${portraitSvg(p,true)}<i>${starText(stars)}</i></div><div class="cardLevel">LV ${x.level}/${x.maxLevel}</div><span class="rarity">${esc(type)}</span><strong>${esc(p.name)}</strong><span>${esc(playerArchetype(p))}</span><small>${esc(p.nation||"World")} • ${starText(stars)}</small><div class="cardMeta"><span>POS ${positionMap(p).join(" / ")}</span><span>${type}</span></div><div class="cardMiniStats"><b>OFF ${s.offAwareness}</b><b>BC ${s.ballControl}</b><b>DRI ${s.dribbling}</b><b>FIN ${s.finishing}</b></div><div class="xpBar"><i style="width:${Math.min(100,x.xp/nextXp*100)}%"></i></div></article>`
}
function skillList(p){return p.position==="FW"?["First-time Shot","Acrobatic Finishing","One-touch Pass","Long Range Drive"]:p.position==="MF"?["One-touch Pass","Through Passing","Weighted Pass","Long Range Curler"]:p.position==="DF"?["Blocker","Interception","Man Marking","Aerial Superiority"]:["GK Low Punt","GK Long Throw","Penalty Saver","GK Reflexes"]}
function radarSvg(s){const vals=[s.speed,s.finishing,s.lowPass,s.dribbling,s.physicalContact,s.stamina],pts=vals.map((v,i)=>{const a=-Math.PI/2+i*Math.PI/3,r=12+(v-45)/54*48;return (60+Math.cos(a)*r).toFixed(1)+","+(60+Math.sin(a)*r).toFixed(1)}).join(" ");return `<svg class="statRadar" viewBox="0 0 120 120" role="img"><polygon points="60,12 101.6,36 101.6,84 60,108 18.4,84 18.4,36" class="radarGrid"/><polygon points="60,30 86,45 86,75 60,90 34,75 34,45" class="radarGrid"/><polygon points="${pts}" class="radarValue"/></svg>`}
function allStats(p){
 const s=playerStats(p),keys=[["OFF AWARENESS","offAwareness"],["BALL CONTROL","ballControl"],["DRIBBLING","dribbling"],["TIGHT POSSESSION","tightPossession"],["LOW PASS","lowPass"],["LOFTED PASS","loftedPass"],["FINISHING","finishing"],["HEADING","heading"],["SET PIECE","setPiece"],["CURL","curl"],["SPEED","speed"],["ACCELERATION","acceleration"],["KICKING POWER","kickingPower"],["JUMPING","jumping"],["PHYSICAL CONTACT","physicalContact"],["BALANCE","balance"],["STAMINA","stamina"]];
 if(p.position==="GK")keys.push(["GK AWARENESS","gkAwareness"],["GK CATCHING","gkCatching"],["GK PARRYING","gkParrying"],["GK REFLEXES","gkReflexes"],["GK REACH","gkReach"]);
 return keys.map(([k,v])=>[k,s[v]])
}
function positionDiagram(p){const ps=positionMap(p);return `<div class="positionDiagram"><div class="posPitch"><span class="posNode n1">${ps[0]||p.position}</span><span class="posNode n2">${ps[1]||""}</span><span class="posNode n3">${ps[2]||""}</span><span class="posNode n4">${ps[3]||""}</span><span class="posNode n5">${ps[4]||""}</span></div><div class="positionLegend">適性ポジション: ${ps.join(" / ")}</div></div>`}
function showPlayerDetail(id,compareId=null){const p=CARD_POOL.find(x=>String(x.id)===String(id));if(!p)return;const s=playerStats(p),x=getProgress(p),skills=skillList(p),comp=compareId?CARD_POOL.find(q=>String(q.id)===String(compareId)):null,compStats=comp?playerStats(comp):null;$("#panelTitle").textContent="PLAYER DETAIL";$("#panelSubtitle").textContent="選手情報 • 能力 • 育成 • 比較";screen("panel");$("#panelBody").innerHTML=`<div class="detailTop"><button class="detailBack" id="detailBack">← BACK</button><div class="detailIdentity"><div class="detailPortrait"><b>${portraitSvg(p,true)}</b><span>${esc(p.rarity)}</span></div><div><span class="eyebrow">${esc(p.rarity)}</span><h2>${esc(p.name)}</h2><p>${esc(p.nation||"World")} • ${esc(p.position)} • ${esc(playerArchetype(p))}</p><strong>OVR ${p.overall} · LV ${x.level}/${x.maxLevel}</strong></div></div></div><div class="detailGrid"><section class="detailBlock"><h3>ABILITY RADAR</h3>${radarSvg(s)}<div class="radarLegend"><span>PAC</span><span>SHO</span><span>PAS</span><span>DRI</span><span>DEF</span><span>PHY</span></div></section><section class="detailBlock"><h3>ALL ABILITIES</h3><div class="allStats">${allStats(p).map(([k,v])=>`<div><span>${k}</span><b>${v}</b><i><em style="width:${v}%"></em></i></div>`).join("")}</div></section></div><section class="detailBlock"><h3>POSITION SUITABILITY</h3>${positionDiagram(p)}</section><div class="detailGrid"><section class="detailBlock"><h3>PLAY STYLE</h3><div class="styleBadge">${esc(playerArchetype(p))}</div><h3>SKILLS</h3><div class="skillChips">${skills.map(q=>`<span>◆ ${q}</span>`).join("")}</div></section><section class="detailBlock"><h3>DEVELOPMENT TREE</h3><div class="devTree"><span class="active">BASE</span><b>→</b><span class="${x.points>0?"active":""}">PLAYER</span><b>→</b><span class="${x.level>=10?"active":""}">ELITE</span><b>→</b><span class="${x.breakthrough>=3?"active":""}">MAX</span></div><div class="detailProgress">LV ${x.level}/${x.maxLevel} · POINTS ${x.points} · LIMIT BREAK ${x.breakthrough}/5</div></section></div><section class="detailBlock"><h3>LIMIT BREAK</h3><div class="breakRow">${[0,1,2,3,4].map(i=>`<span class="${i<x.breakthrough?"on":""}">${i<x.breakthrough?"◆":"◇"} ${i+1}</span>`).join("")}</div><button class="primary wide" id="detailTraining">OPEN TRAINING</button></section><section class="detailBlock"><h3>PLAYER COMPARISON</h3><p class="muted">比較対象を選ぶと能力値を並べて確認できます。</p><div class="comparePick"><select id="compareSelect"><option value="">比較選手を選択</option>${CARD_POOL.filter(q=>q.id!==p.id).slice(0,120).map(q=>`<option value="${q.id}" ${comp?.id===q.id?"selected":""}>${esc(q.name)} · OVR ${q.overall}</option>`).join("")}</select><button class="primary" id="compareBtn">COMPARE</button></div>${comp?`<div class="compareTable"><div><b>${esc(p.name)}</b><b>STAT</b><b>${esc(comp.name)}</b></div>${[["SPEED",s.speed,compStats.speed],["FIN",s.finishing,compStats.finishing],["LOW PASS",s.lowPass,compStats.lowPass],["DRI",s.dribbling,compStats.dribbling],["PHY",s.physicalContact,compStats.physicalContact],["STA",s.stamina,compStats.stamina]].map(z=>`<div><strong>${z[1]}</strong><span>${z[0]}</span><strong>${z[2]}</strong></div>`).join("")}</div>`:""}</section>`;$("#detailBack").onclick=()=>panel("collection");$("#detailTraining").onclick=()=>panel("training");$("#compareBtn").onclick=()=>{const v=$("#compareSelect").value;if(v)showPlayerDetail(p.id,v)}}
function panel(kind){
 const title={gacha:"CONTRACT",squad:"GAME PLAN",collection:"MY TEAM",training:"PLAYER DEVELOPMENT",missions:"MISSIONS",extras:"EXTRAS"}[kind]||"MENU";$("#panelTitle").textContent=title;$("#panelSubtitle").textContent={gacha:"SPECIAL PLAYER LIST",squad:"TACTICAL TEAM MANAGEMENT",collection:"PLAYER ARCHIVE",training:"PLAYER DEVELOPMENT",missions:"DAILY OBJECTIVES",extras:"SETTINGS & INFO"}[kind]||"";screen("panel");
 if(kind==="missions"){const claimed=JSON.parse(localStorage.getItem("football_missions")||"{}");$("#panelBody").innerHTML=`<div class="detailBlock missionPanel"><span class="eyebrow">DAILY OBJECTIVES</span><h2>MISSIONS</h2><div class="missionRow"><div><b>PLAY A MATCH</b><small>Complete 1 match</small></div><button class="primary missionClaim" data-mission="match" ${claimed.match?"disabled":""}>${claimed.match?"CLAIMED":"+300 GP"}</button></div><div class="missionRow"><div><b>DEVELOP A PLAYER</b><small>Open Player Development</small></div><button class="primary missionClaim" data-mission="train" ${claimed.train?"disabled":""}>${claimed.train?"CLAIMED":"+200 GP"}</button></div><div class="missionRow"><div><b>VISIT CONTRACT</b><small>Open Special Player List</small></div><button class="primary missionClaim" data-mission="contract" ${claimed.contract?"disabled":""}>${claimed.contract?"CLAIMED":"+150 GP"}</button></div></div>`;document.querySelectorAll(".missionClaim").forEach(b=>b.onclick=()=>{const m=JSON.parse(localStorage.getItem("football_missions")||"{}");if(m[b.dataset.mission])return;m[b.dataset.mission]=1;localStorage.setItem("football_missions",JSON.stringify(m));state.gp+=Number(b.textContent.match(/\d+/)?.[0]||0);save();wallet();panel("missions")});return}
 if(kind==="extras"){$("#panelBody").innerHTML=`<div class="detailBlock"><span class="eyebrow">GAME SETTINGS</span><h2>EXTRAS</h2><div class="settingsRow"><b>GRAPHICS</b><span>Auto / Mobile Optimized</span></div><div class="settingsRow"><b>CONTROL</b><span>Touch + Flick</span></div><div class="settingsRow"><b>DATA</b><span>Local save • Free-first</span></div><div class="settingsRow"><b>ABOUT</b><span>Original browser football game</span></div></div>`;return}
 if(kind==="gacha"){renderGacha(activeBanner);return}
 if(kind==="squad"){const ps=CARD_POOL.filter(p=>p.star>=4).slice(0,11);$("#panelBody").innerHTML=`<div class="formation"><div class="pitchMini">${ps.map((p,i)=>`<div class="miniPlayer" style="--i:${i}">${esc(p.name.split(" ").pop())}</div>`).join("")}</div><div class="formationInfo"><span>4-3-3</span><b>WORLD XI</b><small>Possession • Balanced</small></div></div><div class="sectionTitle">STARTING XI <span>11 / 11</span></div><div class="playerList">${ps.map((p,i)=>{const s=playerStats(p);return `<div class="listRow"><b>${p.overall}</b><span><strong>${esc(p.name)}</strong><small>${esc(playerArchetype(p))}</small></span><small>SPD ${s.speed} • PAS ${s.lowPass} • FIN ${s.finishing}</small></div>`}).join("")}</div><button class="primary wide" id="squadPlay">PLAY WITH THIS XI</button>`;$("#squadPlay").onclick=start;return}
 if(kind==="collection"){const own=new Set(state.owned),ps=CARD_POOL.filter(p=>own.has(p.id));$("#panelBody").innerHTML=`<div class="collectionStats"><div><b>${ps.length}</b><small>OWNED</small></div><div><b>${CARD_POOL.length}</b><small>DATABASE</small></div><div><b>${Math.round(ps.length/CARD_POOL.length*100)}%</b><small>COLLECTED</small></div></div><div class="sectionTitle">PLAYER ARCHIVE</div><div class="playerGrid">${(ps.length?ps:CARD_POOL.slice(0,8)).map(card).join("")}</div>`;return}
 const target=CARD_POOL.find(p=>state.owned.includes(p.id))||CARD_POOL[0],tx=getProgress(target);$("#panelBody").innerHTML=`<div class="trainingHero"><span class="eyebrow">PLAYER DEVELOPMENT</span><h2>TRAINING<br>CENTER</h2><p>Level Training • Player Progression • Position Training • Limit Break</p><div class="trainingPlayer"><div class="trainingPortrait">${portraitSvg(target)}</div><div><b>${esc(target.name)}</b><small>${esc(playerArchetype(target))} • OVR ${target.overall}</small></div></div><div class="trainingStat"><span>LEVEL</span><b>${tx.level}/${tx.maxLevel}</b></div><div class="trainingStat"><span>PROGRESSION POINTS</span><b>${tx.points}</b></div><div class="trainingStat"><span>LIMIT BREAK</span><b>${tx.breakthrough}/5</b></div><div class="trainingPositions">${positionMap(target).map(q=>`<span>${q}</span>`).join("")}</div></div><div class="trainingActions"><button class="primary" id="levelTrain">LEVEL +1</button><button class="primary" id="limitBreak">BREAKTHROUGH</button></div><button class="primary wide" id="trainingReward">CLAIM DAILY +500 GP</button>`;$("#levelTrain").onclick=()=>{const x=getProgress(target);if(x.level<x.maxLevel){x.level++;x.points+=3;x.xp=0;state.progress[target.id]=x;save();panel("training")}};$("#limitBreak").onclick=()=>{const x=getProgress(target);if(x.breakthrough<5&&state.gp>=1000){state.gp-=1000;x.breakthrough++;x.maxLevel=Math.min(40,x.maxLevel+2);state.progress[target.id]=x;save();wallet();panel("training")}};$("#trainingReward").onclick=()=>{state.gp+=500;save();wallet();panel("training")}
}
const GACHA_BANNERS=[
 {id:"bigtime",title:"BIG TIME • MOMENT",sub:"記憶に残る一戦をモチーフにした最上位カード",rarities:["BIG_TIME"],cost:150},\n {id:"epic",title:"EPIC • SEASON ARCHIVE",sub:"特定シーズンを再現した特別カード",rarities:["EPIC","LEGEND","SHOWTIME"],cost:100},
 {id:"legend",title:"LEGEND • WORLD ICONS",sub:"歴代スターを集めた限定リスト",rarities:["LEGEND","BIG_TIME"],cost:120},
 {id:"showtime",title:"SHOWTIME • SPECIAL SKILL",sub:"特別なプレー特性をテーマにした限定カード",rarities:["SHOWTIME"],cost:100},\n {id:"highlight",title:"HIGHLIGHT • HOT FORM",sub:"好調期をテーマにしたピックアップ",rarities:["HIGHLIGHT","SHOWTIME"],cost:80},
 {id:"position",title:"POSITION SELECT",sub:"FW / MF / DF / GK から狙いを絞る",rarities:["STANDARD","HIGHLIGHT","EPIC"],cost:60}
];
let activeBanner="epic";
function bannerPool(id){
 const map={bigtime:["BIG_TIME"],epic:["EPIC","LEGEND","SHOWTIME","BIG_TIME"],legend:["LEGEND","BIG_TIME"],showtime:["SHOWTIME"],highlight:["HIGHLIGHT","SHOWTIME"],position:["STANDARD","HIGHLIGHT"]};
 const types=map[id]||["STANDARD"];const pool=CARD_POOL.filter(p=>types.includes(String(p.cardType||p.rarity).toUpperCase()));return pool.length?pool:CARD_POOL
}
function pickPlayer(){
 const pool=bannerPool(activeBanner),r=Math.random();
 const weights=activeBanner==="legend"?[["BIG_TIME",.01],["LEGEND",.045],["EPIC",.055],["SHOWTIME",.06],["HIGHLIGHT",.20],["STANDARD",.63]]
 :activeBanner==="epic"?[["BIG_TIME",.008],["LEGEND",.032],["EPIC",.06],["SHOWTIME",.06],["HIGHLIGHT",.24],["STANDARD",.60]]
 :activeBanner==="highlight"?[["BIG_TIME",.003],["LEGEND",.012],["EPIC",.025],["SHOWTIME",.05],["HIGHLIGHT",.40],["STANDARD",.51]]
 :[["BIG_TIME",.002],["LEGEND",.008],["EPIC",.015],["SHOWTIME",.025],["HIGHLIGHT",.30],["STANDARD",.65]];
 const available=weights.filter(([k])=>pool.some(p=>String(p.cardType||p.rarity).toUpperCase()===k));const total=available.reduce((a,x)=>a+x[1],0)||1;let a=0,tier=available[available.length-1]?.[0]||"STANDARD";for(const [k,w] of available){a+=w/total;if(r<a){tier=k;break}}const same=pool.filter(p=>String(p.cardType||p.rarity).toUpperCase()===tier);return same[Math.floor(Math.random()*same.length)]||pool[Math.floor(Math.random()*pool.length)]||CARD_POOL[0]
}
function renderGacha(kind="epic"){
 activeBanner=kind;const b=GACHA_BANNERS.find(x=>x.id===kind)||GACHA_BANNERS[0],pool=bannerPool(kind),featured=pool.slice(0,6);
 $("#panelBody").innerHTML=`<div class="gachaTabs">${GACHA_BANNERS.map(x=>`<button class="gachaTab ${x.id===kind?"active":""}" data-banner="${x.id}">${x.title.split(" • ")[0]}</button>`).join("")}</div><div class="gachaHero premiumGacha"><div><span class="eyebrow">SPECIAL PLAYER LIST</span><h2>${esc(b.title)}</h2><p>${esc(b.sub)}</p><div class="gachaBadges"><span>抽選確率表示</span><span>10連特典</span><span>重複は育成素材へ</span></div></div><div class="gachaOrb">✦</div></div><div class="drawRow"><button class="drawBtn" data-draw="1" data-cost="${b.cost}">DRAW ×1<small>${b.cost} ◆</small></button><button class="drawBtn gold" data-draw="10" data-cost="${b.cost}">DRAW ×10<small>${b.cost*9} ◆ • BONUS</small></button></div><div class="gachaSubRow"><button class="subGacha" data-free="1">DAILY FREE</button><button class="subGacha" data-box="1">BOX DRAW</button><button class="subGacha" data-rates="1">RATES</button></div><div class="sectionTitle">FEATURED PLAYERS <span>${pool.length} IN LIST</span></div><div class="playerGrid">${featured.map(card).join("")}</div>`;
 document.querySelectorAll("[data-banner]").forEach(btn=>btn.onclick=()=>renderGacha(btn.dataset.banner));document.querySelector("[data-box]")?.addEventListener("click",()=>showMessage("BOX DRAW: 30名から抽選する限定ボックスを準備中"));document.querySelector("[data-rates]")?.addEventListener("click",()=>showMessage("通常基準: STANDARD 65% • HIGHLIGHT 30% • SHOWTIME 2.5% • EPIC 1.5% • LEGEND 0.8% • BIG TIME 0.2%（バナーで変動）"));
}
const GACHA_PITY_KEY="football_gacha_pity";
const GACHA_FREE_KEY="football_gacha_free";
const gachaMeta=()=>{const p=JSON.parse(localStorage.getItem(GACHA_PITY_KEY)||"{}");return{pulls:Math.max(0,Number(p.pulls)||0),lastRarity:String(p.lastRarity||"").toUpperCase()}};
function setGachaMeta(p){localStorage.setItem(GACHA_PITY_KEY,JSON.stringify(p))}
function ensureGachaStage(){
  const stage=$("#gachaStage");if(!stage)return null;
  if(!stage.querySelector("#gachaSkip")){const b=document.createElement("button");b.id="gachaSkip";b.className="gachaSkip";b.textContent="SKIP";stage.appendChild(b);b.onclick=()=>finishGachaPresentation(true)}
  return stage;
}
let gachaPresentation={results:[],revealed:false,timers:[]};
function clearGachaTimers(){gachaPresentation.timers.forEach(clearTimeout);gachaPresentation.timers=[]}
function finishGachaPresentation(skip=false){
  const stage=ensureGachaStage();if(!stage)return;
  clearGachaTimers();
  const results=gachaPresentation.results;
  if(results.length){
    const p=results[results.length-1];
    $("#stageName").textContent=p.name;
    $("#stageRarity").textContent=p.rarity+" • "+p.position+" • OVR "+p.overall;
    $("#gachaResult").innerHTML=results.map((x,i)=>`<div class="miniResult revealCard rarity-${String(x.cardType||x.rarity).toLowerCase()}" style="--i:${i}"><span>${i+1}</span><b>${esc(x.name)}</b><small>${esc(rarityLabel(x.cardType||x.rarity))} • ${starText(x.star||5)} • OVR ${x.overall}</small></div>`).join("");
  }
  stage.classList.remove("charging","revealing");
  stage.classList.add("show","complete");
  const ms=skip?350:1500;
  gachaPresentation.timers.push(setTimeout(()=>{stage.onclick=null;stage.classList.remove("show","complete");panel("gacha")},ms));
}
function showSigning(results){
  const stage=ensureGachaStage();if(!stage)return;
  clearGachaTimers();gachaPresentation={results,revealed:false,timers:[]};
  const best=results.reduce((a,b)=>({overall:Math.max(Number(a?.overall)||0,Number(b?.overall)||0),rarity:(String(a?.rarity||"").length>String(b?.rarity||"").length?a?.rarity:b?.rarity)}),{});
  $("#stageName").textContent="PLAYER SIGNING";
  $("#stageRarity").textContent=results.length===10?"10 PLAYERS • TAP TO REVEAL":"TAP TO REVEAL";
  $("#gachaResult").innerHTML=`<div class="gachaPrompt"><span class="promptRing">✦</span><b>${results.length===10?"10× PLAYER DRAW":"PLAYER DRAW"}</b><small>カードをタップして開封</small></div>`;
  stage.classList.remove("complete");stage.classList.add("show","charging");
  gachaPresentation.timers.push(setTimeout(()=>{
    stage.classList.remove("charging");stage.classList.add("revealing");
    stage.onclick=(e)=>{if(e.target.closest("#gachaSkip"))return;if(e.target.closest(".gachaResult,.stageOrb,.stageName,.stageRarity"))revealGacha()};
  },850));
}
function revealGacha(){
  if(gachaPresentation.revealed)return;
  gachaPresentation.revealed=true;clearGachaTimers();
  const stage=ensureGachaStage(),results=gachaPresentation.results;
  const order=[...results].sort((a,b)=>{
    const rank={STANDARD:1,HIGHLIGHT:2,SHOWTIME:3,EPIC:3,LEGEND:3,BIG_TIME:4};
    return (rank[String(b.rarity).toUpperCase()]||0)-(rank[String(a.rarity).toUpperCase()]||0);
  });
  $("#gachaResult").innerHTML=order.map((x,i)=>`<div class="miniResult revealCard rarity-${String(x.rarity).toLowerCase()}" style="--i:${i}" data-player-id="${x.id}"><span>${i+1}</span><b>${esc(x.name)}</b><small>${esc(rarityLabel(x.cardType||x.rarity))} • ${starText(x.star||5)} • OVR ${x.overall}</small></div>`).join("");
  const top=order[0]||results[0];
  $("#stageName").textContent=top?.name||"PLAYER";
  $("#stageRarity").textContent=rarityLabel(top?.cardType||top?.rarity||"STANDARD")+" • "+(top?.position||"")+" • OVR "+(top?.overall||0);
  stage.onclick=null;stage.classList.remove("charging");stage.classList.add("complete");
  gachaPresentation.timers.push(setTimeout(()=>finishGachaPresentation(false),results.length===10?3200:2500));
}
function draw(n,unitCost=100,free=false){
  const cost=free?0:(n===10?unitCost*9:unitCost);
  if(!free&&state.coins<cost){showMessage("コインが足りません");return}
  if(free){const today=new Date().toISOString().slice(0,10),used=localStorage.getItem(GACHA_FREE_KEY);if(used===today){showMessage("本日の無料ガチャは使用済みです");return}localStorage.setItem(GACHA_FREE_KEY,today)}
  state.coins-=cost;
  const meta=gachaMeta(),results=[];
  for(let i=0;i<n;i++){
    let p=pickPlayer();
    const next=meta.pulls+i+1;
    if(next%10===0){const pool=bannerPool(activeBanner),epic=pool.filter(x=>["EPIC","LEGEND"].includes(String(x.rarity).toUpperCase()));if(epic.length)p=epic[Math.floor(Math.random()*epic.length)]}
    results.push(p);
    if(p&&!state.owned.includes(p.id))state.owned.push(p.id);else if(p)state.gp+=80;
  }
  const best=results.reduce((a,b)=>{const rank={STANDARD:1,HIGHLIGHT:2,SHOWTIME:3,EPIC:3,LEGEND:3,BIG_TIME:4};return(rank[String(b.cardType||b.rarity).toUpperCase()]||0)>(rank[String(a.cardType||a.rarity).toUpperCase()]||0)?b:a},results[0]);
  setGachaMeta({pulls:meta.pulls+n,lastRarity:best?.rarity||""});
  state.gp+=n*120;save();wallet();showSigning(results);
}
function showMessage(t){let el=$("#panelBody");if(el){const old=el.querySelector(".drawMessage");if(old)old.remove();const x=document.createElement("div");x.className="drawMessage";x.textContent=t;el.prepend(x);setTimeout(()=>x.remove(),1600)}}
function start(){screen("match");window.dispatchEvent(new Event("football:match-start"));dispatchEvent(new Event("resize"))}function home(){screen("home")}
$("#playNow").onclick=start;$("#matchExit").onclick=home;$("#panelBack").onclick=home;
document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>b.dataset.nav==="home"?home():panel(b.dataset.nav));document.addEventListener("click",e=>{const el=e.target.closest(".playerCardTap");if(el)showPlayerDetail(el.dataset.playerId)});$("#quickPlay")?.addEventListener("click",start);wallet();
window.__footballPanel=panel;

// Unified match UX flow: MATCH PREVIEW -> KICKOFF -> PLAY -> GOAL -> FULL TIME -> REWARDS
(function(){
  const $=s=>document.querySelector(s);
  const steps=["pre","kickoff","play","goal","result","reward"];
  const setFlow=(name)=>{steps.forEach(x=>document.querySelector('[data-flow="'+x+'"]')?.classList.toggle("active",x===name));};
  const show=(id,on)=>$(id)?.classList.toggle("hidden",!on);
  window.__setMatchFlow=(name)=>setFlow(name);
  document.addEventListener("click",e=>{
    if(e.target.closest("#playNow,#quickPlay,#squadPlay")){setFlow("pre");show("#matchIntro",true);show("#matchResult",false);show("#matchReward",false);}
    if(e.target.closest("#kickoffBtn")){setFlow("kickoff");show("#matchIntro",false);setTimeout(()=>setFlow("play"),700);}
    if(e.target.closest("#rewardBtn")){setFlow("reward");show("#matchResult",false);show("#matchReward",true);}
    if(e.target.closest("#rewardDoneBtn")){show("#matchReward",false);setFlow("pre");}
  },true);
  window.addEventListener("football:goal",()=>{setFlow("goal");setTimeout(()=>setFlow("play"),1800);});
  window.addEventListener("football:fulltime",()=>{setFlow("result");const s=$("#score")?.textContent||"0 - 0";if($("#finalScore"))$("#finalScore").textContent=s;show("#matchResult",true);});
})();
