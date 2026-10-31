/* eslint-disable @typescript-eslint/no-require-imports -- MathJax is required lazily, see engine() */
import { useMemo } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from '@dtour/shared';
import { T } from './T';

type LiteAdaptor = ReturnType<typeof import('mathjax-full/js/adaptors/liteAdaptor.js').liteAdaptor>;
type MathDocument = ReturnType<typeof import('mathjax-full/js/mathjax.js').mathjax.document>;
let engine: { adaptor: LiteAdaptor; document: MathDocument } | null = null;

// MathJax is required the first time a formula renders, so the app (and the Lounge tab) starts without evaluating it.
// Only the TeX packages KaTeX also covers on the web are loaded, so both apps accept the same input.
function getEngine() {
  if (!engine) {
    const { mathjax } = require('mathjax-full/js/mathjax.js') as typeof import('mathjax-full/js/mathjax.js');
    const { TeX } = require('mathjax-full/js/input/tex.js') as typeof import('mathjax-full/js/input/tex.js');
    const { SVG } = require('mathjax-full/js/output/svg.js') as typeof import('mathjax-full/js/output/svg.js');
    const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js') as typeof import('mathjax-full/js/adaptors/liteAdaptor.js');
    const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js') as typeof import('mathjax-full/js/handlers/html.js');
    require('mathjax-full/js/input/tex/base/BaseConfiguration.js');
    require('mathjax-full/js/input/tex/ams/AmsConfiguration.js');
    require('mathjax-full/js/input/tex/newcommand/NewcommandConfiguration.js');
    require('mathjax-full/js/input/tex/boldsymbol/BoldsymbolConfiguration.js');
    require('mathjax-full/js/input/tex/braket/BraketConfiguration.js');
    require('mathjax-full/js/input/tex/cancel/CancelConfiguration.js');
    require('mathjax-full/js/input/tex/color/ColorConfiguration.js');
    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    const tex = new TeX({ packages: ['base', 'ams', 'newcommand', 'boldsymbol', 'braket', 'cancel', 'color'], formatError: (_jax: unknown, error: Error) => { throw error; } });
    engine = { adaptor, document: mathjax.document('', { InputJax: tex, OutputJax: new SVG({ fontCache: 'none' }) }) };
  }
  return engine;
}

function typeset(source: string, display: boolean, size: number, color: string) {
  const { adaptor, document } = getEngine();
  const output = adaptor.outerHTML(document.convert(source, { display }));
  const xml = output.match(/<svg[\s\S]*<\/svg>/)?.[0];
  const width = xml?.match(/width="([\d.]+)ex"/);
  const height = xml?.match(/height="([\d.]+)ex"/);
  if (!xml || !width || !height) throw new Error('Could not render maths');
  // Same idea as KaTeX's maxSize on the web: a formula taller than 10em shows as source instead of a giant
  // box over the Lounge or thread.
  const w = Number(width[1]) * size * 0.5, h = Number(height[1]) * size * 0.5;
  if (h > size * 10 || w > size * 100) throw new Error('Maths too large');
  return { xml: xml.replace(/currentColor/g, color), width: w, height: h };
}

/** `maxWidth` is the width of the line inline maths sits in; until it's measured, the screen width minus the usual gutters. */
export function Formula({ source, size, display = false, color = colors.text, maxWidth }: { source: string; size: number; display?: boolean; color?: string; maxWidth?: number }) {
  const screen = useWindowDimensions().width;
  const lineWidth = maxWidth ?? screen - 40;
  const result = useMemo(() => {
    try { return typeset(source, display, size, color); } catch { return null; }
  }, [source, display, size, color]);
  // Inline maths wider than its line is scaled down to fit, up to half size; past that it shows as source.
  const scale = result && !display ? Math.min(1, lineWidth / result.width) : 1;
  if (!result || scale < 0.5) {
    const raw = display ? `$$${source}$$` : `$${source}$`;
    return <T size={size * 0.9} color={color} style={{ fontFamily: 'Menlo', backgroundColor: colors.surface }}>{raw}</T>;
  }
  const svg = <SvgXml xml={result.xml} width={result.width * scale} height={result.height * scale} accessibilityLabel={source} />;
  return display
    ? <ScrollView horizontal style={{ marginBottom: 12 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}><View>{svg}</View></ScrollView>
    : svg;
}
