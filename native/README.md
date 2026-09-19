# iPhone native build

Base44 is not used. The game remains a single Three.js codebase in `web/`; Capacitor wraps the same files for iPhone.

## Verification

The `iPhone Native Build Check` GitHub Actions workflow runs on macOS, installs dependencies, generates the iOS project, syncs the web assets, and performs an unsigned iOS Simulator Xcode build.

## On your Mac

```bash
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

In Xcode, select your physical iPhone, enable automatic signing, select your Apple Account/team, and Run.

The browser build remains the fast test path. The iPhone app uses the same gameplay files.

## Controls

Only the left movement stick is visible. The right half of the field has invisible touch/flick input for pass/shoot; there is no visible action-button cluster.
