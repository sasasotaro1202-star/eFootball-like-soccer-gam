# Native iPhone build

The game is now structured as a static Three.js web app plus a Capacitor iOS wrapper.

## Local Mac / Xcode

1. Install Node.js 22+ and Xcode.
2. In the repository root run:
   `npm install`
3. Generate/sync the iOS project:
   `npx cap add ios`
   `npx cap sync ios`
4. Open Xcode:
   `npx cap open ios`
5. Select an iPhone as the run destination and run the app.

The GitHub Pages build remains the fast browser test target. The native iPhone target uses the same `web/` game files.

No Base44 dependency is used.

## Controls

- Visible control: left virtual movement stick only.
- Invisible right-side gesture: tap/flick to pass or shoot.
- Desktop fallback: WASD/arrow keys, Shift sprint, J pass, K shoot.

The project is clean-room and does not ship proprietary eFootball assets, code, branding, or player likenesses.
