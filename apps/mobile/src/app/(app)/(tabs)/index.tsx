import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { clock, colors, dayOfMonth, getConfig, getExamCountdown, getTimeline, listThreads, mobileDate, n, timelineTime, weekOfSem } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useMe } from '@/lib/auth';
import { useNotifications } from '@/lib/notifications';
import { useData } from '@/lib/useData';
import { T, Kicker } from '@/components/T';
import { Icon } from '@/components/Icon';
import { CmykNum, Halftone, IconBtn, LogoMark, Screen, Seal, rowRule } from '@/components/ui';

const SHORTCUTS = [
  { label: 'Library', icon: 'books', bg: colors.accent100, fg: colors.accent700, href: '/library' },
  { label: 'Societies', icon: 'flag-banner', bg: colors.accent2_100, fg: colors.accent2_700, href: '/societies' },
  { label: 'Team Up', icon: 'users-three', bg: colors.accent100, fg: colors.accent700, href: '/teams' },
  { label: 'Kahan chalein?', icon: 'bowl-food', bg: colors.surface, fg: colors.text, href: '/kahan' },
  { label: 'Articles', icon: 'article', bg: colors.surface, fg: colors.text, href: '/wiki' },
] as const;
const CAT = ['', 'Campus', 'Padhai', 'Career', 'Culture', 'Bahar'];

export default function Today() {
  const router = useRouter();
  const me = useMe();
  const { unread } = useNotifications();
  const { data, refreshing, refresh } = useData(async () => {
    const [lead, timeline, threads, config, exam] = await Promise.all([
      supabase.from('threads').select('id,title,created_at,reply_count,image_label,author:profiles!threads_author_id_fkey(handle),society:societies(verified)').eq('kind', 'news').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      getTimeline(supabase),
      listThreads(supabase, { tab: 'hot', excludeNews: true, limit: 3 }),
      getConfig(supabase),
      getExamCountdown(supabase, me),
    ]);
    return { lead: lead.data as unknown as { id: number; title: string; created_at: string; reply_count: number; image_label: string | null; author: { handle: string }; society: { verified: boolean } | null } | null, timeline, threads, config, exam };
  });
  const week = data?.config ? weekOfSem(data.config.sem_start) : null;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4, paddingRight: 10, paddingBottom: 8, paddingLeft: 20 }}>
        <LogoMark size={24} />
        <T size={27} w={600} ls={-0.03}>DTour</T>
        <View style={{ marginLeft: 'auto', flexDirection: 'row' }}>
          <IconBtn name="magnifying-glass" label="Search" onPress={() => router.push('/search')} />
          <View>
            <IconBtn name="bell" label={`Notifications${unread ? `, ${unread} unread` : ''}`} onPress={() => router.push((me ? '/notifications' : '/login') as Href)} />
            {unread > 0 && (
              <View pointerEvents="none" style={{ position: 'absolute', top: 6, right: 6, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.accent2, alignItems: 'center', justifyContent: 'center' }}>
                <T size={10.5} w={600} color={colors.bg}>{unread > 99 ? '99+' : String(unread)}</T>
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={{ marginHorizontal: 20, borderTopWidth: 3, borderBottomWidth: 1, borderColor: colors.text, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
        <T size={12} color={colors.neutral700}>{mobileDate()}{week ? ` · Week ${week}` : ''}</T>
        {data?.exam && (
          <Pressable onPress={() => router.push('/library')} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="hourglass-medium" size={14} color={colors.accent2} />
            <T size={12} color={colors.neutral700}>{data.exam.label} in <T size={12} w={600} color={colors.accent2_700}>{data.exam.days} days</T></T>
          </Pressable>
        )}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}>
        <View style={{ flexDirection: 'row', gap: 14, paddingTop: 16, paddingBottom: 4 }}>
          {SHORTCUTS.map((s) => (
            <Pressable key={s.label} onPress={() => router.push(s.href)} style={{ width: 58, alignItems: 'center', gap: 6 }} accessibilityRole="button">
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={s.icon} size={24} color={s.fg} /></View>
              <T size={12} align="center" lh={1.15}>{s.label}</T>
            </Pressable>
          ))}
        </View>

        {data?.lead && (
          <Pressable onPress={() => router.push(`/thread/${data.lead!.id}`)} style={{ paddingTop: 18 }}>
            <Kicker>Pata hai aaj kya hua? · {clock(data.lead.created_at, false)}</Kicker>
            <T size={25} w={600} lh={1.12} ls={-0.01} style={{ marginTop: 8, marginBottom: 12 }}>{data.lead.title}</T>
            <Halftone height={150} label={data.lead.image_label} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
              <T size={12.5} color={colors.neutral700}>@{data.lead.author.handle}</T>{data.lead.society?.verified && <Seal />}
              <T size={12.5} color={colors.neutral700}>· {n(data.lead.reply_count)} replies</T>
            </View>
          </Pressable>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 26 }}>
          <CmykNum size={56}>{dayOfMonth()}</CmykNum>
          <T size={21} w={600} style={{ paddingBottom: 2 }}>Today at DTU</T>
        </View>
        <View style={{ marginTop: 16 }}>
          {data?.timeline.map((e, i, arr) => (
            <Pressable key={e.id} disabled={!e.thread_id && !e.society_post_id}
              onPress={() => router.push(e.thread_id ? `/thread/${e.thread_id}` : '/societies')}
              style={{ flexDirection: 'row', gap: 10, paddingBottom: i < arr.length - 1 ? 14 : 0 }}>
              <T size={12} w={e.state === 'now' ? 600 : 400} color={e.state === 'now' ? colors.accent2_700 : colors.neutral700} align="right" style={{ width: 44 }}>
                {e.state === 'now' ? 'NOW' : timelineTime(e.starts_at)}
              </T>
              <View style={{ width: 12, paddingTop: 4 }}>
                <View style={[{ width: 10, height: 10, borderRadius: 5 },
                  e.state === 'past' ? { backgroundColor: colors.neutral500 } : e.state === 'now' ? { backgroundColor: colors.accent2 } : { borderWidth: 2, borderColor: colors.accent }]} />
              </View>
              <T size={15.5} w={600} lh={1.3} style={{ flex: 1 }}>{e.short_title ?? e.title}</T>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 30 }}>
          <T size={21} w={600}>From the boards</T>
          <Pressable onPress={() => router.navigate('/boards')} hitSlop={10}><T size={13.5} w={600} color={colors.accent700}>All →</T></Pressable>
        </View>
        {data?.threads.map((t) => (
          <Pressable key={t.id} onPress={() => router.push(`/thread/${t.id}`)} style={[{ paddingVertical: 14 }, rowRule]}>
            <Kicker color={t.board.category_id === 2 || t.board.category_id === 4 ? colors.accent2_700 : colors.accent700}>{CAT[t.board.category_id]}</Kicker>
            <T size={16.5} w={600} lh={1.3} style={{ marginTop: 4 }}>{t.title}</T>
            <T size={12.5} color={colors.neutral700} style={{ marginTop: 3 }}>{n(t.score)} votes · {n(t.reply_count)} replies</T>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
