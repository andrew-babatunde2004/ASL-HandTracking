/* Classic worker: MediaPipe loads its WASM runtime through importScripts. */
let tracker;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      self.exports = {};
      importScripts('./vendor/vision_bundle.js');
      const vision = self.exports;
      const files = await vision.FilesetResolver.forVisionTasks(new URL('./vendor/wasm', self.location.href).href);
      tracker = await vision.HandLandmarker.createFromOptions(files, {
        // Ask MediaPipe to execute the hand-landmark model through the device GPU.
        baseOptions: { modelAssetPath: new URL('./models/hand_landmarker.task', self.location.href).href, delegate: 'GPU' },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.6,
      });
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame' && tracker) {
      const start = performance.now();
      try {
        const result = tracker.detectForVideo(data.bitmap, data.timestamp);
        self.postMessage({
          type: 'result', timestamp: data.timestamp, inferenceMs: performance.now() - start,
          hands: result.landmarks.map((landmarks, i) => ({
            side: result.handedness[i]?.[0]?.categoryName ?? 'Unknown',
            handednessScore: result.handedness[i]?.[0]?.score ?? 0,
            landmarks, worldLandmarks: result.worldLandmarks[i],
          })),
        });
      } finally { data.bitmap.close(); }
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
