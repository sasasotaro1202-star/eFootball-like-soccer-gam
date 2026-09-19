# FOOTBALL 3D MATCH

A clean-room, playable soccer prototype built with Godot and managed in GitHub.

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

## Engine
Godot 4.7.2 stable.

## Controls
- WASD / Arrow keys: move
- Shift: sprint
- J: pass
- K: shoot

## Development rule
Prioritize real gameplay quality, deterministic behavior, testability, maintainability, and performance over feature count. Avoid copying proprietary assets, code, trademarks, or copyrighted game content.

## Workflow
GitHub is the source of truth. Changes should be small, testable, reviewable, and committed with clear messages.


## Current mobile build

The current game is a clean-room Three.js 3D match engine designed for iPhone landscape play. The visible mobile control is intentionally limited to the left movement stick; right-side touch gestures remain invisible for pass/shoot input.

### iPhone native app

Capacitor configuration is included in `package.json` and `capacitor.config.ts`. On a Mac with Xcode:

```bash
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

GitHub Pages remains the browser test target. Base44 is not used.

### Design rule

The project targets high-quality football gameplay while remaining clean-room: no proprietary eFootball code, assets, branding, UI copy, or player likenesses are shipped.


CI validation: hard-reset mobile bundle smoke-tested in pull requests.
