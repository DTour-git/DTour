import { useRef, useState } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, getArticle, headings, n, parse, setWikiFeedback } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useMe } from '@/lib/auth';
import { useData } from '@/lib/useData';
import { T } from '@/components/T';
import { Icon } from '@/components/Icon';
import { Markdown } from '@/components/Markdown';
import { AppBar, Avatar, IconBtn, PrimaryBtn, Screen } from '@/components/ui';

export default function Article() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const me = useMe();
  const { data, setData } = useData(() => getArticle(supabase, slug, me.id), [slug]);
  const [tocOpen, setTocOpen] = useState(false);
  const scroll = useRef<{ scrollTo: (o: { y: number }) => void } | null>(null);
  const offsets = useRef<Record<string, number>>({});
  const bodyY = useRef(0);
  if (!data) return <Screen><AppBar /></Screen>;
  const a = data.article;
  const toc = headings(parse(a.body));
  const others = Math.max(0, a.editor_count - 1);
  const useful = async () => {
    const next = data.myFeedback === true ? null : true;
    setData({ ...data, myFeedback: next, article: { ...a, useful_count: a.useful_count + (next ? 1 : -1) } });
    await setWikiFeedback(supabase, a.id, me.id, next);
  };
  return (
    <Screen>
      <AppBar title={`${a.board?.name ?? 'Campus'} · Wiki`} right={<>
        <IconBtn name="clock-counter-clockwise" label="History" />
        <IconBtn name="share-network" label="Share" onPress={() => Share.share({ message: `${a.title} — DTour Wiki` })} />
      </>} />
      <ScrollView ref={scroll as never} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        <T size={32} w={600} lh={1.05} ls={-0.025} style={{ marginTop: 6 }}>{a.title}</T>
        {a.dek ? <T size={17} i lh={1.45} color={colors.neutral800} style={{ marginTop: 10 }}>{a.dek}</T> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <View style={{ flexDirection: 'row' }}>
            {data.editors[0] && <Avatar person={data.editors[0]} size={26} />}
            {others > 0 && <View style={{ marginLeft: -7 }}><Avatar person={{ handle: 'x', tint: 'neutral' }} label={`+${others}`} size={26} /></View>}
          </View>
          <T size={12.5} color={colors.neutral700}>{a.starter?.display_name ?? `@${a.starter?.handle ?? ''}`} + {others} editors · {a.read_minutes} min</T>
        </View>
        {a.checked_at && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <Icon name="shield-check" size={16} color={colors.accent} />
            <T size={12.5} color={colors.accent800}>Checked by a senior · {new Date(a.checked_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</T>
          </View>
        )}
        {toc.length > 0 && (
          <View style={{ marginTop: 16, backgroundColor: colors.surface, borderRadius: 2 }}>
            <Pressable onPress={() => setTocOpen(!tocOpen)} style={{ height: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T size={14} numberOfLines={1} style={{ flex: 1 }}><T size={14} color={colors.neutral700}>On this page · </T><T size={14} w={600}>{toc[0].text}</T></T>
              <Icon name={tocOpen ? 'caret-up' : 'caret-down'} size={16} />
            </Pressable>
            {tocOpen && toc.map((h) => (
              <Pressable key={h.id} onPress={() => { setTocOpen(false); scroll.current?.scrollTo({ y: bodyY.current + (offsets.current[h.id] ?? 0) - 10 }); }} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 14 }}>
                <T size={14.5}>{h.text}</T>
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ marginTop: 18 }} onLayout={(e) => { bodyY.current = e.nativeEvent.layout.y; }}>
          <Markdown source={a.body} size={16.5} lh={1.65} onHeadingLayout={(id, y) => { offsets.current[id] = y; }} />
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 30, borderTopWidth: 1, borderTopColor: colors.divider }}>
        <Pressable onPress={useful} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 44, paddingHorizontal: 12 }}>
          <Icon name="thumbs-up" size={20} color={colors.accent700} weight={data.myFeedback ? 'fill' : 'duotone'} /><T size={14} w={600} color={colors.accent700}>{n(a.useful_count)}</T>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 44, paddingHorizontal: 12 }}>
          <Icon name="chats" size={20} color={colors.neutral700} /><T size={14} color={colors.neutral700}>Talk · {a.talk_count}</T>
        </View>
        <PrimaryBtn label="Suggest edit" icon="pencil-simple-line" style={{ marginLeft: 'auto' }} onPress={() => router.push({ pathname: '/new', params: { type: 'article', edit: a.slug } })} />
      </View>
    </Screen>
  );
}
