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

if (plist.includes("<key>UISupportedInterfaceOrientations</key>")) {
  plist = plist.replace(
    /\s*<key>UISupportedInterfaceOrientations<\\/key>[\\s\\S]*?<\\/array>/,
    "\n" + orientationBlock.trimEnd()
  );
} else {
  plist = plist.replace("</dict>", orientationBlock + "</dict>");
}

if (!plist.includes("<key>UIRequiresFullScreen</key>")) {
  plist = plist.replace("</dict>", "\t<key>UIRequiresFullScreen</key>\n\t<true/>\n</dict>");
}

writeFileSync(plistPath, plist);
console.log("Prepared iPhone landscape native project.");
