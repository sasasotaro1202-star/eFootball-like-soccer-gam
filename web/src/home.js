import { PLAYER_POOL } from "./player-pool.generated.js";
import { GENERATED_CARD_REFERENCE } from "./generated-card-reference.js";
const $=s=>document.querySelector(s), screens={home:$("#homeScreen"),panel:$("#panelScreen"),match:$("#matchScreen")};
// Robust UI binding: event delegation keeps navigation working even after panel DOM is rebuilt.
document.addEventListener("click",(e)=>{
  const b=e.target.closest("button");
  if(!b)return;
  const nav=b.dataset?.nav;
  if(nav){e.preventDefault();e.stopPropagation();if(nav==="home")home();else if(["gacha","squad","collection","training","missions","extras"].includes(nav))panel(nav);return;}
  if(b.id==="quickPlay"||b.id==="playNow"){e.preventDefault();e.stopPropagation();start();return;}
  if(b.id==="panelBack"||b.id==="matchExit"){e.preventDefault();e.stopPropagation();home();return;}
  if(b.dataset?.draw){e.preventDefault();e.stopPropagation();draw(Number(b.dataset.draw),Number(b.dataset.cost)||100);return;}
  if(b.dataset?.free){e.preventDefault();e.stopPropagation();draw(1,0,true);return;}
});


// Original card system: 1–5★ with 5★ as the strongest base rank.
// Limited strength: NORMAL < HIGHLIGHT < SHOWTIME = EPIC = LEGEND < BIG TIME.
const CARD_TYPES=[{id:"STANDARD",label:"NORMAL",mult:1,stars:1},{id:"FEATURED",label:"FEATURED",mult:1.025,stars:3},{id:"HIGHLIGHT",label:"HIGHLIGHT",mult:1.035,stars:4},{id:"SHOWTIME",label:"SHOWTIME",mult:1.06,stars:5},{id:"EPIC",label:"EPIC",mult:1.06,stars:5},{id:"LEGEND",label:"LEGEND",mult:1.06,stars:5},{id:"BIG_TIME",label:"BIG TIME",mult:1.10,stars:5}];
const CARD_RANK={STANDARD:1,FEATURED:2,HIGHLIGHT:2,SHOWTIME:3,EPIC:3,LEGEND:3,BIG_TIME:4};
const REAL_POSITIONS={"Messi":"FW","Cristiano Ronaldo":"FW","Pelé":"FW","Diego Maradona":"MF","Johan Cruyff":"FW","Franz Beckenbauer":"DF","Zinedine Zidane":"MF","Ronaldo Nazário":"FW","Ronaldinho":"FW","Neymar":"FW","Kylian Mbappé":"FW","Robert Lewandowski":"FW","Xavi":"MF","Andrés Iniesta":"MF","Luka Modrić":"MF","Kevin De Bruyne":"MF","Mohamed Salah":"FW","Erling Haaland":"FW","Thierry Henry":"FW","David Beckham":"MF","Wayne Rooney":"FW","Steven Gerrard":"MF","Frank Lampard":"MF","Andrea Pirlo":"MF","Paolo Maldini":"DF","Alessandro Del Piero":"FW","Gianluigi Buffon":"GK","Iker Casillas":"GK","Manuel Neuer":"GK","Sergio Ramos":"DF","Carles Puyol":"DF","Virgil van Dijk":"DF","Luis Suárez":"FW","Karim Benzema":"FW","Kaká":"MF","Rivaldo":"FW","Romário":"FW","Roberto Carlos":"DF","Cafu":"DF","Garrincha":"FW","George Best":"FW","Bobby Charlton":"MF","Michel Platini":"MF","Marco van Basten":"FW","Ruud Gullit":"MF","Dennis Bergkamp":"FW","Patrick Vieira":"MF","Didier Drogba":"FW","Samuel Eto'o":"FW","Yaya Touré":"MF","Sadio Mané":"FW","Kevin Keegan":"FW","Kenny Dalglish":"FW","George Weah":"FW","Lev Yashin":"GK","Ferenc Puskás":"FW","Eusébio":"FW","Gerd Müller":"FW","Franco Baresi":"DF","Fabio Cannavaro":"DF","Arjen Robben":"FW","Franck Ribéry":"FW"};
const CAREER_RATING={"Messi":99,"Cristiano Ronaldo":99,"Pelé":99,"Diego Maradona":98,"Johan Cruyff":97,"Franz Beckenbauer":97,"Zinedine Zidane":97,"Ronaldo Nazário":97,"Ronaldinho":96,"Neymar":95,"Kylian Mbappé":96,"Robert Lewandowski":96,"Xavi":96,"Andrés Iniesta":96,"Luka Modrić":96,"Kevin De Bruyne":95,"Mohamed Salah":94,"Erling Haaland":96,"Thierry Henry":96,"David Beckham":93,"Wayne Rooney":94,"Steven Gerrard":94,"Frank Lampard":93,"Andrea Pirlo":94,"Paolo Maldini":97,"Alessandro Del Piero":93,"Gianluigi Buffon":97,"Iker Casillas":96,"Manuel Neuer":97,"Sergio Ramos":95,"Carles Puyol":94,"Virgil van Dijk":95,"Luis Suárez":96,"Karim Benzema":95,"Kaká":94,"Rivaldo":95,"Romário":95,"Roberto Carlos":95,"Cafu":95,"Garrincha":96,"George Best":95,"Bobby Charlton":95,"Michel Platini":96,"Marco van Basten":96,"Ruud Gullit":95,"Dennis Bergkamp":94,"Patrick Vieira":94,"Didier Drogba":94,"Samuel Eto'o":94,"Yaya Touré":93,"Sadio Mané":92,"Kevin Keegan":94,"Kenny Dalglish":94,"George Weah":94,"Lev Yashin":97,"Ferenc Puskás":96,"Eusébio":96,"Gerd Müller":96,"Franco Baresi":96,"Fabio Cannavaro":94,"Arjen Robben":93,"Franck Ribéry":92};
const starFor=o=>{o=Number(o)||60;return o>=96?5:o>=92?4:o>=86?3:o>=78?2:1};
const typeByLegacy=r=>String(r||"STANDARD").toUpperCase()==="LEGEND"?"LEGEND":String(r||"STANDARD").toUpperCase()==="EPIC"?"EPIC":"STANDARD";
const CARD_POOL=PLAYER_POOL.flatMap(p=>{
 const position=REAL_POSITIONS[p.name]||p.position;
 const baseOverall=CAREER_RATING[p.name]||Math.max(70,Math.min(94,Number(p.overall)||80));
 const variants=["STANDARD","FEATURED","HIGHLIGHT","SHOWTIME","EPIC","LEGEND","BIG_TIME"];
 return variants.map((type,i)=>{
   const t=CARD_TYPES.find(x=>x.id===type)||CARD_TYPES[0];
   const mult=type==="STANDARD"?1:type==="FEATURED"?1.015:type==="HIGHLIGHT"?1.02:type==="BIG_TIME"?1.035:1.025;
   const o=Math.min(99,Math.round(baseOverall*mult));
   return {...p,id:String(p.id)+"-"+type.toLowerCase(),baseId:p.id,position,rarity:type,cardType:type,cardLabel:t.label,star:starFor(o),overall:o,sourceRarity:p.rarity,variantIndex:i};
 });
});
const rarityRank=r=>CARD_RANK[String(r||"STANDARD").toUpperCase()]||1;
const rarityLabel=r=>({STANDARD:"NORMAL",FEATURED:"FEATURED",HIGHLIGHT:"HIGHLIGHT",SHOWTIME:"SHOWTIME",EPIC:"EPIC",LEGEND:"LEGEND",BIG_TIME:"BIG TIME"}[String(r||"STANDARD").toUpperCase()]||r);
const starText=n=>{n=Math.max(1,Math.min(5,Number(n)||1));return "★".repeat(n)+"☆".repeat(5-n)};
const storedCoins=+localStorage.getItem("football_coins");
const initialCoins=storedCoins===999999999?100:Math.max(0,storedCoins||100);
const state={gp:+localStorage.getItem("football_gp")||10000,coins:initialCoins,owned:JSON.parse(localStorage.getItem("football_owned")||"[]"),progress:JSON.parse(localStorage.getItem("football_progress")||"{}")};
const localSave=()=>{state.gp=Math.max(0,Math.floor(Number(state.gp)||0));state.coins=Math.max(0,Math.floor(Number(state.coins)||0));localStorage.setItem("football_gp",state.gp);localStorage.setItem("football_coins",state.coins);localStorage.setItem("football_owned",JSON.stringify(state.owned));localStorage.setItem("football_progress",JSON.stringify(state.progress))};
const save=()=>localSave();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])), money=n=>Math.max(0,Math.floor(n)).toLocaleString("ja-JP");
function wallet(){$("#gp").textContent=money(state.gp);$("#gp2").textContent=money(state.gp);$("#coins").textContent=money(state.coins);$("#ownedCount").textContent=state.owned.length}
function screen(n){Object.values(screens).forEach(x=>x.classList.remove("active"));screens[n].classList.add("active");document.body.classList.toggle("inMatch",n==="match");}
function getProgress(p){const x=state.progress[p.id]||{};return{level:Math.max(1,Math.min(x.level||1,x.maxLevel||30)),maxLevel:Math.max(30,x.maxLevel||30),xp:Math.max(0,x.xp||0),breakthrough:Math.max(0,Math.min(x.breakthrough||0,5)),points:Math.max(0,x.points||0),positions:x.positions||[p.position]}}
function playerStats(p){
 const o=Math.max(58,Math.min(99,Number(p.overall)||60)),pos=String(p.position||"MF").toUpperCase(),x=getProgress(p);
 const boost=Math.min(8,(x.level-1)*0.42+x.breakthrough*1.1);
 const s={offAwareness:48,ballControl:48,dribbling:46,tightPossession:45,lowPass:46,loftedPass:43,finishing:42,heading:42,setPiece:40,curl:42,speed:45,acceleration:44,kickingPower:44,jumping:42,physicalContact:43,balance:44,stamina:45,defAwareness:40,gkAwareness:38,gkCatching:38,gkParrying:38,gkReflexes:38,gkReach:38};
 const role={
  FW:{offAwareness:o+2,ballControl:o-1,dribbling:o, tightPossession:o-2,lowPass:o-8,loftedPass:o-12,finishing:o+4,heading:o-3,setPiece:o-8,curl:o-5,speed:o+1,acceleration:o+1,kickingPower:o+1,jumping:o-3,physicalContact:o-6,balance:o-2,stamina:o-4,defAwareness:35},
  MF:{offAwareness:o-3,ballControl:o+1,dribbling:o, tightPossession:o+1,lowPass:o+4,loftedPass:o+2,finishing:o-9,heading:o-12,setPiece:o-5,curl:o-4,speed:o-5,acceleration:o-5,kickingPower:o-5,jumping:o-10,physicalContact:o-7,balance:o+1,stamina:o+1,defAwareness:o-4},
  DF:{offAwareness:o-12,ballControl:o-7,dribbling:o-10,tightPossession:o-10,lowPass:o,loftedPass:o-2,finishing:o-25,heading:o+1,setPiece:o-9,curl:o-12,speed:o-4,acceleration:o-4,kickingPower:o-4,jumping:o+1,physicalContact:o+4,balance:o-3,stamina:o+2,defAwareness:o+6},
  GK:{offAwareness:30,ballControl:o-6,dribbling:28,tightPossession:28,lowPass:o-7,loftedPass:o-3,finishing:22,heading:22,setPiece:20,curl:20,speed:o-13,acceleration:o-13,kickingPower:o-5,jumping:o+1,physicalContact:o-4,balance:o-4,stamina:o-5,defAwareness:o+5,gkAwareness:o+7,gkCatching:o+5,gkParrying:o+5,gkReflexes:o+7,gkReach:o+5}
 }[pos]||{};
 Object.assign(s,role);
 const A={
  "Lionel Messi":{dribbling:7,tightPossession:8,ballControl:7,lowPass:6,finishing:6,curl:7,setPiece:7,acceleration:5,offAwareness:7,balance:5},
  "Cristiano Ronaldo":{finishing:8,heading:7,jumping:6,offAwareness:8,speed:5,acceleration:5,kickingPower:7,physicalContact:5},
  "Pelé":{finishing:8,dribbling:6,ballControl:6,offAwareness:8,speed:5,heading:6,kickingPower:6},
  "Diego Maradona":{dribbling:8,tightPossession:8,ballControl:8,lowPass:6,finishing:6,setPiece:7,curl:7,balance:6,acceleration:5},
  "Ronaldo Nazário":{finishing:8,speed:7,acceleration:8,dribbling:7,physicalContact:5,kickingPower:7,offAwareness:7},
  "Kylian Mbappé":{speed:9,acceleration:9,finishing:7,offAwareness:7,dribbling:7},
  "Robert Lewandowski":{finishing:9,offAwareness:8,heading:8,physicalContact:6,kickingPower:7},
  "Xavi":{lowPass:9,loftedPass:8,ballControl:8,tightPossession:7,stamina:6},
  "Andrés Iniesta":{ballControl:9,dribbling:8,tightPossession:9,lowPass:8,acceleration:5,balance:7},
  "Luka Modrić":{lowPass:8,loftedPass:8,ballControl:8,tightPossession:7,stamina:7},
  "Kevin De Bruyne":{lowPass:9,loftedPass:9,kickingPower:7,offAwareness:6,setPiece:7,curl:7},
  "Erling Haaland":{finishing:9,offAwareness:8,physicalContact:8,speed:6,heading:8,kickingPower:8},
  "Paolo Maldini":{defAwareness:9,physicalContact:7,heading:7,speed:6,balance:7,stamina:8},
  "Virgil van Dijk":{defAwareness:9,physicalContact:9,heading:8,speed:7,stamina:7},
  "Gianluigi Buffon":{gkAwareness:9,gkCatching:8,gkParrying:8,gkReflexes:9,gkReach:8},
  "Manuel Neuer":{gkAwareness:9,gkCatching:7,gkParrying:7,gkReflexes:8,gkReach:8,lowPass:6}
 };
 Object.keys(A[p.name]||{}).forEach(k=>{s[k]=(s[k]??40)+A[p.name][k]});
 const cb={STANDARD:0,HIGHLIGHT:2,SHOWTIME:3,EPIC:4,LEGEND:5,BIG_TIME:7}[String(p.cardType||p.rarity||"STANDARD").toUpperCase()]||0;
 Object.keys(s).forEach(k=>s[k]=clampStat((Number(s[k])||40)+boost+cb));
 return s;
}
function clampStat(v){return Math.max(45,Math.min(99,Math.round(v)))}
function playerArchetype(p){return p.position==="FW"?"Goal Poacher":p.position==="MF"?"Creative Playmaker":p.position==="DF"?"Build Up":"Offensive Goalkeeper"}
function positionMap(p){const base=p.position==="FW"?["CF","ST","LWF","RWF"]:p.position==="MF"?["AMF","CMF","DMF","LMF","RMF"]:p.position==="DF"?["CB","LB","RB","DMF"]:["GK"];const x=getProgress(p);return [...new Set([...base,...x.positions])].slice(0,5)}
function portraitSeed(p){let h=0;for(const ch of String(p.id)+String(p.name||""))h=(h*31+ch.charCodeAt(0))>>>0;return h}
function portraitSvg(p,large=false){
 const n=String(p.name||""),h=portraitSeed(p);
 const skins=["#f2c6a5","#d99b72","#b96f4d","#8f573f","#70432f","#b87b59"],hairs=["#17191b","#3b2418","#6b4a2e","#8a8f95","#211812","#5a3424"];
 const profiles={"Lionel Messi":["#d39a76","#241b17","short",true,"#69a7c8"],"Cristiano Ronaldo":["#c98b69","#171514","slick",false,"#8b1820"],"Kylian Mbappé":["#7f4a35","#151515","crop",false,"#173d70"],"Erling Haaland":["#e7b895","#d5bd9b","long",false,"#67a8d1"],"Neymar":["#b87855","#211914","curly",true,"#3b5c91"],"Mohamed Salah":["#9a5c40","#151312","curly",true,"#c91420"],"Robert Lewandowski":["#d7a27f","#4b3022","short",true,"#c9182b"],"Luka Modrić":["#d8a47f","#a08b72","long",false,"#315b9a"],"Kevin De Bruyne":["#e0ae89","#b77b55","short",true,"#73a8cf"],"Virgil van Dijk":["#7c4734","#151515","short",true,"#c51d2a"],"Pelé":["#8b5037","#171311","crop",false,"#173e75"],"Diego Maradona":["#b97855","#171311","curly",false,"#5d7eb7"],"Ronaldinho":["#8b5039","#151211","curly",true,"#315b9a"],"Zinedine Zidane":["#b97855","#2b201b","crop",false,"#173e75"],"Ronaldo Nazário":["#a56547","#171514","crop",false,"#2c4f9b"],"Thierry Henry":["#824b36","#151312","crop",false,"#a61e2b"],"Sergio Ramos":["#c28a68","#2a1b17","slick",true,"#e8e8e8"],"Manuel Neuer":["#d8a47f","#705039","short",false,"#55a16d"]};
 const z=profiles[n],q=z?{skin:z[0],hair:z[1],hairStyle:z[2],beard:z[3],shirt:z[4]}:{skin:skins[h%skins.length],hair:hairs[Math.floor(h/5)%hairs.length],hairStyle:["short","crop","curly","slick","long"][Math.floor(h/11)%5],beard:h%7===0||h%13===0,shirt:["#183c5d","#49316a","#174b3d","#5b2830","#365b7d"][Math.floor(h/17)%5]};
 const rx=(large?41:29)*(0.92+(h%9)*.018),ry=(large?50:36)*(0.94+(Math.floor(h/9)%7)*.018),eye=["#263238","#3b271d","#111","#6b4932"][h%4];
 const hp=q.hairStyle==="long"?"M16 67Q15 9 60 8Q105 9 104 67L93 47Q80 29 60 31Q39 29 27 48Z":q.hairStyle==="curly"?"M14 63Q13 12 60 9Q107 12 106 63L96 42Q82 24 60 29Q38 24 24 44Z":q.hairStyle==="slick"?"M17 54Q21 9 63 13Q94 14 103 52L89 42Q74 28 52 31Q34 29 22 48Z":"M18 59Q19 13 60 12Q101 13 102 59L91 45Q77 34 60 36Q42 34 28 46Z";
 const beard=q.beard?'<path d="M36 82Q41 104 60 107Q79 104 84 82L78 96Q60 103 42 96Z" fill="#30231f" opacity=".9"/>':"";
 return '<svg class="facePortrait illustratedPortrait" viewBox="0 0 120 140" role="img" aria-label="'+esc(n)+' illustrated face portrait"><defs><radialGradient id="faceBg'+p.id+'"><stop offset="0" stop-color="#667b8a"/><stop offset=".62" stop-color="#1b2832"/><stop offset="1" stop-color="#080d12"/></radialGradient><linearGradient id="skin'+p.id+'"><stop offset="0" stop-color="'+q.skin+'"/><stop offset=".7" stop-color="'+q.skin+'"/><stop offset="1" stop-color="#6b4034"/></linearGradient></defs><rect width="120" height="140" rx="18" fill="url(#faceBg'+p.id+' )"/><ellipse cx="60" cy="138" rx="46" ry="30" fill="'+q.shirt+'"/><path d="M31 140L38 108Q60 97 82 108L89 140Z" fill="'+q.shirt+'"/><path d="M25 50Q43 35 60 37Q79 35 95 51" fill="none" stroke="#fff" stroke-opacity=".09" stroke-width="3"/><ellipse cx="60" cy="62" rx="'+rx+'" ry="'+ry+'" fill="url(#skin'+p.id+')"/><ellipse cx="'+(60-rx+2)+'" cy="68" rx="5" ry="8" fill="'+q.skin+'"/><ellipse cx="'+(60+rx-2)+'" cy="68" rx="5" ry="8" fill="'+q.skin+'"/><path d="'+hp+'" fill="'+q.hair+'"/><path d="M37 56Q45 51 53 55M67 55Q75 51 83 56" fill="none" stroke="'+q.hair+'" stroke-width="3.2" stroke-linecap="round"/><ellipse cx="45" cy="65" rx="5" ry="3.7" fill="#fff"/><ellipse cx="75" cy="65" rx="5" ry="3.7" fill="#fff"/><circle cx="45" cy="65" r="2.2" fill="'+eye+'"/><circle cx="75" cy="65" r="2.2" fill="'+eye+'"/><path d="M60 67L55 80L61 82" fill="none" stroke="#75473a" stroke-width="2.3"/><path d="M48 88Q60 94 72 88" fill="none" stroke="#713b32" stroke-width="3" stroke-linecap="round"/>'+beard+'<text x="60" y="129" text-anchor="middle" fill="#fff" opacity=".88" font-size="7.5" font-weight="900">'+esc(p.position)+'</text></svg>';
}
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
 if(kind==="squad"){
 const ps=(CARD_POOL.filter(p=>state.owned.includes(p.id)&&p.star>=4).length>=11?CARD_POOL.filter(p=>state.owned.includes(p.id)&&p.star>=4):CARD_POOL.filter(p=>p.star>=4)).slice(0,11);
 const squadIds=ps.map(p=>p.id).join(",");
 const fluid=localStorage.getItem("football_fluid_formation")!=="0";
 $("#panelBody").innerHTML=`<div class="formation"><div class="pitchMini">${ps.map((p,i)=>`<div class="miniPlayer" style="--i:${i}">${esc(p.name.split(" ").pop())}</div>`).join("")}</div><div class="formationInfo"><span>4-3-3</span><b>WORLD XI</b><small>Possession • Balanced • ${fluid?"Fluid Formation ON":"Static Formation"}</small></div></div><div class="tacticBar"><button class="tacticBtn ${fluid?"active":""}" data-fluid-toggle="1">FLUID FORMATION <span>${fluid?"ON":"OFF"}</span></button><div><b>MATCH XI</b><small>このXIを実際の試合へ反映</small></div></div><div class="sectionTitle">STARTING XI <span>11 / 11</span></div><div class="playerList">${ps.map((p,i)=>{const s=playerStats(p);return `<div class="listRow"><b>${p.overall}</b><span><strong>${esc(p.name)}</strong><small>${esc(playerArchetype(p))}</small></span><small>SPD ${s.speed} • PAS ${s.lowPass} • FIN ${s.finishing}</small></div>`}).join("")}</div><button class="primary wide" id="squadPlay" data-squad-ids="${esc(squadIds)}">SET XI & PLAY</button>`;
 return;
}
 if(kind==="collection"){const own=new Set(state.owned),ps=CARD_POOL.filter(p=>own.has(p.id));$("#panelBody").innerHTML=`<div class="collectionStats"><div><b>${ps.length}</b><small>OWNED</small></div><div><b>${CARD_POOL.length}</b><small>DATABASE</small></div><div><b>${Math.round(ps.length/CARD_POOL.length*100)}%</b><small>COLLECTED</small></div></div><div class="sectionTitle">PLAYER ARCHIVE</div><div class="playerGrid">${(ps.length?ps:CARD_POOL.slice(0,8)).map(card).join("")}</div>`;return}
 const target=CARD_POOL.find(p=>state.owned.includes(p.id))||CARD_POOL[0],tx=getProgress(target);$("#panelBody").innerHTML=`<div class="trainingHero"><span class="eyebrow">PLAYER DEVELOPMENT</span><h2>TRAINING<br>CENTER</h2><p>Level Training • Player Progression • Position Training • Limit Break</p><div class="trainingPlayer"><div class="trainingPortrait">${portraitSvg(target)}</div><div><b>${esc(target.name)}</b><small>${esc(playerArchetype(target))} • OVR ${target.overall}</small></div></div><div class="trainingStat"><span>LEVEL</span><b>${tx.level}/${tx.maxLevel}</b></div><div class="trainingStat"><span>PROGRESSION POINTS</span><b>${tx.points}</b></div><div class="trainingStat"><span>LIMIT BREAK</span><b>${tx.breakthrough}/5</b></div><div class="trainingPositions">${positionMap(target).map(q=>`<span>${q}</span>`).join("")}</div></div><div class="trainingActions"><button class="primary" id="levelTrain">LEVEL +1</button><button class="primary" id="limitBreak">BREAKTHROUGH</button></div><button class="primary wide" id="trainingReward">CLAIM DAILY +500 GP</button>`;$("#levelTrain").onclick=()=>{const x=getProgress(target);if(x.level<x.maxLevel){x.level++;x.points+=3;x.xp=0;state.progress[target.id]=x;save();panel("training")}};$("#limitBreak").onclick=()=>{const x=getProgress(target);if(x.breakthrough<5&&state.gp>=1000){state.gp-=1000;x.breakthrough++;x.maxLevel=Math.min(40,x.maxLevel+2);state.progress[target.id]=x;save();wallet();panel("training")}};$("#trainingReward").onclick=()=>{state.gp+=500;save();wallet();panel("training")}
}
const GACHA_BANNERS=[
 {id:"special",title:"SPECIAL PLAYER LIST",sub:"Headlinersを含む期間限定Player List",kind:"special",cost:100,deal:"COIN",featured:"3 HEADLINERS"},
 {id:"standard",title:"STANDARD PLAYER LIST",sub:"対象選手から直接獲得する通常リスト",kind:"standard",cost:0,deal:"GP",featured:"NORMAL"},
 {id:"chance",title:"CHANCE DEAL",sub:"対象Player Listからランダムで1選手",kind:"chance",cost:0,deal:"TICKET",featured:"RANDOM"},
 {id:"nominating",title:"NOMINATING CONTRACT",sub:"専用リストから1選手を指定して獲得",kind:"nominating",cost:0,deal:"CONTRACT",featured:"SELECT"},
 {id:"selection",title:"SELECTION CONTRACT",sub:"限定リストから好きな選手を選択",kind:"selection",cost:0,deal:"CONTRACT",featured:"SELECT"},
 {id:"packs",title:"PACKS",sub:"固定内容の選手をまとめて獲得",kind:"packs",cost:0,deal:"PACK",featured:"BUNDLE"}
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
const HEADLINER_SPECS={
 special:[["Lionel Messi","BIG_TIME"],["Cristiano Ronaldo","EPIC"],["Diego Maradona","LEGEND"]],
 chance:[["Ronaldo Nazário","LEGEND"],["Ronaldinho","EPIC"],["Zinedine Zidane","EPIC"]],
 nominating:[["Thierry Henry","LEGEND"],["Paolo Maldini","LEGEND"],["Xavi","EPIC"]],
 selection:[["Luka Modrić","EPIC"],["Andrés Iniesta","EPIC"],["Kevin De Bruyne","EPIC"]]
};
function findCard(name,type){
 return CARD_POOL.find(p=>p.name===name&&String(p.cardType||p.rarity).toUpperCase()===String(type).toUpperCase())
   ||CARD_POOL.find(p=>p.name===name);
}
function headlinersFor(kind){
 return (HEADLINER_SPECS[kind]||HEADLINER_SPECS.special).map(([name,type])=>findCard(name,type)).filter(Boolean).slice(0,3);
}
function randomFromTier(pool,tier){
 const a=pool.filter(p=>String(p.cardType||p.rarity).toUpperCase()===tier);
 return a.length?a[Math.floor(Math.random()*a.length)]:null;
}
function pickPlayer(){
 const pool=bannerPool(activeBanner);
 if(!pool.length)return CARD_POOL[0];
 const tierWeights=activeBanner==="standard"
  ? [["STANDARD",1]]
  : [["STANDARD",.79],["FEATURED",.09],["HIGHLIGHT",.055],["SHOWTIME",.03],["EPIC",.02],["LEGEND",.012],["BIG_TIME",.003]];
 const total=tierWeights.reduce((sum,x)=>sum+x[1],0);
 let r=Math.random()*total;
 for(const [tier,w] of tierWeights){
   r-=w;
   if(r<=0){
     const p=randomFromTier(pool,tier);
     if(p)return p;
   }
 }
 return pool[Math.floor(Math.random()*pool.length)];
}
function renderGacha(kind="special"){
 activeBanner=kind;
 const b=GACHA_BANNERS.find(x=>x.id===kind)||GACHA_BANNERS[0],pool=bannerPool(kind);
 const mixed=kind==="special"||kind==="chance"||kind==="nominating"||kind==="selection";
 const heads=headlinersFor(kind);
 const meta=gachaMeta(),untilGuarantee=10-(meta.pulls%10||10);
 const typeOrder=["BIG_TIME","EPIC","LEGEND","SHOWTIME","HIGHLIGHT","FEATURED","STANDARD"];
 const counts=typeOrder.map(t=>[t,pool.filter(p=>String(p.cardType||p.rarity).toUpperCase()===t).length]).filter(x=>x[1]>0);
 const tabs=GACHA_BANNERS.map(x=>'<button class="gachaTab '+(x.id===kind?"active":"")+'" data-banner="'+x.id+'">'+x.title+'</button>').join("");
 const composition=mixed?'<div class="listComposition"><b>PLAYER LIST CONTENTS</b>'+counts.map(x=>'<span>'+x[0]+' <strong>'+x[1]+'</strong></span>').join("")+'</div>':"";
 const headlinerMarkup=heads.length?'<section class="headlinerSection"><div class="headlinerHeader"><div><span>HEADLINERS</span><b>3 FEATURED PLAYERS</b></div><small>10×: HEADLINER GUARANTEED</small></div><div class="headlinerStrip">'+heads.map((p,i)=>'<button class="headlinerCard rarity-'+String(p.cardType||p.rarity).toLowerCase()+'" data-player-id="'+esc(p.id)+'" type="button"><div class="headlinerGlow"></div><div class="headlinerPortrait">'+portraitSvg(p,true)+'</div><span class="headlinerNo">0'+(i+1)+'</span><div class="headlinerData"><b>'+esc(p.name)+'</b><small>'+esc(rarityLabel(p.cardType||p.rarity))+' • OVR '+p.overall+'</small></div></button>').join("")+'</div></section>':"";
 const previewPool=pool.filter(p=>!heads.some(h=>h.id===p.id)).slice(0,6);
 const previewCards='<div class="gachaPlayerPreview"><div class="gachaPreviewTitle">PLAYER LIST PREVIEW <span>'+pool.length+' PLAYERS</span></div><div class="gachaPreviewGrid">'+previewPool.map(p=>'<button class="gachaPlayerMini" data-player-id="'+esc(p.id)+'" type="button"><div class="gachaMiniPortrait">'+portraitSvg(p,true)+'</div><div class="gachaMiniInfo"><b>'+esc(p.name)+'</b><span>'+esc(p.position)+' • '+esc(cardTypeMark(p))+'</span><strong>'+p.overall+'</strong></div></button>').join("")+'</div></div>';
 const notice=kind==="special"?'<div class="rateNotice"><b>10× HEADLINER GUARANTEE</b><span>このリストでは10回目の獲得時に3人のHeadlinerから1人を確定獲得。10×は通常900 COINS。</span></div>':"";
 const selectNote=(kind==="nominating"||kind==="selection")?'<div class="rateNotice selectNotice"><b>SELECT A PLAYER</b><span>Player Listの選手をタップして詳細を確認し、そのまま指定獲得できます。</span></div>':"";
 const guarantee=kind==="special"?'<div class="guaranteeMeter"><span>NEXT HEADLINER</span><b>'+untilGuarantee+' / 10</b><i><em style="width:'+((10-untilGuarantee)/10*100)+'%"></em></i></div>':"";
 const drawButtons=(kind==="nominating"||kind==="selection")?'':'<div class="drawRow"><button class="drawBtn" data-draw="1" data-cost="'+b.cost+'"><b>SIGN ×1</b><small>'+ (b.cost?b.cost+" COINS":"CONTRACT") +'</small></button><button class="drawBtn gold" data-draw="10" data-cost="'+b.cost+'"><b>SIGN ×10</b><small>'+ (b.cost?b.cost*9+" COINS":"10 CONTRACTS") +'</small></button></div>';
 const sub='<div class="gachaSubRow"><button class="subGacha" data-free="1">DAILY FREE</button><button class="subGacha" data-rates="1">LIST DETAILS</button><button class="subGacha" data-box="1">OTHER LISTS</button></div>';
 $("#panelBody").innerHTML='<div class="gachaTabs">'+tabs+'</div>'+
 '<div class="gachaHero premiumGacha"><div><span class="eyebrow">CONTRACT</span><h2>'+esc(b.title)+'</h2><p>'+esc(b.sub)+'</p><div class="gachaBadges"><span>'+b.deal+'</span><span>'+b.featured+'</span><span>'+pool.length+' PLAYERS</span></div></div><div class="gachaOrb">✦</div></div>'+
 headlinerMarkup+notice+selectNote+guarantee+composition+drawButtons+sub+
 '<div class="sectionTitle">PLAYER LIST <span>'+pool.length+' PLAYERS</span></div><div class="playerGrid">'+pool.slice(0,16).map(card).join("")+'</div>';
}
const GACHA_PITY_KEY="football_gacha_pity";
const GACHA_FREE_KEY="football_gacha_free";
const gachaMeta=()=>{const p=JSON.parse(localStorage.getItem(GACHA_PITY_KEY)||"{}");return{pulls:Math.max(0,Number(p.pulls)||0),lastRarity:String(p.lastRarity||"").toUpperCase()}};
function setGachaMeta(p){localStorage.setItem(GACHA_PITY_KEY,JSON.stringify(p))}
function ensureGachaStage(){
  const stage=$("#gachaStage"); if(!stage)return null;
  if(!stage.querySelector("#gachaSkip")){
    const b=document.createElement("button");
    b.id="gachaSkip"; b.className="gachaSkip"; b.type="button"; b.textContent="SKIP";
    b.addEventListener("click",(e)=>{e.preventDefault();e.stopPropagation();finishGachaPresentation(true)});
    stage.appendChild(b);
  }
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
function gachaPattern(results){const best=results.reduce((a,b)=>rarityRank(b.cardType||b.rarity)>rarityRank(a.cardType||a.rarity)?b:a,results[0]);const r=rarityRank(best?.cardType||best?.rarity);const patterns=r>=4?["burst","rain","spotlight","galaxy"][Math.floor(Math.random()*4)]:r>=3?["flash","orbit","spotlight","rain"][Math.floor(Math.random()*4)]:["flash","orbit","scan","burst"][Math.floor(Math.random()*4)];return patterns}
function showSigning(results){
  const stage=ensureGachaStage(); if(!stage){showMessage("ガチャ演出画面を初期化できません");return;}
  clearGachaTimers();
  gachaPresentation={results:results||[],revealed:false,timers:[]};
  $("#stageName").textContent="PLAYER SIGNING";
  $("#stageRarity").textContent=(results||[]).length===10?"10 PLAYERS • TAP TO OPEN":"TAP TO OPEN";
  $("#gachaResult").innerHTML=`<button type="button" class="gachaPrompt" id="gachaOpenButton"><span class="promptRing">✦</span><b>${(results||[]).length===10?"10× PLAYER DRAW":"PLAYER DRAW"}</b><small>ここをタップして開封</small></button>`;
  const pattern=gachaPattern(results);
  stage.dataset.pattern=pattern;
  stage.classList.remove("complete","revealing","pattern-flash","pattern-burst","pattern-rain","pattern-spotlight","pattern-galaxy","pattern-orbit","pattern-scan");
  stage.classList.add("show","charging","pattern-"+pattern);
  let opened=false;
  const open=()=>{if(opened)return;opened=true;stage.classList.remove("charging");stage.classList.add("revealing");revealGacha()};
  const prompt=$("#gachaOpenButton");
  if(prompt){
    ["click","pointerup","touchend"].forEach(type=>prompt.addEventListener(type,(ev)=>{ev.preventDefault();ev.stopPropagation();open()},{once:true,passive:false}));
  }
  stage.onclick=(ev)=>{
    if(ev.target.closest("#gachaSkip"))return;
    if(ev.target.closest("#gachaOpenButton,.stageOrb,.stageName,.stageRarity,.gachaResult"))open();
  };
  stage.ontouchend=(ev)=>{if(ev.target.closest("#gachaSkip"))return;open()};
  // iPhone/Safari fail-safe: if a synthetic/overlay event blocks the tap, the draw must still reveal.
  gachaPresentation.timers.push(setTimeout(()=>stage.classList.remove("charging"),500));
  gachaPresentation.timers.push(setTimeout(()=>open(),900));
}

function revealGacha(){
  if(gachaPresentation.revealed)return;
  gachaPresentation.revealed=true; clearGachaTimers();
  const stage=ensureGachaStage(),results=gachaPresentation.results||[];
  if(!stage||!results.length){if(stage)stage.classList.remove("show");return;}
  const order=[...results].sort((a,b)=>rarityRank(b.cardType||b.rarity)-rarityRank(a.cardType||a.rarity));
  $("#gachaResult").innerHTML=order.map((x,i)=>`<button type="button" class="miniResult revealCard rarity-${String(x.cardType||x.rarity).toLowerCase()}" style="--i:${i}" data-player-id="${esc(x.id)}"><span>${i+1}</span><div class="revealPortrait">${portraitSvg(x,true)}</div><b>${esc(x.name)}</b><small>${esc(rarityLabel(x.cardType||x.rarity))} • ${starText(x.star||5)} • OVR ${x.overall}</small></button>`).join("");
  const top=order[0];
  $("#stageName").textContent=top?.name||"PLAYER";
  $("#stageRarity").textContent=rarityLabel(top?.cardType||top?.rarity||"STANDARD")+" • "+(top?.position||"")+" • OVR "+(top?.overall||0);
  stage.onclick=(ev)=>{if(ev.target.closest("#gachaSkip"))return;const card=ev.target.closest(".revealCard");if(card)showPlayerDetail(card.dataset.playerId)};
  stage.classList.remove("charging","revealing");stage.classList.add("complete","pattern-"+(stage.dataset.pattern||"flash"));
  gachaPresentation.timers.push(setTimeout(()=>finishGachaPresentation(false),results.length===10?6000:4500));
}

function draw(n,unitCost=100,free=false){
 const cost=free?0:(n===10?unitCost*9:unitCost);
 if(!free&&state.coins<cost){showMessage("コインが足りません");return}
 if(n<1||n>10){showMessage("契約数が不正です");return}
 if(free){const today=new Date().toISOString().slice(0,10),used=localStorage.getItem(GACHA_FREE_KEY);if(used===today){showMessage("本日の無料ガチャは使用済みです");return}localStorage.setItem(GACHA_FREE_KEY,today)}
 state.coins-=cost;const meta=gachaMeta(),results=[];
 for(let i=0;i<n;i++){
   let p=pickPlayer();const next=meta.pulls+i+1;
   if(activeBanner==="special"&&next%10===0){
     const heads=headlinersFor("special");
     if(heads.length)p=heads[(meta.pulls+i)%heads.length];
   }
   results.push(p);
   if(p&&!state.owned.includes(p.id))state.owned.push(p.id);else if(p)state.gp+=80;
 }
 const best=results.reduce((a,b)=>rarityRank(b.cardType||b.rarity)>rarityRank(a.cardType||a.rarity)?b:a,results[0]);
 setGachaMeta({pulls:meta.pulls+n,lastRarity:best?.cardType||best?.rarity||""});
 state.gp+=n*120;save();wallet();showSigning(results);
}
function signSelectedPlayer(id){
 const p=CARD_POOL.find(x=>String(x.id)===String(id));if(!p)return;
 if(!state.owned.includes(p.id))state.owned.push(p.id);else state.gp+=120;
 save();wallet();showMessage(p.name+" SIGNED",900);
 panel(activeBanner);
}
function showMessage(t){let el=$("#panelBody");if(el){const old=el.querySelector(".drawMessage");if(old)old.remove();const x=document.createElement("div");x.className="drawMessage";x.textContent=t;el.prepend(x);setTimeout(()=>x.remove(),1600)}}
function start(){window.__matchRewardClaimed=false;screen("match");window.dispatchEvent(new Event("football:match-start"));dispatchEvent(new Event("resize"))}function home(){window.dispatchEvent(new Event("football:match-exit"));screen("home")}
$("#playNow").onclick=start;$("#matchExit").onclick=home;$("#panelBack").onclick=home;
document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>b.dataset.nav==="home"?home():panel(b.dataset.nav));document.addEventListener("click",e=>{
 const el=e.target.closest(".playerCardTap,.gachaPlayerMini");
 if(el)showPlayerDetail(el.dataset.playerId);
});wallet();
(function mountGeneratedCardReference(){
  const host=document.querySelector(".eventPlayers");
  if(!host||host.querySelector(".generatedCardReference"))return;
  host.innerHTML=`<img class="generatedCardReference" src="${GENERATED_CARD_REFERENCE}" alt="Generated football player card showcase" loading="eager">`;
})();
document.addEventListener("click",e=>{
 const b=e.target.closest("button"); if(!b)return;
 if(b.dataset?.nav){e.preventDefault();e.stopPropagation();b.dataset.nav==="home"?home():panel(b.dataset.nav);return}
 if(b.dataset?.banner){e.preventDefault();e.stopPropagation();renderGacha(b.dataset.banner);return}
 if(b.dataset?.draw){e.preventDefault();e.stopPropagation();draw(Number(b.dataset.draw),Number(b.dataset.cost)||100);return}
 if(b.dataset?.free){e.preventDefault();e.stopPropagation();draw(1,0,true);return}
 if(b.dataset?.playerId&&(activeBanner==="nominating"||activeBanner==="selection")){e.preventDefault();e.stopPropagation();signSelectedPlayer(b.dataset.playerId);return}
 if(b.dataset?.rates){e.preventDefault();e.stopPropagation();showMessage("PLAYER LIST：3 HEADLINERS + STANDARD / FEATURED / HIGHLIGHT / SHOWTIME / EPIC / LEGEND / BIG TIME");return}
 if(b.dataset?.box){e.preventDefault();e.stopPropagation();showMessage("BOX DRAW: 準備中");return}
 if(b.dataset?.fluidToggle){e.preventDefault();e.stopPropagation();const on=localStorage.getItem("football_fluid_formation")!=="0";localStorage.setItem("football_fluid_formation",on?"0":"1");panel("squad");return}
 if(b.id==="squadPlay"){e.preventDefault();e.stopPropagation();const ids=(b.dataset.squadIds||"").split(",").filter(Boolean);if(ids.length===11)localStorage.setItem("football_match_squad",JSON.stringify(ids));localStorage.setItem("football_fluid_formation",localStorage.getItem("football_fluid_formation")||"1");start();return}
 if(b.id==="quickPlay"||b.id==="playNow"){e.preventDefault();e.stopPropagation();start();return}
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
    if(e.target.closest("#playNow,#quickPlay,#squadPlay")){
      window.__matchRewardClaimed=false;
      setFlow("pre");
      show("#matchIntro",true);
      show("#matchResult",false);
      show("#matchReward",false);
    }
    if(e.target.closest("#kickoffBtn")){setFlow("kickoff");show("#matchIntro",false);setTimeout(()=>setFlow("play"),700);}
    if(e.target.closest("#rewardBtn")){
      if(!window.__matchRewardClaimed){
        state.gp+=500;
        save();
        wallet();
        window.__matchRewardClaimed=true;
      }
      setFlow("reward");
      show("#matchResult",false);
      show("#matchReward",true);
    }
    if(e.target.closest("#rewardDoneBtn")){show("#matchReward",false);setFlow("pre");}
  },true);
  window.addEventListener("football:goal",()=>{setFlow("goal");setTimeout(()=>setFlow("play"),1800);});
  window.addEventListener("football:fulltime",()=>{
    window.__matchRewardClaimed=false;
    setFlow("result");
    const s=$("#score")?.textContent||"0 - 0";
    if($("#finalScore"))$("#finalScore").textContent=s;
    if($("#resultSummary"))$("#resultSummary").textContent="MATCH COMPLETE • +500 GP";
    show("#matchResult",true);
  });
})();