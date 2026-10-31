'use client';

import { Suspense, use } from 'react';
import 'katex/dist/katex.min.css';

// KaTeX is loaded the first time a formula renders, so pages and chat without maths don't ship it.
// One shared promise: once React's use() has seen it resolve, later formulas render synchronously.
let katex: Promise<typeof import('katex').default> | null = null;
const loadKatex = () => (katex ??= import('katex').then((m) => m.default));

function Raw({ source, display }: { source: string; display: boolean }) {
  return display ? <pre>{`$$${source}$$`}</pre> : <code>{`$${source}$`}</code>;
}

function Typeset({ source, display }: { source: string; display: boolean }) {
  const k = use(loadKatex());
  let html: string;
  try {
    // maxSize/maxExpand stop \rule, \kern and macro loops from blowing up a message.
    html = k.renderToString(source, { displayMode: display, throwOnError: true, trust: false, maxSize: 10, maxExpand: 100 });
  } catch {
    return <Raw source={source} display={display} />;
  }
  return display
    ? <div style={{ overflowX: 'auto', overflowY: 'hidden', margin: '0 0 15px' }} dangerouslySetInnerHTML={{ __html: html }} />
    : <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Formula({ source, display = false }: { source: string; display?: boolean }) {
  return <Suspense fallback={<Raw source={source} display={display} />}><Typeset source={source} display={display} /></Suspense>;
}
