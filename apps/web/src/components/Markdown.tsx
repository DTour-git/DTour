import Link from 'next/link';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { inline, parse, type Inline } from '@dtour/shared';

function Math({ source, display = false }: { source: string; display?: boolean }) {
  let html: string;
  try {
    html = katex.renderToString(source, { displayMode: display, throwOnError: true, trust: false });
  } catch {
    return display ? <pre>{`$$${source}$$`}</pre> : <code>{`$${source}$`}</code>;
  }
  return display
    ? <div style={{ overflowX: 'auto', margin: '0 0 15px' }} dangerouslySetInnerHTML={{ __html: html }} />
    : <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function Inl({ parts }: { parts: Inline[] }) {
  return <>{parts.map((p, i) => {
    switch (p.t) {
      case 'b': return <b key={i}>{p.v}</b>;
      case 'i': return <i key={i}>{p.v}</i>;
      case 'code': return <code key={i}>{p.v}</code>;
      case 'math': return <Math key={i} source={p.v} />;
      case 'link': return p.href.startsWith('/') ? <Link key={i} href={p.href}>{p.v}</Link> : <a key={i} href={p.href} target="_blank" rel="noreferrer">{p.v}</a>;
      default: return <span key={i}>{p.v}</span>;
    }
  })}</>;
}

/** Markdown with @mentions for replies and Lounge messages. */
export function MentionText({ text }: { text: string }) {
  return <Markdown source={text} size="inherit" lineHeight="inherit" compact />;
}

/** Renders DTour markdown. `senior` quotes get the "From a senior" box. */
export function Markdown({ source, size = 17, lineHeight = 1.65, compact = false }: { source: string; size?: number | string; lineHeight?: number | string; compact?: boolean }) {
  const blocks = parse(source);
  return (
    <div className={compact ? 'markdown markdown-compact' : 'markdown'} style={{ fontSize: size, lineHeight }}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h': return b.level === 3 ? <h3 key={i} id={b.id}><Inl parts={inline(b.text)} /></h3> : <h4 key={i} id={b.id}><Inl parts={inline(b.text)} /></h4>;
          case 'p': return <p key={i}><Inl parts={b.inl} /></p>;
          case 'ul': return <ul key={i}>{b.items.map((it, k) => <li key={k}><Inl parts={it} /></li>)}</ul>;
          case 'quote': return <blockquote key={i} style={{ margin: '0 0 15px', paddingLeft: 14, borderLeft: '2px solid var(--color-neutral-300)', color: 'var(--color-neutral-800)' }}><Inl parts={b.inl} /></blockquote>;
          case 'code': return <pre key={i}>{b.v}</pre>;
          case 'math': return <Math key={i} source={b.v} display />;
          case 'img': return <img key={i} src={b.src} alt={b.alt} loading="lazy" style={{ maxWidth: '100%', borderRadius: 2, margin: '6px 0 16px' }} />;
          case 'senior': return (
            <div key={i} style={{ margin: '26px 0', padding: '20px 24px', background: 'var(--color-surface)', borderRadius: 2 }}>
              <div className="kicker" style={{ color: 'var(--color-accent-2-700)', marginBottom: 6 }}>From a senior</div>
              <div style={{ font: 'italic 400 19px/1.5 var(--font-body)' }}><Inl parts={inline(b.quote)} /></div>
              {b.by && <div style={{ fontSize: 13.5, color: 'var(--color-neutral-700)', marginTop: 8 }}>— {b.by}</div>}
            </div>
          );
        }
      })}
    </div>
  );
}
