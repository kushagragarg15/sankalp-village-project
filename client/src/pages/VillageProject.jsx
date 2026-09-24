import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Lightbox from '../components/Lightbox';
import { GALLERY, PHOTOS } from '../data/villagePhotos';
import logoImage from '../assets/sankalp-logo.jpg';

// The public page about the work the app exists for. Paper ground, board ink,
// hairline rules — the same system as the app, with the photographs carrying
// the colour. Gold stays out: nothing here is live.

const STEPS = [
  {
    photo: PHOTOS.sunsetGroup,
    title: 'We go to them',
    body: 'Volunteers travel from campus to the village school for a fixed session window. A coordinator opens the session in the app before anyone arrives.',
  },
  {
    photo: PHOTOS.countingTogether,
    title: 'One child, one notebook',
    body: 'Each volunteer sits with a few children and works through what they need that day: sums, reading, spelling. Small groups, the same faces week after week.',
  },
  {
    photo: PHOTOS.verandahLesson,
    title: 'Every lesson, on the record',
    body: 'Before leaving, volunteers log what each child was taught. A code shown on site and a location check mean the record can only be written from the school.',
  },
  {
    photo: PHOTOS.handpumpReading,
    title: 'Next week, already planned',
    body: 'An AI assistant reads each child’s history and drafts the next session’s plan. The volunteer who teaches it edits and signs off.',
  },
];

// Fades and un-blurs children into place the first time they scroll into
// view — the entrance React Bits' Masonry uses, done with an observer and a
// CSS transition. Reduced motion shows everything at once.
function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      setShown(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(24px)',
        filter: shown ? 'none' : 'blur(8px)',
        transition: 'opacity 700ms ease-out, transform 900ms cubic-bezier(0.16, 1, 0.3, 1), filter 700ms ease-out',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </Tag>
  );
}

function Eyebrow({ children }) {
  return (
    <p className="flex items-center gap-3 text-[13px] font-medium text-ink-2">
      <span aria-hidden="true" className="h-px w-8 bg-ink-3" />
      {children}
    </p>
  );
}

// An endless strip of prints between the hero and the story. The set is
// rendered twice so the -50% loop joins up; hover pauses it.
function PhotoStrip({ photos }) {
  const loop = [...photos, ...photos];
  return (
    <div className="group relative overflow-hidden border-y border-rule bg-paper-deep py-6" aria-hidden="true">
      <div className="flex w-max animate-marquee gap-4 group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        {loop.map((p, i) => (
          <div
            key={`${p.id}-${i}`}
            className="h-40 shrink-0 rounded-[3px] bg-surface p-1 ring-1 ring-rule sm:h-48"
            style={{ transform: `rotate(${[-1.5, 1, -0.5, 1.5][i % 4]}deg)` }}
          >
            <img
              src={p.small}
              alt=""
              loading="lazy"
              className={`h-full rounded-[2px] object-cover ${p.shape === 'square' ? 'aspect-square' : 'aspect-[4/5]'}`}
            />
          </div>
        ))}
      </div>
      {/* Soft edges so prints drift in and out rather than being cut. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-paper-deep to-transparent sm:w-28" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-paper-deep to-transparent sm:w-28" />
    </div>
  );
}

export default function VillageProject() {
  const { user } = useAuth();
  const [openIndex, setOpenIndex] = useState(null);

  useEffect(() => {
    const previous = document.title;
    document.title = 'The village project · Sankalp Club';
    return () => {
      document.title = previous;
    };
  }, []);

  const appLink = user ? { to: '/dashboard', label: 'Open the app' } : { to: '/login', label: 'Sign in' };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-rule bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/village" className="flex items-center gap-2.5">
            <img src={logoImage} alt="" className="h-8 w-8 rounded object-cover" />
            <span className="type-title text-[15px]">Sankalp Club</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Page">
            <a href="#work" className="hidden rounded-md px-3 py-2 text-sm text-ink-2 hover:bg-paper-deep hover:text-ink sm:inline-block">
              How it works
            </a>
            <a href="#photos" className="hidden rounded-md px-3 py-2 text-sm text-ink-2 hover:bg-paper-deep hover:text-ink sm:inline-block">
              Photos
            </a>
            <Link
              to={appLink.to}
              className="ml-1 inline-flex h-9 items-center rounded-md bg-board px-3.5 text-sm font-medium text-paper transition-colors hover:bg-board-600"
            >
              {appLink.label}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero: the claim on the left, the afternoon on the right. */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24">
          <div className="animate-rise-in">
            <Eyebrow>The village project</Eyebrow>
            <h1 className="type-display mt-5 max-w-[16ch] text-[clamp(2.4rem,5.2vw,4.4rem)]">
              Every weekend, a school verandah becomes a classroom.
            </h1>
            <p className="mt-6 max-w-[50ch] text-[17px] leading-relaxed text-ink-2">
              Sankalp Club is a student volunteer group at LNMIIT, Jaipur. On weekends we go to a village
              school near campus and teach: one notebook, one child at a time. This app is how we keep
              track of every lesson.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/login"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-board px-5 text-sm font-medium text-paper transition-colors hover:bg-board-600"
              >
                Try the live demo <span aria-hidden="true">&rarr;</span>
              </Link>
              <a
                href="#photos"
                className="inline-flex h-11 items-center rounded-md border border-rule-strong px-5 text-sm font-medium text-ink transition-colors hover:border-ink-3 hover:bg-surface"
              >
                See the photos
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[30rem] animate-rise-in pb-10 lg:max-w-none" style={{ animationDelay: '120ms' }}>
            <button
              type="button"
              onClick={() => setOpenIndex(GALLERY.indexOf(PHOTOS.girlDiary))}
              className="ml-auto block w-[80%] overflow-hidden rounded-lg ring-1 ring-rule"
              aria-label={`Open photo: ${PHOTOS.girlDiary.caption}`}
            >
              <img
                src={PHOTOS.girlDiary.src}
                alt={PHOTOS.girlDiary.alt}
                className="aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out hover:scale-[1.03]"
              />
            </button>
            <button
              type="button"
              onClick={() => setOpenIndex(GALLERY.indexOf(PHOTOS.goldenHour))}
              className="absolute bottom-0 left-0 w-[44%] -rotate-3 rounded-[4px] bg-surface p-1.5 ring-1 ring-rule transition-transform duration-500 hover:rotate-0"
              aria-label={`Open photo: ${PHOTOS.goldenHour.caption}`}
            >
              <img src={PHOTOS.goldenHour.small} alt={PHOTOS.goldenHour.alt} className="aspect-[4/5] w-full rounded-[2px] object-cover" />
            </button>
          </div>
        </section>

        <PhotoStrip photos={GALLERY} />

        {/* How a session runs — each step is a real part of the app. */}
        <section id="work" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28">
          <Reveal>
            <Eyebrow>How a weekend session runs</Eyebrow>
            <h2 className="type-display mt-4 max-w-[22ch] text-[clamp(1.9rem,3.6vw,2.9rem)]">
              From the walk to the village to next week&rsquo;s plan.
            </h2>
          </Reveal>

          <ol className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((step, i) => (
              <Reveal as="li" key={step.title} delay={(i % 4) * 90}>
                <div className="overflow-hidden rounded-lg ring-1 ring-rule">
                  <img
                    src={step.photo.small}
                    alt={step.photo.alt}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-out hover:scale-[1.04] sm:aspect-[4/5]"
                  />
                </div>
                <div className="mt-5 border-t border-rule pt-4">
                  <span className="font-mono text-[12px] tracking-code text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="type-title mt-1.5 text-[18px]">{step.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* Masonry gallery. */}
        <section id="photos" className="scroll-mt-20 border-t border-rule bg-paper-deep/60">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
            <Reveal className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <Eyebrow>Photos</Eyebrow>
                <h2 className="type-display mt-4 text-[clamp(1.9rem,3.6vw,2.9rem)]">From the verandah.</h2>
              </div>
              <p className="max-w-[36ch] text-[14px] text-ink-2">Taken during our weekend sessions. Tap any photo to see it full size.</p>
            </Reveal>

            <div className="mt-10 columns-1 gap-4 sm:columns-2 lg:columns-3">
              {GALLERY.map((p, i) => (
                <Reveal key={p.id} delay={(i % 3) * 110} className="mb-4 break-inside-avoid">
                  <figure>
                    <button
                      type="button"
                      onClick={() => setOpenIndex(i)}
                      className="group relative block w-full overflow-hidden rounded-lg ring-1 ring-rule"
                      aria-label={`Open photo: ${p.caption}`}
                    >
                      <img
                        src={p.small}
                        srcSet={`${p.small} 520w, ${p.src} 1000w`}
                        sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 92vw"
                        alt={p.alt}
                        loading="lazy"
                        className={`w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] ${
                          p.shape === 'square' ? 'aspect-square' : 'aspect-[4/5]'
                        }`}
                      />
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-board/80 to-transparent px-4 pb-3 pt-10 text-left text-[13px] font-medium text-paper opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                        {p.caption}
                      </span>
                    </button>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Close on the register itself. */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
          <Reveal className="grid items-center gap-10 rounded-xl border border-rule bg-surface p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <Eyebrow>The register behind it</Eyebrow>
              <h2 className="type-display mt-4 max-w-[20ch] text-[clamp(1.7rem,3vw,2.4rem)]">
                See how a session is opened, taught and written down.
              </h2>
              <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-ink-2">
                Explore the app with sample data, as a volunteer or as a coordinator. No account needed.
              </p>
              <Link
                to="/login"
                className="mt-7 inline-flex h-11 items-center gap-2 rounded-md bg-board px-5 text-sm font-medium text-paper transition-colors hover:bg-board-600"
              >
                Try the live demo <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[PHOTOS.laughingLesson, PHOTOS.volunteerToddler].map((p, i) => (
                <img
                  key={p.id}
                  src={p.small}
                  alt={p.alt}
                  loading="lazy"
                  className={`aspect-square w-full rounded-lg object-cover ring-1 ring-rule ${i === 1 ? 'mt-8' : ''}`}
                />
              ))}
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-[13px] text-ink-3 sm:px-8">
          <span>Sankalp Club · LNMIIT, Jaipur</span>
          <Link to={appLink.to} className="hover:text-ink">
            {appLink.label} <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </footer>

      <Lightbox photos={GALLERY} index={openIndex} onChange={setOpenIndex} onClose={() => setOpenIndex(null)} />
    </div>
  );
}
