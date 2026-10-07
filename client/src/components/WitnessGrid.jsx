import { useCallback, useEffect, useRef } from 'react';

/**
 * The login wall: a photo from the club's sessions rebuilt from square cells
 * across the whole screen, each cell a record. It assembles once on arrival,
 * left to right like a line being written; cells lift and turn gold wherever
 * the pointer moves, then settle.
 *
 * Adapted from Aceternity's WebcamPixelGrid (motion → elevated 3D cells), with
 * a still photo for the source, the photo's own colours muted toward the
 * board, and a loop that stops when nothing is moving so an idle tab costs
 * nothing. It sits fixed behind the page and listens to the window, so the
 * copy and form layered over it never block the effect.
 */

const BOARD = [23, 33, 31]; // board
const CELL_EMPTY = [30, 43, 40]; // board-700
const GOLD = [233, 168, 58]; // gold-bright

const MAX_LIFT = 13; // px a fully-moved cell rises
const POINTER_RADIUS = 130; // px around the pointer that feels its motion
const APPEAR_MS = 320; // one cell fading in
const WRITE_MS = 900; // the left-to-right sweep across the whole wall
const SATURATION = 0.75; // how much of the photo's colour survives
const BRIGHTNESS = 0.95; // cap, so the picture never glares under the copy

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const luminance = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

// Stretch a photo's luminance to its own 3rd–97th percentile. Photos taken in
// flat afternoon light otherwise collapse into one mid-tone at this
// resolution and stop reading as a picture.
function levels(lum) {
  const sorted = Float32Array.from(lum).sort();
  const lo = sorted[Math.floor(sorted.length * 0.03)];
  const hi = sorted[Math.floor(sorted.length * 0.97)];
  const span = Math.max(0.08, hi - lo);
  return (l) => clamp01((l - lo) / span);
}

// Draw `img` into a cols×rows canvas cropped like object-fit: cover.
function drawCover(ctx, img, cols, rows) {
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const target = cols / rows;
  let cw = sw;
  let ch = sh;
  if (sw / sh > target) cw = sh * target;
  else ch = sw / target;
  ctx.drawImage(img, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, cols, rows);
}

export default function WitnessGrid({ image, label, className = '' }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  // Everything the render loop touches lives here, not in React state: it
  // changes sixty times a second and nothing outside the canvas reads it.
  const s = useRef({
    w: 0, h: 0, cell: 22, cols: 0, rows: 0, ox: 0, oy: 0,
    rgb: null, lift: null, motion: null, delay: null,
    start: 0, raf: 0, running: false,
    impulses: [], lastPointer: null, reduced: false,
  });

  const sample = useCallback(() => {
    const st = s.current;
    const img = imageRef.current;
    if (!img || !st.cols) return;
    const c = document.createElement('canvas');
    c.width = st.cols;
    c.height = st.rows;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    drawCover(ctx, img, st.cols, st.rows);
    const d = ctx.getImageData(0, 0, st.cols, st.rows).data;
    const n = st.cols * st.rows;
    const lum = new Float32Array(n);
    for (let i = 0; i < n; i++) lum[i] = luminance(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    const stretch = levels(lum);
    for (let i = 0; i < n; i++) {
      const l = lum[i];
      const target = stretch(l) * BRIGHTNESS;
      // Keep the hue, set the brightness, then pull the colour toward grey.
      const k = target / Math.max(0.02, l);
      for (let ch = 0; ch < 3; ch++) {
        const v = clamp01((d[i * 4 + ch] / 255) * k);
        const muted = target + (v - target) * SATURATION;
        st.rgb[i * 3 + ch] = CELL_EMPTY[ch] + (255 - CELL_EMPTY[ch]) * clamp01(muted);
      }
    }
  }, []);

  const draw = useCallback((now) => {
    const st = s.current;
    const canvas = canvasRef.current;
    if (!canvas || !st.cols) return false;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Every pointer move since the last frame stirs the cells around it,
    // harder the faster it went.
    for (const { x, y, amount } of st.impulses) {
      const r = POINTER_RADIUS;
      const c0 = Math.max(0, Math.floor((x - st.ox - r) / st.cell));
      const c1 = Math.min(st.cols - 1, Math.ceil((x - st.ox + r) / st.cell));
      const r0 = Math.max(0, Math.floor((y - st.oy - r) / st.cell));
      const r1 = Math.min(st.rows - 1, Math.ceil((y - st.oy + r) / st.cell));
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const dist = Math.hypot(st.ox + (col + 0.5) * st.cell - x, st.oy + (row + 0.5) * st.cell - y);
          if (dist >= r) continue;
          const i = row * st.cols + col;
          const falloff = 1 - dist / r;
          st.motion[i] = Math.max(st.motion[i], amount * falloff * falloff);
        }
      }
    }
    st.impulses.length = 0;

    ctx.fillStyle = `rgb(${BOARD[0]},${BOARD[1]},${BOARD[2]})`;
    ctx.fillRect(0, 0, st.w, st.h);

    const gap = Math.max(1, st.cell * 0.14);
    const size = st.cell - gap;
    const elapsed = now - st.start;
    const loaded = Boolean(imageRef.current);
    let busy = false;

    for (let row = 0; row < st.rows; row++) {
      for (let col = 0; col < st.cols; col++) {
        const i = row * st.cols + col;
        const x = st.ox + col * st.cell + gap / 2;
        const y = st.oy + row * st.cell + gap / 2;

        const appear = !loaded ? 0 : st.reduced ? 1 : clamp01((elapsed - st.delay[i]) / APPEAR_MS);
        if (loaded && appear < 1) busy = true;

        st.motion[i] *= 0.93;
        st.lift[i] += ((st.reduced ? 0 : st.motion[i] * MAX_LIFT) - st.lift[i]) * 0.14;
        const e = st.lift[i];
        if (e > 0.05) busy = true;

        if (appear <= 0) {
          // Not yet written: an empty square of the register.
          ctx.fillStyle = `rgb(${CELL_EMPTY[0]},${CELL_EMPTY[1]},${CELL_EMPTY[2]})`;
          ctx.fillRect(x, y, size, size);
          continue;
        }

        const gold = Math.min(1, e / MAX_LIFT) * 0.95;
        let r = CELL_EMPTY[0] + (st.rgb[i * 3] - CELL_EMPTY[0]) * appear;
        let g = CELL_EMPTY[1] + (st.rgb[i * 3 + 1] - CELL_EMPTY[1]) * appear;
        let b = CELL_EMPTY[2] + (st.rgb[i * 3 + 2] - CELL_EMPTY[2]) * appear;
        r += (GOLD[0] - r) * gold;
        g += (GOLD[1] - g) * gold;
        b += (GOLD[2] - b) * gold;

        if (e > 0.4) {
          const dx = -e * 0.8;
          const dy = -e * 1.2;
          ctx.fillStyle = `rgba(0,0,0,${Math.min(0.55, e * 0.06)})`;
          ctx.fillRect(x + e * 0.6, y + e * 0.9, size, size);
          // Right and bottom faces, so a lifted cell reads as a block.
          ctx.fillStyle = `rgb(${Math.max(0, r - 90) | 0},${Math.max(0, g - 90) | 0},${Math.max(0, b - 90) | 0})`;
          ctx.beginPath();
          ctx.moveTo(x + size + dx, y + dy);
          ctx.lineTo(x + size, y);
          ctx.lineTo(x + size, y + size);
          ctx.lineTo(x + size + dx, y + size + dy);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = `rgb(${Math.max(0, r - 55) | 0},${Math.max(0, g - 55) | 0},${Math.max(0, b - 55) | 0})`;
          ctx.beginPath();
          ctx.moveTo(x + dx, y + size + dy);
          ctx.lineTo(x, y + size);
          ctx.lineTo(x + size, y + size);
          ctx.lineTo(x + size + dx, y + size + dy);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
          ctx.fillRect(x + dx, y + dy, size, size);
        } else {
          ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
          ctx.fillRect(x, y, size, size);
        }
      }
    }
    return busy;
  }, []);

  const loop = useCallback((now) => {
    const st = s.current;
    if (draw(now) || st.impulses.length) {
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    st.w = width;
    st.h = height;
    st.cell = width < 640 ? 12 : 16;
    const cols = Math.ceil(width / st.cell);
    const rows = Math.ceil(height / st.cell);
    const resized = cols !== st.cols || rows !== st.rows;
    st.cols = cols;
    st.rows = rows;
    st.ox = (width - cols * st.cell) / 2;
    st.oy = (height - rows * st.cell) / 2;
    if (resized) {
      const n = cols * rows;
      st.rgb = new Float32Array(n * 3);
      st.lift = new Float32Array(n);
      st.motion = new Float32Array(n);
      st.delay = new Float32Array(n);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Written left to right, a little ragged, like a line of handwriting.
          st.delay[row * cols + col] = (col / cols) * WRITE_MS + Math.random() * 380;
        }
      }
      sample();
    }
    kick();
  }, [kick, sample]);

  useEffect(() => {
    const st = s.current;
    st.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    layout();

    let cancelled = false;
    const img = new Image();
    img.src = image;
    img.decode().then(() => {
      if (cancelled) return;
      imageRef.current = img;
      sample();
      st.start = performance.now();
      kick();
    }).catch(() => { /* the empty register is still a fine background */ });

    const onPointerMove = (e) => {
      if (st.reduced) return;
      const now = performance.now();
      const last = st.lastPointer;
      st.lastPointer = { x: e.clientX, y: e.clientY, t: now };
      if (!last || now - last.t > 120) return;
      const speed = Math.hypot(e.clientX - last.x, e.clientY - last.y) / Math.max(1, now - last.t); // px/ms
      st.impulses.push({ x: e.clientX, y: e.clientY, amount: clamp01(speed * 1.4) });
      kick();
    };

    window.addEventListener('resize', layout);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      cancelled = true;
      window.removeEventListener('resize', layout);
      window.removeEventListener('pointermove', onPointerMove);
      cancelAnimationFrame(st.raf);
      st.running = false;
    };
  }, [image, kick, layout, sample]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className={`fixed inset-0 h-full w-full ${className}`}
    />
  );
}
