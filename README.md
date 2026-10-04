# FOOTBALL 3D MATCH

A clean-room, playable 3D football game built with Three.js and packaged for iPhone with Capacitor.

## Current target
Build a responsive soccer game foundation first, then expand toward:
- player switching
- passing / through balls
- shooting and ball physics
- tactical formations
- team/player attributes
- goalkeeper AI
- match states
- replay/camera systems
- mobile controls
- online multiplayer

## Playtest

**Primary test URL (GitHub Pages):**  
https://sasasotaro1202-star.github.io/eFootball-like-soccer-gam/

GitHub Pages is the primary public browser test/release target for this project. The `Deploy mobile web game` GitHub Actions workflow publishes the current `main` branch to this URL.

Vercel is optional and is not the release gate for the game. This avoids making the development/test loop dependent on a Vercel deployment quota.

## Engine
Three.js r162 in the web runtime; Capacitor 7 for the iPhone native shell.

## Controls
- Desktop: WASD / Arrow keys = move, Shift = sprint, J = pass, K = shoot.
- iPhone: left movement stick = move; right action panel = pass, through, shoot, tackle, match-up, press, switch, dash.
- Touch & flick remains available: tap = pass, upward flick = shoot, downward flick = through ball.
- Holding pass / through / shoot charges power; defense uses match-up / press / tackle / switch.

## Development rule
Prioritize real gameplay quality, deterministic behavior, testability, maintainability, and performance over feature count. Avoid copying proprietary assets, code, trademarks, or copyrighted game content.

## Workflow
GitHub is the source of truth. Changes should be small, testable, reviewable, and committed with clear messages.


## Current mobile build

The current game is a clean-room Three.js 3D match engine designed for iPhone landscape play. Mobile gameplay uses the left movement stick plus a right-side action panel for pass, through, shoot, tackle, match-up, press, switch, and dash; touch/flick input remains available as an alternate gesture layer.

### iPhone native app

Capacitor configuration is included in `package.json` and `capacitor.config.ts`. On a Mac with Xcode:

```bash
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

GitHub Pages is the primary visual/playtest target. Vercel is optional and not a release gate. Base44 is not used. The iPhone native project is generated and validated by GitHub Actions on macOS. The canonical web CI validates both the browser runtime syntax and deterministic gameplay smoke checks.

### Design rule

The project targets high-quality football gameplay while remaining clean-room: no proprietary eFootball code, assets, branding, UI copy, or player likenesses are shipped.


CI validation: hard-reset mobile bundle smoke-tested in pull requests.


## iPhone workflow

The repository now has an automated **Capacitor iOS project check** workflow. It installs Capacitor, generates the Xcode iOS project, syncs the current `web/` game into it, validates the JavaScript bundle, and validates the generated Xcode project and uploads it as an artifact.

For a physical iPhone, download the generated `football-3d-ios-project` artifact from the successful GitHub Actions run, open `ios/App/App.xcworkspace` on a Mac in Xcode, select the iPhone, enable automatic signing with your Apple Account, and Run.

The browser and native shell use the same game bundle, so gameplay fixes are made once in `web/src/` and then synced into the iPhone app.


## Current web-game feature set

The web build now uses a single responsive app shell:
- Home hub with Play Match, Squad, Gacha, Collection, and Training flows.
- Persistent local wallet/collection state for GP, coins, and owned players.
- Reproducible 2,000-player historical database generated in CI from the CC0 openfootball/players dataset, with a broader historical star list prioritized.
- Collected players feed into the playable match roster.
- Match HUD includes score/clock, selected-player card, opponent card, radar, and touch gesture guidance.
- Mobile gameplay keeps only the left movement stick visible. The right side is gesture-only: tap = pass, upward flick = shoot, downward flick = through ball.
- Optional mobile haptic feedback for pass/shoot actions.
- Web Pages deployment is gated by deterministic smoke checks; the same generated player database is validated by the iPhone Capacitor workflow.

The presentation is a clean-room football game inspired by the interaction patterns of modern football games; proprietary game code, assets, branding, and UI artwork are not copied.
