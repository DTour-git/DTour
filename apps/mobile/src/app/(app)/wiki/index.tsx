import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, getWikiIndex, n, type Tone } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/useData';
import { T, Kicker } from '@/components/T';
import { Icon } from '@/components/Icon';
import { AppBar, Halftone, IconBtn, Pill, PillRow, Screen, SectionRule, rowRule } from '@/components/ui';

export default function WikiIndex() {
  const router = useRouter();
  const [topic, setTopic] = useState<number | null>(null);
  const { data, refreshing, refresh } = useData(() => getWikiIndex(supabase));
  const checked = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : null;
  return (
    <Screen>
      <AppBar right={<>
        <IconBtn name="magnifying-glass" label="Search" onPress={() => router.push('/search')} />
        <IconBtn name="pencil-simple-line" color={colors.accent} label="Start a guide" onPress={() => router.push({ pathname: '/new', params: { type: 'article' } })} />
      </>} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}>
        <View style={{ paddingHorizontal: 20 }}>
          <T size={32} w={600} ls={-0.03} lh={1}>The Wiki</T>
          <T size={15.5} i lh={1.45} color={colors.neutral800} style={{ marginTop: 8 }}>Guides written and kept current by DTU students. {n(data?.articleCount)} articles · {n(data?.editorCount)} editors.</T>
        </View>
        <PillRow style={{ paddingTop: 16 }}>
          <Pill label="All" active={topic === null} onPress={() => setTopic(null)} />
          {data?.categories.map((c) => <Pill key={c.id} label={c.pill} active={topic === c.id} onPress={() => setTopic(c.id)} />)}
        </PillRow>
        <View style={{ paddingHorizontal: 20 }}>
          {data?.mostRead && topic === null && (
            <Pressable onPress={() => router.push(`/wiki/${data.mostRead!.slug}`)} style={{ marginTop: 20 }}>
              <Halftone height={150} label={data.mostRead.cover_label} />
              <Kicker style={{ marginTop: 12 }}>Most read this week</Kicker>
              <T size={23} w={600} lh={1.15} style={{ marginTop: 6 }}>{data.mostRead.title}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                {data.mostRead.checked_at && <Icon name="shield-check" size={15} color={colors.accent} />}
                <T size={12.5} color={colors.neutral700}>{data.mostRead.checked_at ? `Checked ${checked(data.mostRead.checked_at)} · ` : ''}{data.mostRead.editor_count} editors · {data.mostRead.read_minutes} min</T>
              </View>
            </Pressable>
          )}
          {data?.categories.filter((c) => topic === null || c.id === topic).map((c) => (
            <View key={c.id} style={{ marginTop: 26 }}>
              <SectionRule num={String(c.id).padStart(2, '0')} title={c.name} tone={c.tone === 'ink' ? 'neutral' : (c.tone as Tone)}
                right={<Pressable onPress={() => setTopic(c.id)}><T size={12.5} color={colors.neutral700}>See all</T></Pressable>} />
              {data.articles.filter((a) => a.category_id === c.id).slice(0, topic ? 50 : 3).map((a) => (
                <Pressable key={a.id} onPress={() => router.push(`/wiki/${a.slug}`)} style={[{ paddingVertical: 13 }, rowRule]}>
                  <T size={16.5} w={600} lh={1.3}>{a.title}</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    {a.checked_at && <Icon name="shield-check" size={14} color={colors.accent} />}
                    <T size={12} color={colors.neutral700}>{a.editor_count} editors · {a.read_minutes} min</T>
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
          <Pressable onPress={() => router.push({ pathname: '/new', params: { type: 'article' } })} style={{ marginTop: 26, padding: 16, backgroundColor: colors.accent100, borderRadius: 2, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Icon name="pencil-simple-line" size={22} color={colors.accent700} />
            <T size={14} lh={1.45} color={colors.accent900} style={{ flex: 1 }}><T size={14} w={600} color={colors.accent900}>Missing a guide?</T> Start one — seniors can review and mark it checked.</T>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
