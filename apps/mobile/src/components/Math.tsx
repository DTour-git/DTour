import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import { colors } from '@dtour/shared';
import { T } from './T';

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const tex = new TeX({ packages: AllPackages, formatError: (_jax: unknown, error: Error) => { throw error; } });
const document = mathjax.document('', { InputJax: tex, OutputJax: new SVG({ fontCache: 'none' }) });

function typeset(source: string, display: boolean, size: number, color: string) {
  const output = adaptor.outerHTML(document.convert(source, { display }));
  const xml = output.match(/<svg[\s\S]*<\/svg>/)?.[0];
  const width = xml?.match(/width="([\d.]+)ex"/);
  const height = xml?.match(/height="([\d.]+)ex"/);
  if (!xml || !width || !height) throw new Error('Could not render maths');
  return { xml: xml.replace(/currentColor/g, color), width: Number(width[1]) * size * 0.5, height: Number(height[1]) * size * 0.5 };
}

export function Math({ source, size, display = false, color = colors.text }: { source: string; size: number; display?: boolean; color?: string }) {
  const result = useMemo(() => {
    try { return typeset(source, display, size, color); } catch { return null; }
  }, [source, display, size, color]);
  if (!result) {
    const raw = display ? `$$${source}$$` : `$${source}$`;
    return <T size={size * 0.9} style={{ fontFamily: 'Menlo', backgroundColor: colors.surface }}>{raw}</T>;
  }
  const svg = <SvgXml xml={result.xml} width={result.width} height={result.height} accessibilityLabel={source} />;
  return display
    ? <ScrollView horizontal style={{ marginBottom: 12 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}><View>{svg}</View></ScrollView>
    : svg;
}
