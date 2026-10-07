import { useEffect, useRef, useState } from 'react';
import './GooeyNav.css';

/**
 * A pill nav whose active pill melts from one item to the next in a burst of
 * particles (blur + contrast "goo", see GooeyNav.css).
 *
 * Props follow the usual GooeyNav API: items [{ label, href }],
 * particleCount, particleDistances [start, end], particleR, initialActiveIndex,
 * animationTime (ms), timeVariance (ms), colors (indices into --color-1..4).
 * `onNavigate(item, index)` is called after the burst so the move is seen;
 * without it, links behave as plain links.
 */

const noise = (n = 1) => n / 2 - Math.random() * n;

export default function GooeyNav({
  items,
  animationTime = 600,
  particleCount = 15,
  particleDistances = [90, 10],
  particleR = 100,
  timeVariance = 300,
  colors = [1, 2, 3, 1, 2, 3, 1, 4],
  initialActiveIndex = 0,
  onNavigate,
  className = '',
}) {
  const containerRef = useRef(null);
  const navRef = useRef(null);
  const filterRef = useRef(null);
  const textRef = useRef(null);
  const timers = useRef([]);
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const getXY = (distance, pointIndex, totalPoints) => {
    const angle = ((360 + noise(8)) / totalPoints) * pointIndex * (Math.PI / 180);
    return [distance * Math.cos(angle), distance * Math.sin(angle)];
  };

  const createParticle = (i, t, d, r) => {
    const rotate = noise(r / 10);
    return {
      start: getXY(d[0], particleCount - i, particleCount),
      end: getXY(d[1] + noise(7), particleCount - i, particleCount),
      time: t,
      scale: 1 + noise(0.2),
      color: colors[Math.floor(Math.random() * colors.length)],
      rotate: rotate > 0 ? (rotate + r / 20) * 10 : (rotate - r / 20) * 10,
    };
  };

  const makeParticles = (element) => {
    const bubbleTime = animationTime * 2 + timeVariance;
    element.style.setProperty('--time', `${bubbleTime}ms`);
    for (let i = 0; i < particleCount; i++) {
      const t = animationTime * 2 + noise(timeVariance * 2);
      const p = createParticle(i, t, particleDistances, particleR);
      element.classList.remove('active');
      later(() => {
        const particle = document.createElement('span');
        const point = document.createElement('span');
        particle.classList.add('particle');
        particle.style.setProperty('--start-x', `${p.start[0]}px`);
        particle.style.setProperty('--start-y', `${p.start[1]}px`);
        particle.style.setProperty('--end-x', `${p.end[0]}px`);
        particle.style.setProperty('--end-y', `${p.end[1]}px`);
        particle.style.setProperty('--time', `${p.time}ms`);
        particle.style.setProperty('--scale', `${p.scale}`);
        particle.style.setProperty('--color', `var(--color-${p.color}, white)`);
        particle.style.setProperty('--rotate', `${p.rotate}deg`);
        point.classList.add('point');
        particle.appendChild(point);
        element.appendChild(particle);
        requestAnimationFrame(() => element.classList.add('active'));
        later(() => particle.remove(), t);
      }, 30);
    }
  };

  const updateEffectPosition = (element) => {
    if (!containerRef.current || !filterRef.current || !textRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const pos = element.getBoundingClientRect();
    const styles = {
      left: `${pos.x - containerRect.x}px`,
      top: `${pos.y - containerRect.y}px`,
      width: `${pos.width}px`,
      height: `${pos.height}px`,
    };
    Object.assign(filterRef.current.style, styles);
    Object.assign(textRef.current.style, styles);
    textRef.current.innerText = element.innerText;
  };

  const activate = (li, index) => {
    if (activeIndex === index) return false;
    setActiveIndex(index);
    updateEffectPosition(li);
    filterRef.current?.querySelectorAll('.particle').forEach((p) => p.remove());
    if (textRef.current) {
      textRef.current.classList.remove('active');
      void textRef.current.offsetWidth; // restart the text transition
      textRef.current.classList.add('active');
    }
    if (filterRef.current) makeParticles(filterRef.current);
    return true;
  };

  const go = (e, index) => {
    const li = e.currentTarget.closest('li');
    const moved = activate(li, index);
    if (!onNavigate) return;
    e.preventDefault();
    // Let the burst play before the page changes.
    later(() => onNavigate(items[index], index), moved ? animationTime : 0);
  };

  useEffect(() => {
    if (!navRef.current || !containerRef.current) return undefined;
    const place = () => {
      const li = navRef.current?.querySelectorAll('li')[activeIndex];
      if (li) {
        updateEffectPosition(li);
        textRef.current?.classList.add('active');
      }
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [activeIndex]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <div className={`gooey-nav ${className}`} ref={containerRef}>
      <nav aria-label="Saakshi">
        <ul ref={navRef}>
          {items.map((item, index) => (
            <li key={item.label} className={activeIndex === index ? 'active' : ''}>
              <a
                href={item.href}
                onClick={(e) => go(e, index)}
                aria-current={activeIndex === index ? 'page' : undefined}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <span className="effect filter" ref={filterRef} />
      <span className="effect text" ref={textRef} aria-hidden="true" />
    </div>
  );
}
