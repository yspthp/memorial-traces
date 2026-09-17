/* Pinned runtime and model. Frames stay inside this worker; no image uploads. */
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1';
let detector;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      importScripts(`${CDN}/vision_bundle.js`);
      const files = await Vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
      detector = await Vision.HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'CPU'
        },
        canvas: new OffscreenCanvas(1, 1), runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: .55, minHandPresenceConfidence: .55, minTrackingConfidence: .5
      });
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame') {
      try {
        const result = detector.detectForVideo(data.bitmap, data.time);
        self.postMessage({ type: 'result', time: data.time, hands: result.landmarks });
      } finally { data.bitmap.close(); }
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || String(error) });
  }
};
