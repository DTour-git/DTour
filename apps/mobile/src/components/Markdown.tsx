import { Linking, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { colors, parse, type Inline } from '@dtour/shared';
import { appRoute } from '@/lib/routes';
import { T, Kicker } from './T';

function Inl({ parts, size, lh }: { parts: Inline[]; size: number; lh: number }) {
  const router = useRouter();
  return (
    <T size={size} lh={lh}>
      {parts.map((p, i) => {
        if (p.t === 'b') return <T key={i} size={size} w={600}>{p.v}</T>;
        if (p.t === 'i') return <T key={i} size={size} i>{p.v}</T>;
        if (p.t === 'code') return <T key={i} size={size * 0.9} style={{ fontFamily: 'Menlo', backgroundColor: colors.surface }}>{p.v}</T>;
        if (p.t === 'link') return <T key={i} size={size} color={colors.accent700} onPress={() => (p.href.startsWith('/') ? router.push(appRoute(p.href)) : Linking.openURL(p.href))}>{p.v}</T>;
        return p.v;
      })}
    </T>
  );
}

export function Markdown({ source, size = 16, lh = 1.6, onHeadingLayout }: { source: string; size?: number; lh?: number; onHeadingLayout?: (id: string, y: number) => void }) {
  return (
    <View>
      {parse(source).map((b, i) => {
        switch (b.t) {
          case 'h': return <View key={i} onLayout={(e) => onHeadingLayout?.(b.id, e.nativeEvent.layout.y)}><T size={20} w={600} style={{ marginTop: i ? 20 : 0, marginBottom: 8 }}>{b.text}</T></View>;
          case 'p': return <View key={i} style={{ marginBottom: 12 }}><Inl parts={b.inl} size={size} lh={lh} /></View>;
          case 'ul': return <View key={i} style={{ marginBottom: 12, gap: 4 }}>{b.items.map((it, k) => <View key={k} style={{ flexDirection: 'row', gap: 8 }}><T size={size} lh={lh}>•</T><View style={{ flex: 1 }}><Inl parts={it} size={size} lh={lh} /></View></View>)}</View>;
          case 'quote': return <View key={i} style={{ borderLeftWidth: 2, borderLeftColor: colors.neutral300, paddingLeft: 12, marginBottom: 12 }}><Inl parts={b.inl} size={size} lh={lh} /></View>;
          case 'code': return <View key={i} style={{ backgroundColor: colors.surface, padding: 12, borderRadius: 2, marginBottom: 12 }}><T size={13} style={{ fontFamily: 'Menlo' }}>{b.v}</T></View>;
          case 'img': return <Image key={i} source={{ uri: b.src }} accessibilityLabel={b.alt} contentFit="cover" style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 2, marginBottom: 14, backgroundColor: colors.surface }} />;
          case 'senior': return (
            <View key={i} style={{ padding: 14, paddingHorizontal: 16, backgroundColor: colors.surface, borderRadius: 2, marginBottom: 14 }}>
              <Kicker>From a senior</Kicker>
              <T size={16.5} i lh={1.5} style={{ marginTop: 4 }}>{b.quote}</T>
              {b.by ? <T size={12.5} color={colors.neutral700} style={{ marginTop: 6 }}>— {b.by}</T> : null}
            </View>
          );
        }
      })}
    </View>
  );
}
