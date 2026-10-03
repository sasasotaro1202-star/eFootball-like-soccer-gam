import { readFileSync } from "node:fs";
const html=readFileSync("web/index.html","utf8");
const js=readFileSync("web/src/game-hardreset.js","utf8");
const home=readFileSync("web/src/home.js","utf8");
const checks=[["home screen",html.includes('id="homeScreen"')],["match screen",html.includes('id="matchScreen"')],["left movement stick",html.includes('id="stick"')],["no visible action grid",!html.includes('id="actions"')&&!html.includes('data-action=')],["home controller",html.includes('src/home.js')],["game controller",html.includes('game-hardreset.js')],["player database import",js.includes('player-pool.generated.js')],["gacha flow",home.includes('data-draw')],["match timer",js.includes('MATCH_DURATION = 90')],["goal event",js.includes('football:goal')],["fulltime event",js.includes('football:fulltime')],["single AI loop",!js.includes('function aiStep')&&(js.match(/function teamAI\s*\(/g)||[]).length===1],["pass re-acquisition guard",js.includes('lastKickerUntil')]];
for(const [n,ok] of checks)if(!ok)throw new Error("Smoke check failed: "+n);
console.log("Web smoke checks passed:",checks.map(x=>x[0]).join(", "));