import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The login wall: a picture rebuilt from square cells on the blackboard, each
 * cell a record. It assembles once on arrival, left to right like a line being
 * written; cells lift and turn gold wherever something moves — the pointer by
 * default, or the viewer themselves if they switch their camera on.
 *
 * Adapted from Aceternity's WebcamPixelGrid (frame-diff motion → elevated 3D
 * cells), with three changes: the source is a photo unless the viewer opts in
 * to the camera (a login page should never prompt for it on its own), colour
 * is mapped onto the app's board → chalk → gold palette, and the loop stops
 * when nothing is moving so an idle tab costs nothing.
 *
 * Children render above the canvas; pointer movement over them still reaches
 * the wall because the listener sits on this wrapper.
 */

const BOARD = [23, 33, 31]; // board
const CELL_EMPTY = [30, 43, 40]; // board-700
const CHALK = [241, 242, 238]; // paper
const GOLD = [233, 168, 58]; // gold-bright

const MAX_LIFT = 13; // px a fully-moved cell rises
const POINTER_RADIUS = 130; // px around the pointer that feels its motion
const APPEAR_MS = 320; // one cell fading in
const WRITE_MS = 900; // the left-to-right sweep across the whole wall

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const luminance = (d, i) => (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
// Cap the highlights so the picture reads as chalk on a board and never
// glares under the headline.
const toChalk = (l) => Math.pow(clamp01(l), 1.15) * 0.9;

// Stretch a frame's luminance to its own 3rd–97th percentile. Photos taken in
// flat afternoon light otherwise collapse into one mid-grey at this
// resolution and stop reading as a picture.
function levels(lum) {
  const sorted = Float32Array.from(lum).sort();
  const lo = sorted[Math.floor(sorted.length * 0.03)];
  const hi = sorted[Math.floor(sorted.length * 0.97)];
  const span = Math.max(0.08, hi - lo);
  return (l) => clamp01((l - lo) / span);
}

// Draw `source` into a cols×rows canvas cropped like object-fit: cover.
function drawCover(ctx, source, sw, sh, cols, rows, mirror) {
  const target = cols / rows;
  const actual = sw / sh;
  let cw = sw;
  let ch = sh;
  if (actual > target) cw = sh * target;
  else ch = sw / target;
  const cx = (sw - cw) / 2;
  const cy = (sh - ch) / 2;
  ctx.save();
  if (mirror) {
    ctx.translate(cols, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, cx, cy, cw, ch, 0, 0, cols, rows);
  ctx.restore();
}

function CameraIcon({ off }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14" />
      <rect x="3" y="6" width="12" height="12" rx="2" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

export default function WitnessGrid({ image, label, className = '', children }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const sampleRef = useRef(null);
  const streamRef = useRef(null);
  const imageRef = useRef(null);
  const [camera, setCamera] = useState('off'); // off | starting | on | error

  // Everything the render loop touches lives here, not in React state: it
  // changes sixty times a second and nothing outside the canvas reads it.
  const s = useRef({
    w: 0, h: 0, cell: 14, cols: 0, rows: 0, ox: 0, oy: 0,
    bright: null, target: null, photo: null, lift: null, motion: null, delay: null, prevLum: null,
    start: 0, raf: 0, running: false, camera: false,
    impulses: [], lastPointer: null,
    reduced: false,
  });

  const samplePhoto = useCallback(() => {
    const st = s.current;
    const img = imageRef.current;
    if (!img || !st.cols) return;
    const c = sampleRef.current;
    c.width = st.cols;
    c.height = st.rows;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    drawCover(ctx, img, img.naturalWidth, img.naturalHeight, st.cols, st.rows, false);
    const d = ctx.getImageData(0, 0, st.cols, st.rows).data;
    const n = st.cols * st.rows;
    const lum = new Float32Array(n);
    for (let i = 0; i < n; i++) lum[i] = luminance(d, i * 4);
    const stretch = levels(lum);
    for (let i = 0; i < n; i++) {
      st.photo[i] = toChalk(stretch(lum[i]));
      if (!st.camera) st.target[i] = st.photo[i];
    }
  }, []);

  const draw = useCallback((now) => {
    const st = s.current;
    const canvas = canvasRef.current;
    if (!canvas || !st.cols) return false;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Camera: resample the video into the grid and diff it against the last
    // frame — the original component's motion detection.
    const video = videoRef.current;
    if (st.camera && video && video.readyState >= 2) {
      const c = sampleRef.current;
      const sctx = c.getContext('2d', { willReadFrequently: true });
      drawCover(sctx, video, video.videoWidth, video.videoHeight, st.cols, st.rows, true);
      const d = sctx.getImageData(0, 0, st.cols, st.rows).data;
      const n = st.cols * st.rows;
      const lum = new Float32Array(n);
      for (let i = 0; i < n; i++) lum[i] = luminance(d, i * 4);
      const stretch = levels(lum);
      for (let i = 0; i < n; i++) {
        const l = lum[i];
        st.target[i] = toChalk(stretch(l));
        const m = st.prevLum[i] < 0 ? 0 : clamp01(Math.abs(l - st.prevLum[i]) * 7);
        st.motion[i] = Math.max(st.motion[i], m);
        st.prevLum[i] = l;
      }
    }

    // Pointer: every move since the last frame stirs the cells around it,
    // harder the faster it went.
    if (!st.reduced) {
      for (const { x, y, amount } of st.impulses) {
        const r = POINTER_RADIUS;
        const c0 = Math.max(0, Math.floor((x - st.ox - r) / st.cell));
        const c1 = Math.min(st.cols - 1, Math.ceil((x - st.ox + r) / st.cell));
        const r0 = Math.max(0, Math.floor((y - st.oy - r) / st.cell));
        const r1 = Math.min(st.rows - 1, Math.ceil((y - st.oy + r) / st.cell));
        for (let row = r0; row <= r1; row++) {
          for (let col = c0; col <= c1; col++) {
            const cx = st.ox + (col + 0.5) * st.cell;
            const cy = st.oy + (row + 0.5) * st.cell;
            const dist = Math.hypot(cx - x, cy - y);
            if (dist >= r) continue;
            const i = row * st.cols + col;
            const falloff = 1 - dist / r;
            st.motion[i] = Math.max(st.motion[i], amount * falloff * falloff);
          }
        }
      }
    }
    st.impulses.length = 0;

    ctx.fillStyle = `rgb(${BOARD[0]},${BOARD[1]},${BOARD[2]})`;
    ctx.fillRect(0, 0, st.w, st.h);

    const gap = Math.max(1, st.cell * 0.14);
    const size = st.cell - gap;
    const elapsed = now - st.start;
    let busy = st.camera;

    for (let row = 0; row < st.rows; row++) {
      for (let col = 0; col < st.cols; col++) {
        const i = row * st.cols + col;

        const appear = st.reduced ? 1 : clamp01((elapsed - st.delay[i]) / APPEAR_MS);
        if (appear < 1) busy = true;

        st.bright[i] += (st.target[i] - st.bright[i]) * (st.camera ? 0.35 : 0.2);
        if (Math.abs(st.target[i] - st.bright[i]) > 0.002) busy = true;

        st.motion[i] *= st.camera ? 0.8 : 0.93;
        const goal = st.reduced ? 0 : st.motion[i] * MAX_LIFT;
        st.lift[i] += (goal - st.lift[i]) * 0.14;
        const e = st.lift[i];
        if (e > 0.05) busy = true;

        const x = st.ox + col * st.cell + gap / 2;
        const y = st.oy + row * st.cell + gap / 2;

        if (appear <= 0) {
          // Not yet written: an empty square of the register.
          ctx.fillStyle = `rgb(${CELL_EMPTY[0]},${CELL_EMPTY[1]},${CELL_EMPTY[2]})`;
          ctx.fillRect(x, y, size, size);
          continue;
        }

        const b = st.bright[i] * appear;
        const k = Math.min(1, e / MAX_LIFT) * 0.95;
        let r = CELL_EMPTY[0] + (CHALK[0] - CELL_EMPTY[0]) * b;
        let g = CELL_EMPTY[1] + (CHALK[1] - CELL_EMPTY[1]) * b;
        let bl = CELL_EMPTY[2] + (CHALK[2] - CELL_EMPTY[2]) * b;
        r += (GOLD[0] - r) * k;
        g += (GOLD[1] - g) * k;
        bl += (GOLD[2] - bl) * k;

        if (e > 0.4) {
          const dx = -e * 0.8;
          const dy = -e * 1.2;
          ctx.fillStyle = `rgba(0,0,0,${Math.min(0.55, e * 0.06)})`;
          ctx.fillRect(x + e * 0.6, y + e * 0.9, size, size);
          // Right and bottom faces, so a lifted cell reads as a block.
          ctx.fillStyle = `rgb(${Math.max(0, r - 90) | 0},${Math.max(0, g - 90) | 0},${Math.max(0, bl - 90) | 0})`;
          ctx.beginPath();
          ctx.moveTo(x + size + dx, y + dy);
          ctx.lineTo(x + size, y);
          ctx.lineTo(x + size, y + size);
          ctx.lineTo(x + size + dx, y + size + dy);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = `rgb(${Math.max(0, r - 55) | 0},${Math.max(0, g - 55) | 0},${Math.max(0, bl - 55) | 0})`;
          ctx.beginPath();
          ctx.moveTo(x + dx, y + size + dy);
          ctx.lineTo(x, y + size);
          ctx.lineTo(x + size, y + size);
          ctx.lineTo(x + size + dx, y + size + dy);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = `rgb(${r | 0},${g | 0},${bl | 0})`;
          ctx.fillRect(x + dx, y + dy, size, size);
        } else {
          ctx.fillStyle = `rgb(${r | 0},${g | 0},${bl | 0})`;
          ctx.fillRect(x, y, size, size);
        }
      }
    }
    return busy;
  }, []);

  const loop = useCallback((now) => {
    const st = s.current;
    const busy = draw(now);
    if (busy || st.impulses.length) {
      st.raf = requestAnimationFrame(loop);
    } else {
      st.running = false;
    }
  }, [draw]);

  const kick = useCallback(() => {
    const st = s.current;
    if (st.running) return;
    st.running = true;
    st.raf = requestAnimationFrame(loop);
  }, [loop]);

  const layout = useCallback(() => {
    const st = s.current;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const { width, height } = wrap.getBoundingClientRect();
    if (!width || !height) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    st.w = width;
    st.h = height;
    st.cell = width < 640 ? 14 : 22;
    const cols = Math.ceil(width / st.cell);
    const rows = Math.ceil(height / st.cell);
    const resized = cols !== st.cols || rows !== st.rows;
    st.cols = cols;
    st.rows = rows;
    st.ox = (width - cols * st.cell) / 2;
    st.oy = (height - rows * st.cell) / 2;
    if (resized) {
      const n = cols * rows;
      st.bright = new Float32Array(n);
      st.target = new Float32Array(n);
      st.photo = new Float32Array(n);
      st.lift = new Float32Array(n);
      st.motion = new Float32Array(n);
      st.prevLum = new Float32Array(n).fill(-1);
      st.delay = new Float32Array(n);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Written left to right, a little ragged, like a line of handwriting.
          st.delay[row * cols + col] = (col / cols) * WRITE_MS + Math.random() * 380;
        }
      }
      samplePhoto();
      if (!st.camera) st.bright.set(st.target);
    }
    kick();
  }, [kick, samplePhoto]);

  // Mount: size the wall, load the photo, then start the one-time write.
  useEffect(() => {
    const st = s.current;
    st.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    sampleRef.current = document.createElement('canvas');
    layout();

    let cancelled = false;
    const img = new Image();
    img.src = image;
    img.decode().then(() => {
      if (cancelled) return;
      imageRef.current = img;
      samplePhoto();
      st.bright.set(st.target);
      st.start = performance.now();
      kick();
    }).catch(() => { /* the empty register is still a fine background */ });

    const observer = new ResizeObserver(layout);
    observer.observe(wrapRef.current);
    return () => {
      cancelled = true;
      observer.disconnect();
      cancelAnimationFrame(st.raf);
      st.running = false;
    };
  }, [image, kick, layout, samplePhoto]);

  // Always release the camera when the page goes away.
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const onPointerMove = (e) => {
    const st = s.current;
    if (st.reduced) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = performance.now();
    const last = st.lastPointer;
    st.lastPointer = { x, y, t: now };
    if (!last || now - last.t > 120) return;
    const speed = Math.hypot(x - last.x, y - last.y) / Math.max(1, now - last.t); // px/ms
    st.impulses.push({ x, y, amount: clamp01(speed * 1.4) });
    kick();
  };

  const startCamera = async () => {
    setCamera('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      s.current.prevLum.fill(-1);
      s.current.camera = true;
      setCamera('on');
      kick();
    } catch {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCamera('error');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const st = s.current;
    st.camera = false;
    if (st.photo) st.target.set(st.photo);
    setCamera('off');
    kick();
  };

  const cameraOn = camera === 'on';

  return (
    <div ref={wrapRef} onPointerMove={onPointerMove} className={`relative overflow-hidden bg-board ${className}`}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={cameraOn ? 'Your camera, drawn as a grid of squares.' : label}
        className="absolute inset-0 h-full w-full"
      />
      <video ref={videoRef} className="hidden" playsInline muted />

      {children}

      {/* Same inset as the page's own padding, so it sits level with the wordmark. */}
      <div className="absolute right-5 top-5 z-10 flex flex-col items-end gap-1.5 sm:right-8 sm:top-8 lg:right-12 lg:top-12 xl:right-16 xl:top-16">
        <button
          type="button"
          onClick={cameraOn ? stopCamera : startCamera}
          disabled={camera === 'starting'}
          aria-pressed={cameraOn}
          aria-label={cameraOn ? 'Stop camera' : 'Use my camera'}
          className="inline-flex h-9 min-w-9 items-center justify-center gap-2 rounded-md border border-board-500 bg-board/80 px-2.5 text-[13px] text-paper backdrop-blur-sm transition-colors hover:border-board-400 hover:bg-board-700 disabled:opacity-60 sm:px-3"
        >
          <CameraIcon off={cameraOn} />
          {/* Icon-only on phones, where the wordmark needs the row. */}
          <span className="hidden sm:inline">
            {cameraOn ? 'Stop camera' : camera === 'starting' ? 'Starting camera' : 'Use my camera'}
          </span>
        </button>
        {cameraOn && (
          <p className="max-w-[16rem] rounded bg-board/80 px-2 py-1 text-right text-[12px] leading-snug text-board-400 backdrop-blur-sm">
            Only this screen sees it. Nothing is saved or sent.
          </p>
        )}
        {camera === 'error' && (
          <p role="status" className="max-w-[16rem] rounded bg-board/80 px-2 py-1 text-right text-[12px] leading-snug text-board-400 backdrop-blur-sm">
            No camera available. Allow camera access in your browser to try it.
          </p>
        )}
      </div>
    </div>
  );
}
