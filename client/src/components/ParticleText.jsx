import { useEffect, useRef } from 'react';

/**
 * A word drawn as particles: they start scattered, gather into the letters
 * (staggered, eased), drift a little once formed, and push away from the
 * pointer — tinting toward `highlightColor` as they are displaced.
 *
 * The real text is rendered underneath in a transparent span, so the word
 * keeps its layout, stays selectable for screen readers, and the canvas only
 * paints over it. Sampling uses the span's own computed font, so whatever
 * font-size/stretch/weight the span gets (props or classes) is what the
 * particles spell. With reduced motion the particles are simply placed.
 *
 * Props follow the usual ParticleText API: particleSize, density (sampling
 * step in px), color, highlightColor, scatter (px the particles start out
 * from), gatherDuration and stagger (ms), pointerRepel (px) within
 * repelRadius (px), idleDrift (px), trigger ('mount'), fontSize, fontWeight,
 * fontFamily, glow.
 */

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const HIGHLIGHT_LEVELS = 4; // colour buckets, so a frame is a handful of fills

export default function ParticleText({
  text,
  particleSize = 2.2,
  density = 4,
  color = '#f8fafc',
  highlightColor = '#8b5cf6',
  scatter = 190,
  gatherDuration = 1600,
  stagger = 420,
  pointerRepel = 42,
  repelRadius = 120,
  idleDrift = 0.8,
  trigger = 'mount',
  fontSize,
  fontWeight = 800,
  fontFamily = 'inherit',
  fontStretch,
  glow = false,
  className = '',
  textClassName = '',
}) {
  const spanRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const span = spanRef.current;
    const canvas = canvasRef.current;
    if (!span || !canvas) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const base = hexToRgb(color);
    const hi = hexToRgb(highlightColor);
    const palette = Array.from({ length: HIGHLIGHT_LEVELS + 1 }, (_, k) => {
      const t = k / HIGHLIGHT_LEVELS;
      return `rgb(${base.map((v, i) => Math.round(v + (hi[i] - v) * t)).join(',')})`;
    });

    const st = {
      particles: [], w: 0, h: 0, pad: scatter, dpr: 1, scale: 1,
      start: 0, raf: 0, pointer: null, alive: true,
    };

    // Lay the text out in an offscreen canvas exactly as the span shows it,
    // then keep one particle per `density` px of inked area.
    const sample = () => {
      const rect = span.getBoundingClientRect();
      const cs = getComputedStyle(span);
      st.dpr = window.devicePixelRatio || 1;
      st.w = Math.ceil(rect.width);
      st.h = Math.ceil(rect.height);
      st.pad = scatter;

      const cw = st.w + st.pad * 2;
      const ch = st.h + st.pad * 2;
      canvas.style.left = `${-st.pad}px`;
      canvas.style.top = `${-st.pad}px`;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      canvas.width = Math.round(cw * st.dpr);
      canvas.height = Math.round(ch * st.dpr);

      const off = document.createElement('canvas');
      off.width = st.w;
      off.height = st.h;
      const ctx = off.getContext('2d', { willReadFrequently: true });
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      if ('fontStretch' in ctx) {
        // Canvas only takes keywords; map the span's percentage onto them.
        const pct = parseFloat(cs.fontStretch) || 100;
        const keys = [[50, 'ultra-condensed'], [62.5, 'extra-condensed'], [75, 'condensed'], [87.5, 'semi-condensed'], [100, 'normal'], [112.5, 'semi-expanded'], [125, 'expanded'], [150, 'extra-expanded'], [200, 'ultra-expanded']];
        ctx.fontStretch = keys.reduce((best, k) => (Math.abs(k[0] - pct) < Math.abs(best[0] - pct) ? k : best))[1];
      }
      ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      ctx.fillStyle = '#000';
      ctx.textBaseline = 'alphabetic';
      const m = ctx.measureText(text);
      const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
      const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
      // Centre the font box in the line box, as the browser does.
      const y = (st.h - (ascent + descent)) / 2 + ascent;
      ctx.fillText(text, 0, y);

      const data = ctx.getImageData(0, 0, st.w, st.h).data;
      // density and particleSize are tuned for display-size type (~160px);
      // smaller type samples finer with smaller particles, or it stops reading.
      st.scale = Math.min(1, Math.max(0.5, parseFloat(cs.fontSize) / 160));
      const step = Math.max(1, Math.round(density * st.scale));
      const particles = [];
      for (let py = 0; py < st.h; py += step) {
        for (let px = 0; px < st.w; px += step) {
          if (data[(py * st.w + px) * 4 + 3] < 128) continue;
          const tx = px + st.pad;
          const ty = py + st.pad;
          const angle = Math.random() * Math.PI * 2;
          const dist = scatter * (0.35 + Math.random() * 0.65);
          particles.push({
            tx, ty,
            sx: tx + Math.cos(angle) * dist,
            sy: ty + Math.sin(angle) * dist,
            delay: Math.random() * stagger,
            phase: Math.random() * Math.PI * 2,
            ox: 0, oy: 0, // pointer displacement, eased
            x: tx, y: ty,
          });
        }
      }
      st.particles = particles;
    };

    const frame = (now) => {
      if (!st.alive) return;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      ctx.clearRect(0, 0, st.w + st.pad * 2, st.h + st.pad * 2);

      const elapsed = now - st.start;
      const p = st.pointer;
      const r2 = repelRadius * repelRadius;
      const buckets = Array.from({ length: HIGHLIGHT_LEVELS + 1 }, () => []);
      const t = now / 1000;

      for (const q of st.particles) {
        const g = reduced ? 1 : easeOutCubic(Math.min(1, Math.max(0, (elapsed - q.delay) / gatherDuration)));
        let x = q.sx + (q.tx - q.sx) * g;
        let y = q.sy + (q.ty - q.sy) * g;

        if (!reduced) {
          // Drift fades in as the particle lands.
          x += Math.sin(t * 1.3 + q.phase) * idleDrift * st.scale * g;
          y += Math.cos(t * 1.1 + q.phase * 1.7) * idleDrift * st.scale * g;

          let gx = 0;
          let gy = 0;
          if (p) {
            const dx = x - p.x;
            const dy = y - p.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < r2 && d2 > 0.01) {
              const d = Math.sqrt(d2);
              const f = Math.pow(1 - d / repelRadius, 2) * pointerRepel;
              gx = (dx / d) * f;
              gy = (dy / d) * f;
            }
          }
          q.ox += (gx - q.ox) * 0.18;
          q.oy += (gy - q.oy) * 0.18;
          x += q.ox;
          y += q.oy;
        }

        const shift = Math.min(1, Math.hypot(q.ox, q.oy) / (pointerRepel * 0.6 || 1));
        buckets[Math.round(shift * HIGHLIGHT_LEVELS)].push(x, y);
      }

      const r = Math.max(0.6, (particleSize * st.scale) / 2);
      if (glow) {
        ctx.shadowBlur = 8;
      }
      buckets.forEach((pts, k) => {
        if (!pts.length) return;
        ctx.fillStyle = palette[k];
        if (glow) ctx.shadowColor = k === 0 ? `rgba(${base.join(',')},0.45)` : `rgba(${hi.join(',')},0.7)`;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i += 2) {
          ctx.moveTo(pts[i] + r, pts[i + 1]);
          ctx.arc(pts[i], pts[i + 1], r, 0, Math.PI * 2);
        }
        ctx.fill();
      });

      // Reduced motion: one still frame. Otherwise keep breathing, but only
      // while the tab is visible.
      if (!reduced && !document.hidden) st.raf = requestAnimationFrame(frame);
    };

    const startAnimation = () => {
      cancelAnimationFrame(st.raf);
      sample();
      st.start = performance.now();
      st.raf = requestAnimationFrame(frame);
    };

    const onPointerMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      st.pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onPointerLeave = () => { st.pointer = null; };
    const onVisibility = () => {
      if (!document.hidden && !reduced) {
        cancelAnimationFrame(st.raf);
        st.raf = requestAnimationFrame(frame);
      }
    };
    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      // Re-sample once the resize settles; particles re-form from the new text.
      resizeTimer = setTimeout(startAnimation, 150);
    };

    // Sample only after the web font is in, or the particles spell the fallback.
    const cs = getComputedStyle(span);
    const fontSpec = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    (document.fonts ? document.fonts.load(fontSpec, text).then(() => document.fonts.ready) : Promise.resolve())
      .catch(() => {})
      .then(() => { if (st.alive && trigger === 'mount') startAnimation(); });

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize);
    return () => {
      st.alive = false;
      cancelAnimationFrame(st.raf);
      clearTimeout(resizeTimer);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
    };
  }, [text, particleSize, density, color, highlightColor, scatter, gatherDuration, stagger, pointerRepel, repelRadius, idleDrift, trigger, glow]);

  return (
    <span className={`relative inline-block ${className}`}>
      {/* The real word: sets the size, carries the text for screen readers,
          and stays invisible so only the particles show. */}
      <span
        ref={spanRef}
        className={`block whitespace-nowrap text-transparent ${textClassName}`}
        style={{ fontSize, fontWeight, fontFamily, fontStretch }}
      >
        {text}
      </span>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute" />
    </span>
  );
}
