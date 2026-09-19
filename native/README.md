# iPhone native build

This project keeps the Three.js game in `web/` and wraps that same build with Capacitor for iPhone.

## Local Mac build

```bash
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

Then select an iPhone in Xcode and Run.

No Base44 is used.

## Important

The browser/GitHub Pages build remains the fast test build. The Capacitor target is the native iPhone shell around the same local web assets, so gameplay code is shared rather than duplicated.
