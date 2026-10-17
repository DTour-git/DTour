import { useEffect } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { agoLong, colors, getBoardsIndex, markBoardsSeen, n, tone as toneMap, type BoardWithLatest, type Tone } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useMe } from '@/lib/auth';
import { useData } from '@/lib/useData';
import { usePresence } from '@/lib/presence';
import { T } from '@/components/T';
import { Icon } from '@/components/Icon';
import { IconBtn, Screen, Tag, rowRule } from '@/components/ui';

function href(b: BoardWithLatest): Href {
  if (b.link_screen === 'teams') return '/teams';
  if (b.link_screen === 'societies') return '/societies';
  return `/board/${b.slug}` as Href;
}

function meta(b: BoardWithLatest) {
  if (b.link_screen === 'teams') return 'Find teammates';
  if (b.link_screen === 'societies') return 'Verified · events & recruiting';
  if (b.verified_only) return `${n(b.thread_count)} threads · verified`;
  if (b.children.length > 3) return `${b.children.slice(0, 3).map((c) => c.short_name ?? c.name).join(' · ')} · +${b.children.length - 3}`;
  return `${n(b.thread_count)} threads${b.latest ? ` · ${agoLong(b.latest.created_at).replace(' ago', '')} ago` : ''}`;
}

export default function Boards() {
  const router = useRouter();
  const me = useMe();
  const { online } = usePresence();
  const { data, refreshing, refresh } = useData(() => getBoardsIndex(supabase));
  useEffect(() => { if (data) markBoardsSeen(supabase, me.id); }, [data, me.id]);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 4, paddingRight: 10, paddingLeft: 20 }}>
        <T size={32} w={600} ls={-0.03} lh={1}>Boards</T>
        <View style={{ marginLeft: 'auto' }}><IconBtn name="magnifying-glass" label="Search" onPress={() => router.push('/search')} /></View>
      </View>
      <T size={13} color={colors.neutral700} style={{ paddingHorizontal: 20, paddingTop: 4 }}>
        {online.length} online{data ? ` · ${data.newTotal} new since your last visit` : ''}
      </T>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}>
        {data?.categories.map((c) => {
          const t = c.tone === 'ink' ? { main: colors.neutral500, strong: colors.neutral700, heading: colors.neutral800, tint: colors.surface } : toneMap[c.tone as Tone];
          const boards = data.boards.filter((b) => b.category_id === c.id).sort((a, b) => a.sort - b.sort);
          return (
            <View key={c.id} style={{ marginTop: 22 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, borderBottomWidth: 3, borderBottomColor: t.main, paddingBottom: 8 }}>
                <T size={30} w={600} lh={0.9} color={t.strong}>{String(c.id).padStart(2, '0')}</T>
                <T size={20} w={600} color={t.heading}>{c.name}</T>
              </View>
              {c.slug === 'bahar' && (
                <Row icon="bowl-food" tileBg={colors.surface} tileFg={colors.text} name="Kahan chalein?" sub="Food, hangouts, Delhi events" onPress={() => router.push('/kahan')} />
              )}
              {boards.map((b, i) => (
                <Row key={b.id} icon={b.icon} tileBg={t.tint} tileFg={c.tone === 'ink' ? colors.text : t.strong}
                  name={b.short_name ?? b.name} sub={meta(b)} badge={b.newCount} last={i === boards.length - 1}
                  onPress={() => router.push(href(b))} />
              ))}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

function Row({ icon, tileBg, tileFg, name, sub, badge, last, onPress }: { icon: string; tileBg: string; tileFg: string; name: string; sub: string; badge?: number; last?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 66, opacity: pressed ? 0.7 : 1 }, !last && rowRule]}>
      <View style={{ width: 42, height: 42, borderRadius: 2, backgroundColor: tileBg, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={22} color={tileFg} /></View>
      <View style={{ flex: 1 }}>
        <T size={17} w={600} lh={1.3}>{name}</T>
        <T size={12.5} color={colors.neutral700} numberOfLines={1}>{sub}</T>
      </View>
      {badge ? <Tag tone="accent2">{String(badge)}</Tag> : <Icon name="caret-right" size={16} color={colors.neutral500} />}
    </Pressable>
  );
}
