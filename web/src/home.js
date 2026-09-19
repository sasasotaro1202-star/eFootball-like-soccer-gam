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
const REAL_POSITIONS={"Messi":"FW","Cristiano Ronaldo":"FW","Pelé":"FW","Diego Maradona":"MF","Johan Cruyff":"FW","Franz Beckenbauer":"DF","Zinedine Zidane":"MF","Ronaldo Nazário":"FW","Ronaldinho":"FW","Neymar":"FW","Kylian Mbappé":"FW","Robert Lewandowski":"FW","Xavi":"MF","Andrés Iniesta":"MF","Luka Modrić":"MF","Kevin De Bruyne":"MF","Mohamed Salah":"FW","Erling Haaland":"FW","Thierry Henry":"FW","David Beckham":"MF","Wayne Rooney":"FW","Steven Gerrard":"MF","Frank Lampard":"MF","Andrea Pirlo":"MF","Paolo Maldini":"DF","Alessandro Del Piero":"FW","Gianluigi Buffon":"GK","Iker Casillas":"GK","Manuel Neuer":"GK","Sergio Ramos":"DF","Carles Puyol":"DF","Virgil van Dijk":"DF","Luis Suárez":"FW","Karim Benzema":"FW","Kaká":"MF","Rivaldo":"FW","Romário":"FW","Roberto Carlos":"DF","Cafu":"DF","Garrincha":"FW","George Best":"FW","Bobby Charlton":"MF","Michel Platini":"MF","Marco van Basten":"FW","Ruud Gullit":"MF","Dennis Bergkamp":"FW","Patrick Vieira":"MF","Didier Drogba":"FW","Samuel Eto'o":"FW","Yaya Touré":"MF","Sadio Mané":"FW","Kevin Keegan":"FW","Kenny Dalglish":"FW","George Weah":"FW","Lev Yashin":"GK","Ferenc Puskás":"FW","Eusébio":"FW","Gerd Müller":"FW","Franco Baresi":"DF","Fabio Cannavaro":"DF","Arjen Robben":"FW","Franck Ribéry":"FW"};
const CAREER_RATING={"Messi":99,"Cristiano Ronaldo":99,"Pelé":99,"Diego Maradona":98,"Johan Cruyff":97,"Franz Beckenbauer":97,"Zinedine Zidane":97,"Ronaldo Nazário":97,"Ronaldinho":96,"Neymar":95,"Kylian Mbappé":96,"Robert Lewandowski":96,"Xavi":96,"Andrés Iniesta":96,"Luka Modrić":96,"Kevin De Bruyne":95,"Mohamed Salah":94,"Erling Haaland":96,"Thierry Henry":96,"David Beckham":93,"Wayne Rooney":94,"Steven Gerrard":94,"Frank Lampard":93,"Andrea Pirlo":94,"Paolo Maldini":97,"Alessandro Del Piero":93,"Gianluigi Buffon":97,"Iker Casillas":96,"Manuel Neuer":97,"Sergio Ramos":95,"Carles Puyol":94,"Virgil van Dijk":95,"Luis Suárez":96,"Karim Benzema":95,"Kaká":94,"Rivaldo":95,"Romário":95,"Roberto Carlos":95,"Cafu":95,"Garrincha":96,"George Best":95,"Bobby Charlton":95,"Michel Platini":96,"Marco van Basten":96,"Ruud Gullit":95,"Dennis Bergkamp":94,"Patrick Vieira":94,"Didier Drogba":94,"Samuel Eto'o":94,"Yaya Touré":93,"Sadio Mané":92,"Kevin Keegan":94,"Kenny Dalglish":94,"George Weah":94,"Lev Yashin":97,"Ferenc Puskás":96,"Eusébio":96,"Gerd Müller":96,"Franco Baresi":96,"Fabio Cannavaro":94,"Arjen Robben":93,"Franck Ribéry":92};
const starFor=o=>{o=Number(o)||60;return o>=96?5:o>=92?4:o>=86?3:o>=78?2:1};
const typeByLegacy=r=>String(r||"STANDARD").toUpperCase()==="LEGEND"?"LEGEND":String(r||"STANDARD").toUpperCase()==="EPIC"?"EPIC":"STANDARD";
const CARD_POOL=PLAYER_POOL.flatMap(p=>{
 const position=REAL_POSITIONS[p.name]||p.position;
 const baseOverall=CAREER_RATING[p.name]||Math.max(70,Math.min(94,Number(p.overall)||80));
 const variants=["STANDARD","HIGHLIGHT","SHOWTIME","EPIC","LEGEND","BIG_TIME"];
 return variants.map((type,i)=>{
   const t=CARD_TYPES.find(x=>x.id===type)||CARD_TYPES[0];
   const mult=type==="STANDARD"?1:type==="HIGHLIGHT"?1.015:type==="BIG_TIME"?1.035:1.025;
   const o=Math.min(99,Math.round(baseOverall*mult));
   return {...p,id:String(p.id)+"-"+type.toLowerCase(),baseId:p.id,position,rarity:type,cardType:type,cardLabel:t.label,star:starFor(o),overall:o,sourceRarity:p.rarity,variantIndex:i};
 });
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
 const o=Number(p.overall)||80,pos=p.position,x=getProgress(p),boost=Math.min(8,x.level-1+x.breakthrough*2);
 const s={offAwareness:o,ballControl:o,dribbling:o,tightPossession:o,lowPass:o,loftedPass:o,finishing:o,heading:o,setPiece:o,curl:o,speed:o,acceleration:o,kickingPower:o,jumping:o,physicalContact:o,balance:o,stamina:o,gkAwareness:o,gkCatching:o,gkParrying:o,gkReflexes:o,gkReach:o};
 const role={
   FW:{offAwareness:4,finishing:5,speed:2,acceleration:2,dribbling:2,kickingPower:2},
   MF:{ballControl:4,dribbling:3,tightPossession:4,lowPass:5,loftedPass:4,setPiece:2,stamina:2},
   DF:{physicalContact:4,heading:3,defAwareness:5,lowPass:2,stamina:2,balance:2},
   GK:{gkAwareness:7,gkCatching:7,gkParrying:7,gkReflexes:7,gkReach:6,heading:-15,finishing:-20,dribbling:-10,speed:-6}
 }[pos]||{};
 Object.keys(role).forEach(k=>{if(k in s)s[k]+=role[k]});
 const style={
   "Lionel Messi":{dribbling:7,tightPossession:8,ballControl:7,lowPass:6,finishing:5,curl:5,setPiece:6,acceleration:4},
   "Cristiano Ronaldo":{finishing:8,heading:6,jumping:6,physicalContact:5,speed:4,kickingPower:6,offAwareness:7},
   "Pelé":{finishing:7,dribbling:6,ballControl:6,heading:4,speed:4,kickingPower:5},
   "Diego Maradona":{dribbling:8,tightPossession:9,ballControl:8,lowPass:6,setPiece:7,curl:6,balance:5},
   "Johan Cruyff":{offAwareness:6,ballControl:6,dribbling:6,lowPass:7,finishing:5,speed:5,stamina:4},
   "Franz Beckenbauer":{lowPass:6,loftedPass:6,physicalContact:5,heading:5,offAwareness:2},
   "Zinedine Zidane":{ballControl:7,tightPossession:7,lowPass:7,loftedPass:6,heading:4,setPiece:5,physicalContact:3},
   "Ronaldo Nazário":{finishing:8,speed:7,acceleration:8,dribbling:7,physicalContact:5,kickingPower:5},
   Ronaldinho:{dribbling:8,tightPossession:8,ballControl:8,lowPass:6,setPiece:7,curl:6,acceleration:4},
   Neymar:{dribbling:8,tightPossession:8,ballControl:8,lowPass:6,setPiece:6,finishing:4,acceleration:5},
   "Kylian Mbappé":{speed:9,acceleration:9,finishing:6,offAwareness:6,dribbling:5},
   "Robert Lewandowski":{finishing:9,heading:7,offAwareness:8,physicalContact:5,kickingPower:5},
   Xavi:{ballControl:7,lowPass:9,loftedPass:7,tightPossession:7,stamina:4},
   "Andrés Iniesta":{ballControl:8,dribbling:7,tightPossession:8,lowPass:8,acceleration:4,balance:5},
   "Luka Modrić":{lowPass:8,loftedPass:8,ballControl:7,tightPossession:6,stamina:6,curl:4},
   "Kevin De Bruyne":{lowPass:9,loftedPass:8,kickingPower:6,offAwareness:5,setPiece:5,stamina:5},
   "Erling Haaland":{finishing:9,offAwareness:8,physicalContact:8,speed:7,acceleration:6,heading:7,kickingPower:6},
   "Thierry Henry":{speed:7,acceleration:7,finishing:7,dribbling:6,offAwareness:7,kickingPower:5},
   "Paolo Maldini":{physicalContact:7,heading:6,stamina:7,balance:5,lowPass:5,offAwareness:2},
   "Gianluigi Buffon":{gkAwareness:9,gkCatching:8,gkParrying:8,gkReflexes:8,gkReach:8},
   "Manuel Neuer":{gkAwareness:9,gkCatching:7,gkParrying:7,gkReflexes:8,gkReach:8,speed:3,lowPass:4},
   "Sergio Ramos":{physicalContact:7,heading:7,stamina:6,offAwareness:4,kickingPower:5},
   "Virgil van Dijk":{physicalContact:9,heading:8,defAwareness:8,speed:5,stamina:6},
   "Luis Suárez":{finishing:8,offAwareness:8,physicalContact:5,balance:5,dribbling:5},
   "Karim Benzema":{finishing:7,offAwareness:7,ballControl:6,lowPass:6,heading:5},
   "Roberto Carlos":{speed:7,kickingPower:9,lowPass:6,stamina:7,physicalContact:5},
   Cafu:{speed:7,stamina:8,lowPass:6,defAwareness:6,balance:5},
   Garrincha:{dribbling:8,ballControl:8,acceleration:7,tightPossession:7},
   "Michel Platini":{finishing:6,lowPass:8,setPiece:8,curl:7,offAwareness:6},
   "Marco van Basten":{finishing:9,heading:8,offAwareness:8,ballControl:6,kickingPower:5},
   "Ruud Gullit":{physicalContact:7,speed:6,stamina:7,finishing:5,heading:6,ballControl:5},
   "Franco Baresi":{defAwareness:9,physicalContact:7,heading:6,lowPass:6,balance:5},
   "Fabio Cannavaro":{defAwareness:9,physicalContact:6,heading:6,balance:7,jumping:6},
   "Lev Yashin":{gkAwareness:9,gkCatching:8,gkParrying:9,gkReflexes:9,gkReach:8}
 }[p.name]||{};
 Object.keys(style).forEach(k=>{if(k in s)s[k]+=style[k]});
 const cardBoost=(rarityRank(p.cardType||p.rarity)-1)*1+(p.cardType==="BIG_TIME"?1:0);
 Object.keys(s).forEach(k=>s[k]=clampStat(s[k]+boost+cardBoost));
 return s
}
function clampStat(v){return Math.max(45,Math.min(99,Math.round(v)))}
function playerArchetype(p){return p.position==="FW"?"Goal Poacher":p.position==="MF"?"Creative Playmaker":p.position==="DF"?"Build Up":"Offensive Goalkeeper"}
function positionMap(p){const base=p.position==="FW"?["CF","ST","LWF","RWF"]:p.position==="MF"?["AMF","CMF","DMF","LMF","RMF"]:p.position==="DF"?["CB","LB","RB","DMF"]:["GK"];const x=getProgress(p);return [...new Set([...base,...x.positions])].slice(0,5)}
function portraitSeed(p){let h=0;for(const ch of String(p.id)+String(p.name||""))h=(h*31+ch.charCodeAt(0))>>>0;return h}
function portraitSvg(p,large=false){
 const h=portraitSeed(p);
 const skin=["#f2c6a5","#d99b72","#b96f4d","#8f573f"][h%4],hair=["#17191b","#3b2418","#6b4a2e","#8a8f95"][Math.floor(h/7)%4],shirt=["#183c5d","#49316a","#174b3d","#5b2830"][Math.floor(h/13)%4];
 const rx=large?42:30,ry=large?51:37;
 const eye=(h%3===0?"#263238":h%3===1?"#3b271d":"#111");
 return '<svg class="facePortrait photoRealism" viewBox="0 0 120 140" role="img" aria-label="'+esc(p.name)+' face portrait"><defs><radialGradient id="faceBg'+p.id+'"><stop offset="0" stop-color="#516575"/><stop offset=".62" stop-color="#1b2832"/><stop offset="1" stop-color="#080d12"/></radialGradient><linearGradient id="skin'+p.id+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+skin+'"/><stop offset=".65" stop-color="'+skin+'"/><stop offset="1" stop-color="#704335"/></linearGradient></defs><rect width="120" height="140" rx="18" fill="url(#faceBg'+p.id+')"/><ellipse cx="60" cy="137" rx="45" ry="31" fill="'+shirt+'"/><path d="M38 106Q60 96 82 106L91 140H29Z" fill="'+shirt+'"/><rect x="49" y="89" width="22" height="25" rx="9" fill="url(#skin'+p.id+')"/><ellipse cx="60" cy="62" rx="'+rx+'" ry="'+ry+'" fill="url(#skin'+p.id+')"/><path d="M18 61Q19 15 60 14Q101 15 102 61L91 49Q79 39 72 36Q47 47 28 49Z" fill="'+hair+'"/><path d="M28 48Q43 38 60 39Q78 39 92 50" fill="none" stroke="#ffffff" stroke-opacity=".10" stroke-width="3"/><ellipse cx="45" cy="64" rx="4.5" ry="3.5" fill="#fff"/><ellipse cx="75" cy="64" rx="4.5" ry="3.5" fill="#fff"/><circle cx="45" cy="64" r="2" fill="'+eye+'"/><circle cx="75" cy="64" r="2" fill="'+eye+'"/><path d="M39 55Q45 51 52 54M68 54Q76 51 82 55" fill="none" stroke="'+hair+'" stroke-width="3" stroke-linecap="round"/><path d="M60 66L56 78L62 80" fill="none" stroke="#7b4b3d" stroke-width="2" stroke-linecap="round"/><path d="M49 85Q60 91 71 85" fill="none" stroke="#713b32" stroke-width="3" stroke-linecap="round"/><path d="M31 91Q60 103 89 91" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="2"/><text x="60" y="128" text-anchor="middle" fill="#fff" opacity=".85" font-size="8" font-weight="900">'+esc(p.position)+'</text></svg>'
}
function cardVisualClass(p){
 const t=String(p.cardType||p.rarity||"STANDARD").toUpperCase();
 return "cardVisual-"+t.toLowerCase();
}
function cardTypeMark(p){
 const t=String(p.cardType||p.rarity||"STANDARD").toUpperCase();
 const marks={STANDARD:"NORMAL",FEATURED:"FEATURED",HIGHLIGHT:"LIMITED",SHOWTIME:"SHOW TIME",EPIC:"EPIC",LEGEND:"LEGEND",BIG_TIME:"BIG TIME"};
 return marks[t]||t;
}

// Real-player photo layer: uses Wikimedia/Wikipedia thumbnails when available.
// The game keeps an original SVG fallback so missing/network-blocked photos never break cards.
const REAL_PHOTO_NAMES=new Set([
 "Messi","Cristiano Ronaldo","Pelé","Diego Maradona","Johan Cruyff","Franz Beckenbauer","Zinedine Zidane",
 "Ronaldo Nazário","Ronaldinho","Neymar","Kylian Mbappé","Robert Lewandowski","Xavi","Andrés Iniesta",
 "Luka Modrić","Kevin De Bruyne","Mohamed Salah","Erling Haaland","Thierry Henry","David Beckham",
 "Wayne Rooney","Steven Gerrard","Frank Lampard","Andrea Pirlo","Paolo Maldini","Alessandro Del Piero",
 "Gianluigi Buffon","Iker Casillas","Manuel Neuer","Sergio Ramos","Carles Puyol","Virgil van Dijk",
 "Luis Suárez","Karim Benzema","Kaká","Rivaldo","Romário","Roberto Carlos","Cafu","Garrincha",
 "George Best","Bobby Charlton","Michel Platini","Marco van Basten","Ruud Gullit","Dennis Bergkamp",
 "Patrick Vieira","Didier Drogba","Samuel Eto'o","Yaya Touré","Sadio Mané","Kevin Keegan","Kenny Dalglish",
 "George Weah","Lev Yashin","Ferenc Puskás","Eusébio","Gerd Müller","Franco Baresi","Fabio Cannavaro",
 "Arjen Robben","Franck Ribéry"
]);
const realPhotoCache=new Map();
function photoPageName(name){return String(name||"").replace(/\s+/g," ").trim()}
async function resolveRealPhoto(name){
 const key=photoPageName(name);
 if(!REAL_PHOTO_NAMES.has(key))return null;
 if(realPhotoCache.has(key))return realPhotoCache.get(key);
 const p=fetch("https://en.wikipedia.org/api/rest_v1/page/summary/"+encodeURIComponent(key),{mode:"cors",credentials:"omit"})
   .then(r=>r.ok?r.json():null).then(j=>j?.thumbnail?.source||j?.originalimage?.source||null).catch(()=>null);
 realPhotoCache.set(key,p);
 return p;
}
function hydrateRealPhotos(root=document){
 const nodes=[...root.querySelectorAll?.(".realPhoto[data-photo-name]")||[]];
 nodes.forEach(async node=>{
   if(node.dataset.photoLoaded)return;
   const url=await resolveRealPhoto(node.dataset.photoName);
   node.dataset.photoLoaded="1";
   if(!url)return;
   const img=new Image();
   img.loading="lazy";img.decoding="async";img.referrerPolicy="no-referrer";
   img.onload=()=>{
     node.innerHTML="";
     node.appendChild(img);
     node.classList.add("realPhotoLoaded");
     node.setAttribute("aria-label",(node.dataset.photoName||"")+" real player photo");
   };
   img.src=url;
 });
}

function portraitLetters(p){return esc((p.name||"P").split(" ").map(x=>x[0]).join("").slice(0,2))}
function card(p){
 const s=playerStats(p),x=getProgress(p),nextXp=x.level*100,type=rarityLabel(p.cardType||p.rarity),stars=p.star||starFor(p.overall);
 return `<article class="playerCardItem playerCardTap rarityCard rarity-${String(p.cardType||p.rarity).toLowerCase()} ${cardVisualClass(p)}" data-player-id="${p.id}" data-rarity="${esc(p.cardType||p.rarity)}"><div class="cardRating"><b>${p.overall}</b><small>${esc(p.position)}</small></div><div class="cardPortrait photoPortrait"><span class="portraitGlow"></span><span class="photoBadge">${cardTypeMark(p)}</span><div class="realPhoto" data-photo-name="${esc(p.name)}">${portraitSvg(p,true)}</div><i>${starText(stars)}</i></div><div class="cardLevel">LV ${x.level}/${x.maxLevel}</div><span class="rarity">${esc(type)}</span><strong>${esc(p.name)}</strong><span>${esc(playerArchetype(p))}</span><small>${esc(p.nation||"World")} • ${starText(stars)}</small><div class="cardMeta"><span>POS ${positionMap(p).join(" / ")}</span><span>${type}</span></div><div class="cardMiniStats"><b>OFF ${s.offAwareness}</b><b>BC ${s.ballControl}</b><b>DRI ${s.dribbling}</b><b>FIN ${s.finishing}</b></div><div class="xpBar"><i style="width:${Math.min(100,x.xp/nextXp*100)}%"></i></div></article>`
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
 if(kind==="gacha"){renderGacha(activeBanner);hydrateRealPhotos(document);return}
 if(kind==="squad"){const ps=CARD_POOL.filter(p=>p.star>=4).slice(0,11);$("#panelBody").innerHTML=`<div class="formation"><div class="pitchMini">${ps.map((p,i)=>`<div class="miniPlayer" style="--i:${i}">${esc(p.name.split(" ").pop())}</div>`).join("")}</div><div class="formationInfo"><span>4-3-3</span><b>WORLD XI</b><small>Possession • Balanced</small></div></div><div class="sectionTitle">STARTING XI <span>11 / 11</span></div><div class="playerList">${ps.map((p,i)=>{const s=playerStats(p);return `<div class="listRow"><b>${p.overall}</b><span><strong>${esc(p.name)}</strong><small>${esc(playerArchetype(p))}</small></span><small>SPD ${s.speed} • PAS ${s.lowPass} • FIN ${s.finishing}</small></div>`}).join("")}</div><button class="primary wide" id="squadPlay">PLAY WITH THIS XI</button>`;$("#squadPlay").onclick=start;return}
 if(kind==="collection"){const own=new Set(state.owned),ps=CARD_POOL.filter(p=>own.has(p.id));$("#panelBody").innerHTML=`<div class="collectionStats"><div><b>${ps.length}</b><small>OWNED</small></div><div><b>${CARD_POOL.length}</b><small>DATABASE</small></div><div><b>${Math.round(ps.length/CARD_POOL.length*100)}%</b><small>COLLECTED</small></div></div><div class="sectionTitle">PLAYER ARCHIVE</div><div class="playerGrid">${(ps.length?ps:CARD_POOL.slice(0,8)).map(card).join("")}</div>`;return}
 const target=CARD_POOL.find(p=>state.owned.includes(p.id))||CARD_POOL[0],tx=getProgress(target);$("#panelBody").innerHTML=`<div class="trainingHero"><span class="eyebrow">PLAYER DEVELOPMENT</span><h2>TRAINING<br>CENTER</h2><p>Level Training • Player Progression • Position Training • Limit Break</p><div class="trainingPlayer"><div class="trainingPortrait">${portraitSvg(target)}</div><div><b>${esc(target.name)}</b><small>${esc(playerArchetype(target))} • OVR ${target.overall}</small></div></div><div class="trainingStat"><span>LEVEL</span><b>${tx.level}/${tx.maxLevel}</b></div><div class="trainingStat"><span>PROGRESSION POINTS</span><b>${tx.points}</b></div><div class="trainingStat"><span>LIMIT BREAK</span><b>${tx.breakthrough}/5</b></div><div class="trainingPositions">${positionMap(target).map(q=>`<span>${q}</span>`).join("")}</div></div><div class="trainingActions"><button class="primary" id="levelTrain">LEVEL +1</button><button class="primary" id="limitBreak">BREAKTHROUGH</button></div><button class="primary wide" id="trainingReward">CLAIM DAILY +500 GP</button>`;$("#levelTrain").onclick=()=>{const x=getProgress(target);if(x.level<x.maxLevel){x.level++;x.points+=3;x.xp=0;state.progress[target.id]=x;save();panel("training")}};$("#limitBreak").onclick=()=>{const x=getProgress(target);if(x.breakthrough<5&&state.gp>=1000){state.gp-=1000;x.breakthrough++;x.maxLevel=Math.min(40,x.maxLevel+2);state.progress[target.id]=x;save();wallet();panel("training")}};$("#trainingReward").onclick=()=>{state.gp+=500;save();wallet();panel("training")}
}
const GACHA_BANNERS=[
 {id:"special",title:"SPECIAL PLAYER LIST",sub:"1つのPlayer Listに複数のカードタイプを収録",kind:"special",cost:100,deal:"CHANCE DEAL",featured:"HEADLINER"},
 {id:"standard",title:"STANDARD PLAYER LIST",sub:"GPで対象選手を直接選択して獲得",kind:"standard",cost:0,deal:"GP SIGNING",featured:"STANDARD"},
 {id:"chance",title:"CHANCE DEAL",sub:"対象Player Listからランダムで1選手を獲得",kind:"chance",cost:0,deal:"CHANCE DEAL",featured:"MIXED"},
 {id:"nominating",title:"NOMINATING CONTRACT",sub:"対象リストから好きな選手を1人選択",kind:"nominating",cost:0,deal:"SELECT",featured:"MIXED"},
 {id:"selection",title:"SELECTION CONTRACT",sub:"専用Player Listから好きな選手を選択",kind:"selection",cost:0,deal:"SELECT",featured:"MIXED"},
 {id:"packs",title:"PACKS",sub:"固定内容の選手・アイテムパック",kind:"packs",cost:0,deal:"PACK",featured:"PACK"}
];
let activeBanner="special";
function bannerPool(id){
 const typeMap={
  special:["STANDARD","FEATURED","HIGHLIGHT","SHOWTIME","EPIC","LEGEND","BIG_TIME"],
  chance:["STANDARD","FEATURED","HIGHLIGHT","SHOWTIME","EPIC","LEGEND","BIG_TIME"],
  standard:["STANDARD"],
  nominating:["FEATURED","HIGHLIGHT","SHOWTIME","EPIC","LEGEND"],
  selection:["HIGHLIGHT","SHOWTIME","EPIC","LEGEND","BIG_TIME"],
  packs:["STANDARD","FEATURED","HIGHLIGHT"]
 };
 const types=typeMap[id]||typeMap.special;
 const pool=CARD_POOL.filter(p=>types.includes(String(p.cardType||p.rarity).toUpperCase()));
 return pool.length?pool:CARD_POOL.filter(p=>p.cardType==="STANDARD");
}
function pickPlayer(){
 const b=GACHA_BANNERS.find(x=>x.id===activeBanner)||GACHA_BANNERS[0],pool=bannerPool(activeBanner),rates=b.rates||{},r=Math.random();
 const tiers=Object.entries(rates),available=tiers.filter(([k])=>pool.some(p=>String(p.cardType||p.rarity).toUpperCase()===k));
 let a=0,tier=available[available.length-1]?.[0]||"STANDARD";for(const [k,w] of available){a+=Number(w)/available.reduce((s,x)=>s+Number(x[1]),0);if(r<a){tier=k;break}}
 const same=pool.filter(p=>String(p.cardType||p.rarity).toUpperCase()===tier);return same[Math.floor(Math.random()*same.length)]||pool[Math.floor(Math.random()*pool.length)]||CARD_POOL[0]
}
function renderGacha(kind="special"){
 activeBanner=kind;
 const b=GACHA_BANNERS.find(x=>x.id===kind)||GACHA_BANNERS[0],pool=bannerPool(kind);
 const mixed=kind==="special"||kind==="chance"||kind==="nominating"||kind==="selection";
 const typeOrder=["BIG_TIME","EPIC","LEGEND","SHOWTIME","HIGHLIGHT","FEATURED","STANDARD"];
 const counts=typeOrder.map(t=>[t,pool.filter(p=>String(p.cardType||p.rarity).toUpperCase()===t).length]).filter(x=>x[1]>0);
 const tabs=GACHA_BANNERS.map(x=>'<button class="gachaTab '+(x.id===kind?"active":"")+'" data-banner="'+x.id+'">'+x.title+'</button>').join("");
 const composition=mixed?'<div class="listComposition"><b>PLAYER LIST CONTENTS</b>'+counts.map(x=>'<span>'+x[0]+' <strong>'+x[1]+'</strong></span>').join("")+'</div>':"";
 const notice=kind==="special"?'<div class="rateNotice">この1つのSPECIAL PLAYER LISTから、STANDARD〜BIG TIMEまで複数タイプを抽選。10連には対象リストのヘッドライナー保証を設定。</div>':"";
 $( "#panelBody").innerHTML='<div class="gachaTabs">'+tabs+'</div>'+
 '<div class="gachaHero premiumGacha"><div><span class="eyebrow">CONTRACT</span><h2>'+esc(b.title)+'</h2><p>'+esc(b.sub)+'</p><div class="gachaBadges"><span>'+b.deal+'</span><span>'+b.featured+'</span><span>PLAYER LIST</span></div></div><div class="gachaOrb">✦</div></div>'+
 notice+composition+
 '<div class="drawRow"><button class="drawBtn" data-draw="1" data-cost="'+b.cost+'">SIGN ×1<small>'+ (b.cost?b.cost+" COINS":"CONTRACT") +'</small></button><button class="drawBtn gold" data-draw="10" data-cost="'+b.cost+'">SIGN ×10<small>'+ (b.cost?b.cost*10+" COINS":"10 CONTRACTS") +'</small></button></div>'+
 '<div class="gachaSubRow"><button class="subGacha" data-free="1">DAILY FREE</button><button class="subGacha" data-box="1">PLAYER LIST</button><button class="subGacha" data-rates="1">NOTICE / RATES</button></div>'+
 '<div class="sectionTitle">PLAYER LIST <span>'+pool.length+' PLAYERS</span></div><div class="playerGrid">'+pool.slice(0,12).map(card).join("")+'</div>';
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
 state.coins-=cost;const meta=gachaMeta(),results=[];
 for(let i=0;i<n;i++){let p=pickPlayer();const next=meta.pulls+i+1;
   if(next%10===0){const pool=bannerPool(activeBanner),minimum=activeBanner==="bigtime"?"BIG_TIME":activeBanner==="legend"?"LEGEND":activeBanner==="epic"?"EPIC":activeBanner==="showtime"?"SHOWTIME":"HIGHLIGHT",rank={STANDARD:1,HIGHLIGHT:2,SHOWTIME:3,EPIC:3,LEGEND:3,BIG_TIME:4},guaranteed=pool.filter(x=>(rank[String(x.cardType).toUpperCase()]||0)>=(rank[minimum]||2));if(guaranteed.length)p=guaranteed[Math.floor(Math.random()*guaranteed.length)]}
   results.push(p);if(p&&!state.owned.includes(p.id))state.owned.push(p.id);else if(p)state.gp+=80;
 }
 const best=results.reduce((a,b)=>{const rank={STANDARD:1,HIGHLIGHT:2,SHOWTIME:3,EPIC:3,LEGEND:3,BIG_TIME:4};return(rank[String(b.cardType||b.rarity).toUpperCase()]||0)>(rank[String(a.cardType||a.rarity).toUpperCase()]||0)?b:a},results[0]);
 setGachaMeta({pulls:meta.pulls+n,lastRarity:best?.cardType||best?.rarity||""});state.gp+=n*120;save();wallet();showSigning(results);
}
function showMessage(t){let el=$("#panelBody");if(el){const old=el.querySelector(".drawMessage");if(old)old.remove();const x=document.createElement("div");x.className="drawMessage";x.textContent=t;el.prepend(x);setTimeout(()=>x.remove(),1600)}}
function start(){screen("match");window.dispatchEvent(new Event("football:match-start"));dispatchEvent(new Event("resize"))}function home(){screen("home")}
$("#playNow").onclick=start;$("#matchExit").onclick=home;$("#panelBack").onclick=home;
document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>b.dataset.nav==="home"?home():panel(b.dataset.nav));document.addEventListener("click",e=>{const el=e.target.closest(".playerCardTap");if(el)showPlayerDetail(el.dataset.playerId)});wallet();
document.addEventListener("click",e=>{
 const b=e.target.closest("button"); if(!b)return;
 if(b.dataset?.nav){e.preventDefault();e.stopPropagation();b.dataset.nav==="home"?home():panel(b.dataset.nav);return}
 if(b.dataset?.banner){e.preventDefault();e.stopPropagation();renderGacha(b.dataset.banner);return}
 if(b.dataset?.draw){e.preventDefault();e.stopPropagation();draw(Number(b.dataset.draw),Number(b.dataset.cost)||100);return}
 if(b.dataset?.free){e.preventDefault();e.stopPropagation();draw(1,0,true);return}
 if(b.dataset?.rates){e.preventDefault();e.stopPropagation();showMessage("SPECIAL PLAYER LIST：STANDARD / FEATURED / HIGHLIGHT / SHOWTIME / EPIC / LEGEND / BIG TIME を同一リストに収録");return}
 if(b.dataset?.box){e.preventDefault();e.stopPropagation();showMessage("BOX DRAW: 準備中");return}
 if(b.id==="quickPlay"||b.id==="playNow"||b.id==="squadPlay"){e.preventDefault();e.stopPropagation();start();return}
 if(b.id==="panelBack"||b.id==="matchExit"){e.preventDefault();e.stopPropagation();home();return}
});
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
