import { useCallback, useEffect, useRef, useState } from 'react';
import type { Frame, Hand } from './types';
import { CONNECTIONS } from './types';

export type CameraState = 'off' | 'starting' | 'live';
export function useVision(onFrame: (frame: Frame) => void, onStop: () => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const worker = useRef<Worker | null>(null);
  const generation = useRef(0);
  const raf = useRef(0);
  const frameCallback = useRef(onFrame);
  const stopCallback = useRef(onStop);
  frameCallback.current = onFrame;
  stopCallback.current = onStop;
  const [state, setState] = useState<CameraState>('off');
  const [trackerState, setTrackerState] = useState('Not started');
  const [error, setError] = useState('');
  const [hands, setHands] = useState<Hand[]>([]);
  const [fps, setFps] = useState(0);
  const [inferenceMs, setInferenceMs] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const release = useCallback(() => {
    generation.current++;
    cancelAnimationFrame(raf.current);
    worker.current?.terminate(); worker.current = null;
    stream.current?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    stream.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);
  }, []);
  const stop = useCallback(() => {
    stopCallback.current(); release(); setState('off'); setTrackerState('Not started'); setHands([]); setFps(0);
  }, [release]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { document.removeEventListener('visibilitychange', hidden); release(); };
  }, [release, stop]);

  const start = async (deviceId: string) => {
    stop(); setError(''); setState('starting');
    const token = generation.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access requires localhost or HTTPS in a supported browser.');
      const camera = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
        width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 },
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
      } });
      if (token !== generation.current) { camera.getTracks().forEach(track => track.stop()); return; }
      stream.current = camera;
      camera.getVideoTracks()[0].onended = () => { stop(); setError('The camera disconnected. Reconnect it and start again.'); };
      const video = videoRef.current!;
      video.srcObject = camera;
      await video.play();
      if (token !== generation.current) return;
      setState('live'); setTrackerState('Loading model…');
      navigator.mediaDevices.enumerateDevices().then(list => {
        if (token === generation.current) setDevices(list.filter(device => device.kind === 'videoinput'));
      }).catch(() => {});
      const engine = new Worker(`${import.meta.env.BASE_URL}vision-worker.js`);
      worker.current = engine;
      let busy = false, lastSent = -1, lastVideoTime = -1, lastResult = performance.now(), smoothedFps = 0;
      const fail = () => {
        if (token !== generation.current) return;
        cancelAnimationFrame(raf.current); engine.terminate(); worker.current = null;
        setTrackerState('Unavailable'); setHands([]); setFps(0);
        const canvas = canvasRef.current;
        canvas?.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);
        stopCallback.current();
        setError('Camera preview is available, but hand tracking failed. Run npm run setup, then restart the camera.');
      };
      const timer = window.setTimeout(fail, 45000);
      const tick = async (now: number) => {
        if (token !== generation.current || worker.current !== engine) return;
        raf.current = requestAnimationFrame(tick);
        if (busy || video.readyState < 2 || now - lastSent < 50 || video.currentTime === lastVideoTime) return;
        busy = true; lastSent = now; lastVideoTime = video.currentTime;
        try {
          const bitmap = await createImageBitmap(video, { resizeWidth: 640, resizeHeight: Math.round(640 * video.videoHeight / video.videoWidth) });
          if (token !== generation.current || worker.current !== engine) { bitmap.close(); return; }
          engine.postMessage({ type: 'frame', bitmap, timestamp: now }, [bitmap]);
        } catch { fail(); }
      };
      engine.onerror = () => { clearTimeout(timer); fail(); };
      engine.onmessage = ({ data }) => {
        if (token !== generation.current) { clearTimeout(timer); return; }
        if (data.type === 'ready') {
          clearTimeout(timer); setTrackerState('Ready'); raf.current = requestAnimationFrame(tick);
        } else if (data.type === 'error') { clearTimeout(timer); fail(); }
        else if (data.type === 'result') {
          busy = false;
          const detected = data.hands as Hand[];
          const now = performance.now();
          smoothedFps = smoothedFps * 0.8 + 1000 / (now - lastResult) * 0.2;
          lastResult = now;
          setFps(Math.round(smoothedFps)); setInferenceMs(Math.round(data.inferenceMs)); setHands(detected);
          frameCallback.current({ timestampMs: data.timestamp, hands: detected });
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (!canvas || !ctx) return;
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          ctx.clearRect(0,0,canvas.width,canvas.height);
          detected.forEach(hand => {
            ctx.strokeStyle = '#a7f3bb'; ctx.lineWidth = 3;
            CONNECTIONS.forEach(([a,b]) => {
              ctx.beginPath(); ctx.moveTo(hand.landmarks[a].x * canvas.width,hand.landmarks[a].y * canvas.height);
              ctx.lineTo(hand.landmarks[b].x * canvas.width,hand.landmarks[b].y * canvas.height); ctx.stroke();
            });
            hand.landmarks.forEach((point, i) => {
              ctx.beginPath(); ctx.arc(point.x * canvas.width,point.y * canvas.height,i === 0 ? 6 : 4,0,Math.PI*2);
              ctx.fillStyle = '#f3fff6'; ctx.fill();
            });
          });
        }
      };
      engine.postMessage({ type: 'init' });
    } catch (cause) {
      if (token !== generation.current) return;
      stop();
      const name = cause instanceof Error ? cause.name : '';
      setError(name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser settings, then try again.'
        : name === 'NotFoundError' ? 'No camera found. Connect a camera and try again.'
        : name === 'NotReadableError' ? 'The camera is busy or unavailable. Close other camera apps and try again.'
        : cause instanceof Error ? cause.message : 'Could not start the camera. Please try again.');
    }
  };
  return { videoRef, canvasRef, state, trackerState, error, hands, fps, inferenceMs, devices, start, stop };
}
