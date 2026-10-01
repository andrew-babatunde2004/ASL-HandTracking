import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, Camera, Check, ChevronRight, CircleHelp, Database, Fingerprint, Hand, Layers2, Library, Maximize2, Pause, Play, ScanLine, ShieldCheck, Square, Trash2, Video, X } from 'lucide-react';
import { useVision } from './lib/useVision';
import { deleteRecording, exportRecording, listRecordings, saveRecording } from './lib/storage';
import type { Frame, Recording } from './lib/types';

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
export default function App() {
  const [tab, setTab] = useState<'studio' | 'library'>('studio');
  const [mirror, setMirror] = useState(true);
  const [overlay, setOverlay] = useState(true);
  const [device, setDevice] = useState('');
  const [label, setLabel] = useState('');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [storageError, setStorageError] = useState('');
  const [help, setHelp] = useState(false);
  const [deleteId, setDeleteId] = useState('');
  const [selected, setSelected] = useState<Recording | null>(null);
  const draft = useRef<Recording | null>(null);
  const began = useRef(0);
  const cameraArea = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    try { setRecordings(await listRecordings()); setStorageError(''); }
    catch { setStorageError('Local storage is unavailable. Check available disk space and storage permissions.'); }
  };
  useEffect(() => { void refresh(); }, []);

  async function finish() {
    const current = draft.current;
    if (!current) return;
    draft.current = null; setRecording(false); setSaving(true);
    current.durationMs = Math.min(30000, performance.now() - began.current);
    try {
      await saveRecording(current); await refresh(); setNotice(`Saved “${current.label}” to your library.`);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Could not save the recording.');
      if (current.frames.some(frame => frame.hands.length)) { setSelected(current); setTab('library'); }
    } finally { setSaving(false); }
  }
  function capture(frame: Frame) {
    const current = draft.current;
    if (!current) return;
    const timestampMs = frame.timestampMs - began.current;
    if (timestampMs < 0 || timestampMs > 30000) return;
    const previous = current.frames.at(-1);
    if (!previous || timestampMs - previous.timestampMs >= 95) current.frames.push({ ...frame, timestampMs });
  }
  const vision = useVision(capture, () => { void finish(); });
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const time = performance.now() - began.current;
      setElapsed(time);
      if (time >= 30000) void finish();
    }, 100);
    return () => clearInterval(timer);
  }, [recording]);

  function begin() {
    if (!label.trim() || vision.trackerState !== 'Ready' || !vision.hands.length || saving) return;
    const video = vision.videoRef.current!;
    draft.current = {
      id: crypto.randomUUID(), schemaVersion: 1, label: label.trim(), createdAt: new Date().toISOString(),
      durationMs: 0, source: { width: video.videoWidth, height: video.videoHeight, mirrored: false },
      model: 'mediapipe-hand-landmarker-float16-v1', frames: [],
    };
    began.current = performance.now(); setElapsed(0); setRecording(true); setNotice(''); setStorageError('');
  }
  const live = vision.state === 'live';
  const status = vision.state === 'starting' ? 'Connecting camera' : live ? 'Camera live' : 'Camera off';
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={event => { event.preventDefault(); setTab('studio'); }} aria-label="ASL Studio home"><span className="brand-symbol"><Hand size={23}/></span><span>asl<span className="brand-light">studio</span><small>CAPTURE. UNDERSTAND. CONNECT.</small></span></a>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation">
        <button className={tab === 'studio' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('studio')}><ScanLine size={19}/>Tracking studio<ChevronRight size={15}/></button>
        <button className={tab === 'library' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('library')}><Library size={19}/>My library<span className="count">{recordings.length}</span></button>
      </nav>
      <div className="sidebar-bottom"><div className="local-note"><ShieldCheck size={18}/><div>Local by design<small>Your camera stays on this device.</small></div></div><button className="help-button" onClick={() => setHelp(true)}><CircleHelp size={17}/> Getting started <ArrowUpRight size={15}/></button><div className="version">ASL STUDIO <span>v0.1 / FOUNDATION</span></div></div>
    </aside>
    <main>
      <header className="topbar"><div>Workspace <span>/</span> <strong>{tab === 'studio' ? 'Tracking studio' : 'My library'}</strong></div><span className="local-badge"><i/> On-device processing</span></header>
      <div className="page">
        <div className="page-heading"><div><div className="eyebrow">{tab === 'studio' ? 'YOUR HANDS, IN FOCUS' : 'YOUR LOCAL DATASET'}</div><h1>{tab === 'studio' ? 'Tracking studio' : 'My library'}<span>.</span></h1><p>{tab === 'studio' ? 'See your movement. Capture the details.' : 'Labeled hand movements, saved on this device.'}</p></div><span className="phase"><span/> Hand tracking · Preview</span></div>
        {(notice || storageError || vision.error) && <div className={`notice ${storageError || vision.error ? 'error' : ''}`} role={storageError || vision.error ? 'alert' : 'status'}>{storageError || vision.error || notice}<button aria-label="Dismiss message" onClick={() => { setNotice(''); setStorageError(''); }} disabled={!!vision.error}><X size={16}/></button></div>}
        <section className="studio-layout" style={{ display: tab === 'studio' ? undefined : 'none' }} aria-label="Tracking studio">
          <div className="workspace">
            <div className="section-heading"><h2><Video size={17}/> Live camera</h2><span className={`camera-status ${live ? 'is-live' : ''}`}><i/>{status}</span></div>
            <div className={`camera-stage ${live ? 'live' : ''}`} ref={cameraArea}>
              <div className={`camera-media ${mirror ? 'mirrored' : ''}`} style={{ aspectRatio: live && vision.videoRef.current?.videoWidth ? `${vision.videoRef.current.videoWidth} / ${vision.videoRef.current.videoHeight}` : '16 / 9' }}>
                <video ref={vision.videoRef} autoPlay playsInline muted aria-label="Live camera preview"/>
                <canvas ref={vision.canvasRef} className={overlay ? '' : 'overlay-hidden'} aria-label="Hand landmark overlay"/>
              </div>
              {!live && <div className="camera-empty"><div className="focus-corners"><Hand size={54} strokeWidth={1}/></div><h3>Your camera is ready when you are.</h3><p>Start your camera and bring your hands into view.</p><button className="primary light" onClick={() => void vision.start(device)} disabled={vision.state === 'starting'}><Camera size={17}/>{vision.state === 'starting' ? 'Connecting…' : 'Start camera'}<ArrowUpRight size={16}/></button><span className="camera-privacy"><ShieldCheck size={13}/> Processed locally. Never uploaded.</span></div>}
              <div className="stage-top"><span className="stage-label"><span className={live ? 'dot live-dot' : 'dot'}/>{recording ? `RECORDING ${seconds(elapsed)}` : live ? 'LIVE VIEW' : 'CAMERA PREVIEW'}</span><span className="stage-label">{live ? `${vision.videoRef.current?.videoWidth} × ${vision.videoRef.current?.videoHeight}` : 'AWAITING CAMERA'}</span></div>
              <div className="stage-bottom"><span>{live ? vision.hands.length ? `${vision.hands.length} ${vision.hands.length === 1 ? 'hand' : 'hands'} in view` : 'Bring your hands into view' : 'A clear view makes all the difference.'}</span><button className="icon-button" title="Fullscreen camera" aria-label="Fullscreen camera" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void cameraArea.current?.requestFullscreen().catch(() => setNotice('Fullscreen is unavailable in this window.')); }}><Maximize2 size={17}/></button></div>
            </div>
            <div className="camera-toolbar"><div className="camera-select"><Camera size={16}/><select aria-label="Camera" value={device} disabled={vision.state !== 'off'} onChange={event => setDevice(event.target.value)}><option value="">Default camera</option>{vision.devices.map((camera, index) => <option key={camera.deviceId || index} value={camera.deviceId}>{camera.label || `Camera ${index+1}`}</option>)}</select></div><div className="view-controls"><button className={mirror ? 'toggle active' : 'toggle'} aria-pressed={mirror} onClick={() => setMirror(!mirror)}><Layers2 size={16}/>Mirror</button><button className={overlay ? 'toggle active' : 'toggle'} aria-pressed={overlay} onClick={() => setOverlay(!overlay)}><ScanLine size={16}/>Landmarks</button>{vision.state !== 'off' && <button className="stop-camera" onClick={vision.stop}><Square size={13}/>Stop</button>}</div></div>
            <div className="metrics"><div><span>HANDS DETECTED</span><strong>{live ? String(vision.hands.length).padStart(2,'0') : '—'}<small>/ 02</small></strong></div><div><span>LANDMARKS</span><strong>{live ? vision.hands.length * 21 : '—'}<small>points</small></strong></div><div><span>TRACKING RATE</span><strong>{live && vision.trackerState === 'Ready' ? vision.fps : '—'}<small>fps</small></strong></div><div><span>INFERENCE</span><strong>{live && vision.trackerState === 'Ready' ? vision.inferenceMs : '—'}<small>ms</small></strong></div></div>
            <div className="tip"><span>01</span><p>Keep both hands in the frame with good lighting and a clear background.</p></div>
          </div>
          <aside className="inspector">
            <section><div className="section-heading"><h2>Tracking status</h2><Fingerprint size={18}/></div><div className="engine-status"><i className={vision.trackerState === 'Ready' ? 'ready' : ''}/><div>{vision.trackerState === 'Ready' ? 'Tracking enabled' : vision.trackerState === 'Not started' ? 'Ready to connect' : vision.trackerState}<small>{vision.trackerState === 'Ready' ? '21 landmarks per hand' : 'Start your camera to begin'}</small></div></div><div className="hand-slots">{[0,1].map(index => <div key={index} className={vision.hands[index] ? 'hand-slot detected' : 'hand-slot'}><Hand size={25} strokeWidth={1.3}/><span>{vision.hands[index] ? `Hand ${index+1}` : `Hand ${index+1}`}</span><small>{vision.hands[index] ? 'Detected' : 'Not detected'}</small></div>)}</div><p className="microcopy">Tracks hand position and movement. ASL recognition is not enabled yet.</p></section>
            <section className="capture-section"><div className="section-heading"><h2>Capture a sample</h2><span className="step-label">UP TO 30 SEC</span></div><p>Give your movement a label, then save its landmarks to your library.</p><label className="field-label" htmlFor="sample-label">Sample label</label><input id="sample-label" placeholder="e.g. Letter A, hello, practice" maxLength={80} value={label} disabled={recording || saving} onChange={event => setLabel(event.target.value)}/><button className={`primary record-button ${recording ? 'recording' : ''}`} disabled={!recording && (!live || vision.trackerState !== 'Ready' || !vision.hands.length || !label.trim() || saving)} onClick={() => recording ? void finish() : begin()}>{recording ? <Square size={15}/> : <span className="record-dot"/>}{recording ? `Save recording · ${seconds(elapsed)}` : saving ? 'Saving…' : 'Start recording'}</button><div className="capture-hint">{recording ? 'Landmarks are being captured. Save when finished.' : !live ? 'Start the camera to record a sample.' : !vision.hands.length ? 'Keep a hand in view to start recording.' : !label.trim() ? 'Add a label to start recording.' : 'Ready to record. No video or audio is saved.'}</div></section>
            <section className="library-teaser"><Database size={22} strokeWidth={1.4}/><h3>A library that stays yours.</h3><p>Samples are stored on this device. Export them whenever you need.</p><button onClick={() => setTab('library')}>Open my library <ArrowUpRight size={16}/></button></section>
          </aside>
        </section>
        {tab === 'library' && <section className="library-view"><div className="section-heading"><h2>Saved samples <span className="count">{recordings.length}</span></h2><span className="microcopy">Local storage · JSON export</span></div><p className="library-note">Export important samples as a backup. Clearing app data removes this library.</p>{recordings.length === 0 && <div className="library-empty"><Library size={46} strokeWidth={1}/><h2>Your first sample starts here.</h2><p>Record labeled hand movements in the tracking studio.</p><button className="primary" onClick={() => setTab('studio')}>Go to tracking studio <ArrowUpRight size={16}/></button></div>}{recordings.map(item => <div className="recording-row" key={item.id}><button className="recording-name" onClick={() => setSelected(item)}><span className="sample-icon"><Hand size={20}/></span><span><strong>{item.label}</strong><small>{new Date(item.createdAt).toLocaleString()} · {item.frames.length} frames</small></span></button><span className="duration">{seconds(item.durationMs)}</span><button className="icon-button" aria-label={`Export ${item.label}`} title="Export JSON" onClick={() => exportRecording(item)}><ArrowDownToLine size={18}/></button>{deleteId === item.id ? <><button className="delete-confirm" onClick={async () => { try { await deleteRecording(item.id); setDeleteId(''); await refresh(); } catch { setStorageError('Could not delete this sample. Please try again.'); } }}>Delete sample</button><button className="icon-button" aria-label="Cancel deletion" onClick={() => setDeleteId('')}><X size={17}/></button></> : <button className="icon-button" aria-label={`Delete ${item.label}`} onClick={() => setDeleteId(item.id)}><Trash2 size={17}/></button>}</div>)}{selected && <div className="sample-detail"><div><h2>{selected.label}</h2><p>{selected.frames.length} frames · {seconds(selected.durationMs)} · {selected.source.width} × {selected.source.height}</p><p>Includes timestamps, 3D hand landmarks, world landmarks, and handedness estimates. Coordinates are stored unmirrored.</p><button className="text-button" onClick={() => exportRecording(selected)}>Export sample <ArrowDownToLine size={16}/></button></div><button className="icon-button" aria-label="Close sample details" onClick={() => setSelected(null)}><X size={18}/></button></div>}</section>}
        <footer><span><ShieldCheck size={14}/> Camera frames stay on your device.</span><span>Built for the way you communicate.</span></footer>
      </div>
    </main>
    {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section className="help-dialog" role="dialog" aria-modal="true" aria-label="Getting started" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') setHelp(false); }}><button autoFocus className="icon-button dialog-close" aria-label="Close getting started" onClick={() => setHelp(false)}><X size={20}/></button><span className="eyebrow">GETTING STARTED</span><h2>Your first capture.</h2><ol><li><Camera size={20}/><div><strong>Connect your camera</strong><p>Select Start camera and allow camera access. On macOS, also allow it in System Settings → Privacy & Security → Camera.</p></div></li><li><ScanLine size={20}/><div><strong>Bring your hands into view</strong><p>Landmarks follow up to two hands. Good lighting helps the tracker stay accurate.</p></div></li><li><Play size={20}/><div><strong>Label, record, save</strong><p>Enter a sample label, record up to 30 seconds, and select Save recording. Export your samples from My library.</p></div></li></ol><p className="microcopy"><Pause size={14}/> Switching away from the app stops the camera and saves an active sample. Hand tracking does not translate ASL.</p><button className="primary" onClick={() => setHelp(false)}><Check size={17}/>Got it</button></section></div>}
  </div>;
}
