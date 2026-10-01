import { cp, mkdir, access, writeFile, rename } from 'node:fs/promises';
const destination = new URL('../public/vendor/', import.meta.url);
await mkdir(destination, { recursive: true });
await cp(new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url), new URL('wasm/', destination), { recursive: true });
await cp(new URL('../node_modules/@mediapipe/tasks-vision/vision_bundle.cjs', import.meta.url), new URL('vision_bundle.js', destination));
const model = new URL('../public/models/hand_landmarker.task', import.meta.url);
try { await access(model); } catch {
  console.log('Downloading the hand tracking model for local inference…');
  const response = await fetch('https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task');
  if (!response.ok) throw new Error(`Model download failed: ${response.status}. Run npm run setup to retry.`);
  await mkdir(new URL('../public/models/', import.meta.url), { recursive: true });
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 1_000_000) throw new Error('Incomplete model download. Run npm run setup to retry.');
  await writeFile(new URL(`${model.href}.tmp`), bytes);
  await rename(new URL(`${model.href}.tmp`), model);
}
console.log('Local vision assets ready.');
