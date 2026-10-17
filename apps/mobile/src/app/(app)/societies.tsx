import { useState } from 'react';
import { Linking, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, getSocietyBoard, n, POST_KIND_LABEL, postKindTone, toggleRsvp } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useMe, useRequireMe } from '@/lib/auth';
import { useData } from '@/lib/useData';
import { T, Kicker } from '@/components/T';
import { AppBar, IconBtn, Pill, PillRow, PrimaryBtn, Screen, Seal, rowRule } from '@/components/ui';

const FILTERS: [string | null, string, 'accent' | 'accent2' | undefined][] = [[null, 'All', undefined], ['event', 'Events', 'accent2'], ['recruiting', 'Recruiting', 'accent2'], ['workshop', 'Workshops', 'accent'], ['talk', 'Talks', 'accent']];

export default function Societies() {
  const router = useRouter();
  const me = useMe();
  const requireMe = useRequireMe();
  const [kind, setKind] = useState<string | null>(null);
  const { data, setData, refreshing, refresh } = useData(() => getSocietyBoard(supabase, me?.id ?? null, kind), [kind]);

  const rsvp = async (id: number) => {
    if (!data || !requireMe()) return;
    const going = data.myRsvps.has(id);
    const mine = new Set(data.myRsvps); if (going) mine.delete(id); else mine.add(id);
    setData({ ...data, myRsvps: mine, posts: data.posts.map((p) => p.id === id ? { ...p, rsvp_count: p.rsvp_count + (going ? -1 : 1) } : p) });
    await toggleRsvp(supabase, id).catch(refresh);
  };

  return (
    <Screen>
      <AppBar title="Society board" subtitle={`${data?.verifiedCount ?? ''} verified societies`}
        right={<IconBtn name="megaphone" color={colors.accent} label="Promote an event" onPress={() => router.push({ pathname: '/new', params: { type: 'event' } })} />} />
      <PillRow>{FILTERS.map(([k, l, t]) => <Pill key={l} label={l} tone={t ?? 'surface'} active={kind === k} onPress={() => setKind(k)} />)}</PillRow>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}>
        {data?.posts.map((p) => {
          const going = data.myRsvps.has(p.id);
          const kick = `${POST_KIND_LABEL[p.kind]} · ${p.when_label}${p.where_label && p.kind !== 'event' ? ` · ${p.where_label}` : ''}`;
          if (p.featured) return (
            <View key={p.id} style={{ marginTop: 16, padding: 18, backgroundColor: colors.accent2_100, borderRadius: 2 }}>
              <Kicker color={colors.accent2_800}>{kick}</Kicker>
              <T size={24} w={600} lh={1.1} color={colors.accent2_900} style={{ marginVertical: 6 }}>{p.title}</T>
              {p.body ? <T size={14.5} lh={1.5} color={colors.accent2_900}>{p.body}</T> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <T size={12.5} color={colors.accent2_800} style={{ flex: 1 }}>{p.society.name} · {n(p.rsvp_count)} {p.rsvp_word}</T>
                <PrimaryBtn label={going ? 'Going ✓' : "I'm going"} height={40} onPress={() => rsvp(p.id)} />
              </View>
            </View>
          );
          return (
            <View key={p.id} style={[{ paddingVertical: 18 }, rowRule]}>
              <Kicker color={postKindTone(p.kind) === 'accent2' ? colors.accent2_700 : colors.accent700}>{kick}</Kicker>
              <T size={20} w={600} lh={1.2} style={{ marginVertical: 6 }}>{p.title}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <T size={12.5} color={colors.neutral700}>{p.society.short_name ?? p.society.name}</T>{p.society.verified && <Seal />}
                <T size={12.5} color={colors.neutral700} style={{ flex: 1 }}> · {p.kind === 'recruiting' ? p.meta_note ?? 'open' : `${n(p.rsvp_count)} ${p.rsvp_word}`}</T>
                {p.kind === 'recruiting'
                  ? <PrimaryBtn label="Apply" secondary height={36} onPress={() => p.apply_url && Linking.openURL(p.apply_url)} />
                  : p.kind !== 'talk' && <PrimaryBtn label={going ? 'Going ✓' : 'RSVP'} secondary={!going} height={36} onPress={() => rsvp(p.id)} />}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
