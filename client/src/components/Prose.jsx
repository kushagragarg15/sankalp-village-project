/**
 * Renders the small markdown subset language models actually produce —
 * paragraphs, **bold**, bullet and numbered lists, and a "Heading:" line —
 * as real elements. Nothing is parsed as HTML: every piece of text becomes a
 * React text node, so model output can never inject markup.
 *
 * Deliberately not a full markdown parser. If the model starts emitting
 * tables or code, that is a prompt problem to fix, not a renderer to grow.
 */

// **bold** and `code` inside a line.
function inline(text, keyBase) {
  const parts = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] !== undefined) parts.push(<strong key={`${keyBase}-b${i++}`} className="font-semibold">{m[1]}</strong>);
    else parts.push(<code key={`${keyBase}-c${i++}`} className="rounded bg-paper px-1 font-mono text-[0.92em]">{m[2]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;

export default function Prose({ text, className = '' }) {
  if (!text) return null;
  // Literal "\n" (backslash-n) shows up when a model double-escapes line breaks
  // inside JSON; treat it as the line break it was meant to be.
  const lines = text.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let list = null; // { type: 'ul' | 'ol', items: [] }
  let para = [];

  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join(' ') });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (RULE.test(line)) {
      flushPara();
      flushList();
      blocks.push({ type: 'hr' });
    } else if ((m = HEADING.exec(line))) {
      flushPara();
      flushList();
      blocks.push({ type: 'h', text: m[1] });
    } else if ((m = BULLET.exec(line))) {
      flushPara();
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
      list.items.push(m[1]);
    } else if ((m = NUMBERED.exec(line))) {
      flushPara();
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
      list.items.push(m[2]);
    } else if (list && /^\s{2,}/.test(raw)) {
      // Indented continuation of the previous list item.
      list.items[list.items.length - 1] += ' ' + line.trim();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();

  return (
    <div className={`space-y-2.5 text-[15px] leading-relaxed text-ink ${className}`}>
      {blocks.map((b, i) => {
        if (b.type === 'hr') return <hr key={i} className="border-rule" />;
        if (b.type === 'h') return <p key={i} className="font-semibold">{inline(b.text, i)}</p>;
        if (b.type === 'ul') {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.items.map((it, j) => <li key={j}>{inline(it, `${i}-${j}`)}</li>)}
            </ul>
          );
        }
        if (b.type === 'ol') {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {b.items.map((it, j) => <li key={j}>{inline(it, `${i}-${j}`)}</li>)}
            </ol>
          );
        }
        return <p key={i}>{inline(b.text, i)}</p>;
      })}
    </div>
  );
}
