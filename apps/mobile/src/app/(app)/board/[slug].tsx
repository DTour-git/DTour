import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ago, colors, getBoard, n, type FeedTab } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/useData';
import { usePresence } from '@/lib/presence';
import { T } from '@/components/T';
import { Icon } from '@/components/Icon';
import { AppBar, FlairTag, IconBtn, Pill, PillRow, Screen, rowRule } from '@/components/ui';

export default function Board() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { online } = usePresence();
  const [tab, setTab] = useState<FeedTab>('hot');
  const { data, refreshing, refresh } = useData(() => getBoard(supabase, slug, tab), [slug, tab]);
  return (
    <Screen>
      <AppBar title={data?.board.short_name ?? data?.board.name ?? ''} subtitle={`${online.filter((u) => u.board === slug).length} online · ${n(data?.board.member_count ?? 0)} members`}
        right={<IconBtn name="pencil-simple-line" color={colors.accent} label="Post here" onPress={() => router.push({ pathname: '/new', params: { board: slug } })} />} />
      <PillRow>
        {(['hot', 'new', 'top'] as const).map((k) => <Pill key={k} label={k === 'hot' ? 'Hot' : k === 'new' ? 'New' : 'Top this week'} active={tab === k} onPress={() => setTab(k)} />)}
        {data?.children.map((c) => <Pill key={c.id} label={c.short_name ?? c.name} onPress={() => router.push(`/board/${c.slug}`)} />)}
      </PillRow>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}>
        {data?.board.description ? <T size={14.5} i color={colors.neutral800} style={{ marginTop: 14 }}>{data.board.description}</T> : null}
        {data?.threads.map((t) => (
          <Pressable key={t.id} onPress={() => router.push(`/thread/${t.id}`)} style={[{ flexDirection: 'row', gap: 14, paddingVertical: 14 }, rowRule]}>
            <View style={{ alignItems: 'center', width: 36 }}>
              <Icon name="arrow-fat-up" size={20} color={colors.accent} />
              <T size={15} w={600}>{n(t.score)}</T>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <T size={12.5} w={600}>@{t.author.handle}</T><FlairTag person={t.author} /><T size={12.5} color={colors.neutral700}>{ago(t.created_at)}</T>
              </View>
              <T size={16.5} w={600} lh={1.3} style={{ marginTop: 4 }}>{t.title}</T>
              <T size={12.5} color={colors.neutral700} style={{ marginTop: 3 }}>{n(t.reply_count)} replies{t.accepted_reply_id ? ' · answered' : ''}</T>
            </View>
          </Pressable>
        ))}
        {data && !data.threads.length && <T size={15} i color={colors.neutral700} style={{ paddingVertical: 20 }}>No threads yet — start the first one.</T>}
      </ScrollView>
    </Screen>
  );
}
