# ASL-HandTracking

ASL Studio is a local hand-tracking app built with React, MediaPipe, and Electron. It tracks up to two hands, records labeled landmark sequences, and exports samples as JSON for future model training. ASL recognition and PyTorch training are not implemented yet.

## Requirements

- Node.js 22.12 or newer in the Node.js 22 release line, with npm.
- A built-in or USB camera.
- Internet access for the initial dependency installation and hand-tracking model download.

## Install

Open a terminal in the `ASL-HandTracking` project folder, then run:

```sh
npm install
```

Installation automatically runs `npm run setup`, which copies the MediaPipe runtime into `public/vendor/` and downloads the hand-tracking model into `public/models/`. Tracking runs locally after setup.

## Run the desktop app

From the project folder:

```sh
npm start
```

This builds the frontend and opens ASL Studio in an Electron window. Run it again after changing source files to rebuild the desktop app.

## Run in a browser for development

```sh
npm run dev
```

Open the local URL printed in the terminal, usually `http://127.0.0.1:5173`. Leave the terminal running while using the app. Source edits update automatically; press `Ctrl+C` in the terminal to stop the server.

To build and preview the production frontend:

```sh
npm run build
npm run preview
```

Open the URL printed by the preview command. Use the local server URL rather than opening `index.html` directly; camera access requires localhost or HTTPS.

## Record your first sample

1. Select **Start camera** and allow camera access. On macOS, also check **System Settings → Privacy & Security → Camera** if access is blocked.
2. Bring a hand into view and wait for tracking to become ready.
3. Enter a **Sample label**, such as `hello` or `Letter A`.
4. Select **Start recording**, perform the movement, then select **Save recording**. Samples can be up to 30 seconds long.
5. Open **My library** and use **Export JSON** to download the sample.

Recordings contain timestamps, hand landmarks, world landmarks, and handedness estimates. No video or audio is saved. Samples stay in local app/browser storage; the desktop app and browser have separate libraries. Export important samples before clearing app or browser data.

Switching away from the app stops the camera and saves an active sample.

## Troubleshooting

- **Camera permission denied:** Allow camera access in your browser or operating system settings, then start the camera again.
- **Camera busy or unavailable:** Close other apps using the camera and check that the camera is connected.
- **Preview works, but tracking fails:** Run `npm run setup` again, then restart the camera. For the desktop app, quit and run `npm start` again so the refreshed assets are included in the build.
- **Model download fails during installation:** Check your internet connection and rerun `npm install`. You can also retry the model setup separately with `npm run setup` once dependencies are installed.
- **Start recording is disabled:** Wait for tracking to be ready, keep at least one hand visible, and enter a sample label.
- **Node.js version error:** Check `node --version` and use the version described in Requirements.

## Package the desktop app

Run the command for your operating system to create distributable files in `release/`:

| Platform | Command | Output |
| --- | --- | --- |
| macOS | `npm run dist:mac` | DMG and ZIP |
| Windows | `npm run dist:win` | NSIS installer |
| Linux | `npm run dist:linux` | AppImage |

Use `npm run pack` to create an unpacked desktop build for local inspection.

### Distribution notes

Build on the target operating system. `.github/workflows/desktop.yml` provides a manually triggered build for macOS, Windows, and Linux. Club members install the resulting app; they do not need Node.js or an internet connection for hand tracking. Windows and Linux packaging are configured but must be verified on those platforms. macOS builds use the build machine's architecture; use separate Intel and Apple Silicon builds when distributing to mixed Mac fleets.

The default packages are development builds; macOS uses an ad-hoc signature (`build.mac.identity` is `-`) so it does not select an existing developer identity. Public macOS distribution needs an explicit replacement for `build.mac.identity`, your Apple Developer signing identity, and notarization; Windows distribution should use your code-signing certificate. Unsigned installers can trigger operating system warnings. No signing credentials, automatic updater, or release publishing is configured.

## Technology decision

TypeScript, React, and Electron give this milestone a shared UI and an official MediaPipe integration. C# with a native UI is also viable and may reduce startup and memory overhead. Hand-detection speed depends primarily on the model, inference engine, resolution, and CPU/GPU backend. This project has not been benchmarked against an equivalent C# implementation.

The current implementation requests MediaPipe GPU inference in a separate Web Worker, with at most one in-flight frame and a 20 Hz processing cap. The camera requests up to 30 fps at 1280 × 720; frames are reduced to 640 pixels wide for inference. Recording is sampled at approximately 10 Hz and capped at 30 seconds. Actual rates depend on hardware and the installed graphics driver. Rendering and controls stay separate from synchronous model inference.

## Project structure

- `src/App.tsx`: tracking workspace, capture controls, and local library.
- `src/lib/useVision.ts`: camera lifecycle, worker communication, and overlays.
- `public/vision-worker.js`: MediaPipe hand landmark inference.
- `src/lib/types.ts`: versioned recording schema for later dataset/model work.
- `src/lib/storage.ts`: IndexedDB persistence and JSON export.
- `electron/main.cjs`: sandboxed desktop window, local asset protocol, and camera-only permissions.
- `scripts/setup-vision.mjs`: installs local runtime/model assets; no runtime CDN dependency.

The desktop library lives in Electron's application data profile. In a browser it belongs to that browser and origin. The application does not ship a labeled ASL dataset, classify signs, or translate sentences. A later recognition stage will need a validated labeled dataset and temporal modeling; broader ASL support may also need body and facial features.

## Verification

```sh
npm test              # Recording persistence and empty-capture rejection
npm run test:e2e      # Chrome: camera lifecycle, real inference, library, export, and mobile layout
npm run test:desktop  # Electron: camera, real inference, and library persistence in a temporary profile
```

The browser tests use installed Google Chrome, a simulated camera, and an unannotated hand photograph from Google's official example. They exercise the real model; they do not replace inference results. Desktop tests use a temporary profile so real library data is untouched. A physical camera check is still needed on each supported platform.
