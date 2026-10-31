import { Linking, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { colors, inline, inlineLines, parse, type Inline } from '@dtour/shared';
import { appRoute } from '@/lib/routes';
import { T, Kicker } from './T';
import { Formula } from './Formula';

function Inl({ parts, size, lh, color, weight = 400, italic = false }: { parts: Inline[]; size: number; lh: number; color?: string; weight?: 400 | 600; italic?: boolean }) {
  const router = useRouter();
  return (
    <T size={size} lh={lh} color={color} w={weight} i={italic}>
      {parts.map((p, i) => {
        if (p.t === 'b') return <T key={i} size={size} w={600} i={italic} color={color}>{p.v}</T>;
        if (p.t === 'i') return <T key={i} size={size} w={weight} i color={color}>{p.v}</T>;
        if (p.t === 'code') return <T key={i} size={size * 0.9} color={color} style={{ fontFamily: 'Menlo', backgroundColor: colors.surface }}>{p.v}</T>;
        if (p.t === 'math') return <Formula key={i} source={p.v} size={size} color={color} />;
        if (p.t === 'link') return <T key={i} size={size} w={weight} i={italic} color={colors.accent700} onPress={() => (p.href.startsWith('/') ? router.push(appRoute(p.href)) : Linking.openURL(p.href))}>{p.v}</T>;
        return p.v;
      })}
    </T>
  );
}

/** Inline Markdown (bold, italic, code, links, maths) with tappable @mentions, line by line (replies, Lounge). */
export function MentionText({ text, size = 15, lh = 1.5, color }: { text: string; size?: number; lh?: number; color?: string }) {
  const parts = inlineLines(text).flatMap((line, i): Inline[] => (i ? [{ t: 'text', v: '\n' }, ...line] : line));
  return <Inl parts={parts} size={size} lh={lh} color={color} />;
}

export function Markdown({ source, size = 16, lh = 1.6, color, onHeadingLayout }: { source: string; size?: number; lh?: number; color?: string; onHeadingLayout?: (id: string, y: number) => void }) {
  const blocks = parse(source);
  return (
    <View>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h': return <View key={i} onLayout={(e) => onHeadingLayout?.(b.id, e.nativeEvent.layout.y)} style={{ marginTop: i ? 20 : 0, marginBottom: 8 }}><Inl parts={inline(b.text)} size={20} lh={1.3} color={color} weight={600} /></View>;
          case 'p': return <View key={i} style={{ marginBottom: 12 }}><Inl parts={b.inl} size={size} lh={lh} color={color} /></View>;
          case 'ul': return <View key={i} style={{ marginBottom: 12, gap: 4 }}>{b.items.map((it, k) => <View key={k} style={{ flexDirection: 'row', gap: 8 }}><T size={size} lh={lh} color={color}>•</T><View style={{ flex: 1 }}><Inl parts={it} size={size} lh={lh} color={color} /></View></View>)}</View>;
          case 'quote': return <View key={i} style={{ borderLeftWidth: 2, borderLeftColor: colors.neutral300, paddingLeft: 12, marginBottom: 12 }}><Inl parts={b.inl} size={size} lh={lh} color={color} /></View>;
          case 'code': return <View key={i} style={{ backgroundColor: colors.surface, padding: 12, borderRadius: 2, marginBottom: 12 }}><T size={13} style={{ fontFamily: 'Menlo' }}>{b.v}</T></View>;
          case 'math': return <Formula key={i} source={b.v} size={size} color={color} display />;
          case 'img': return <Image key={i} source={{ uri: b.src }} accessibilityLabel={b.alt} contentFit="cover" style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 2, marginBottom: 14, backgroundColor: colors.surface }} />;
          case 'senior': return (
            <View key={i} style={{ padding: 14, paddingHorizontal: 16, backgroundColor: colors.surface, borderRadius: 2, marginBottom: 14 }}>
              <Kicker>From a senior</Kicker>
              <View style={{ marginTop: 4 }}><Inl parts={inline(b.quote)} size={16.5} lh={1.5} color={color} italic /></View>
              {b.by ? <T size={12.5} color={colors.neutral700} style={{ marginTop: 6 }}>— {b.by}</T> : null}
            </View>
          );
        }
      })}
    </View>
  );
}
