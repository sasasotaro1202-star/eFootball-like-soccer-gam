import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function run(command, args) {
  const r = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!existsSync("ios")) {
  run("npx", ["cap", "add", "ios"]);
}
run("npx", ["cap", "sync", "ios"]);

const plistPath = "ios/App/App/Info.plist";
if (!existsSync(plistPath)) {
  throw new Error("Capacitor iOS Info.plist was not generated: " + plistPath);
}

let plist = readFileSync(plistPath, "utf8");
const orientationBlock = `\t<key>UISupportedInterfaceOrientations</key>
\t<array>
\t\t<string>UIInterfaceOrientationLandscapeLeft</string>
\t\t<string>UIInterfaceOrientationLandscapeRight</string>
\t</array>
`;

const orientationKey = "<key>UISupportedInterfaceOrientations</key>";
if (plist.includes(orientationKey)) {
  const keyIndex = plist.indexOf(orientationKey);
  const arrayStart = plist.indexOf("<array>", keyIndex);
  const arrayEnd = plist.indexOf("</array>", arrayStart);
  if (arrayStart < 0 || arrayEnd < 0) throw new Error("Malformed UISupportedInterfaceOrientations in Info.plist");
  plist = plist.slice(0, keyIndex) + orientationBlock.trimEnd() + plist.slice(arrayEnd + "</array>".length);
} else {
  plist = plist.replace("</dict>", orientationBlock + "</dict>");
}

if (!plist.includes("<key>UIRequiresFullScreen</key>")) {
  plist = plist.replace("</dict>", "\t<key>UIRequiresFullScreen</key>\n\t<true/>\n</dict>");
}

writeFileSync(plistPath, plist);
console.log("Prepared iPhone landscape native project.");
