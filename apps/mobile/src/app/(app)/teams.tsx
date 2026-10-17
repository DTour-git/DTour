import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, deadlineText, getTeams, toggleTeamRequest } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useMe, useRequireMe } from '@/lib/auth';
import { useData } from '@/lib/useData';
import { T } from '@/components/T';
import { Icon } from '@/components/Icon';
import { AppBar, IconBtn, Pill, PillRow, PrimaryBtn, Screen, Tag } from '@/components/ui';

const CATS: [string | null, string, 'accent' | 'accent2' | undefined][] = [[null, 'All', undefined], ['hackathon', 'Hackathons', 'accent'], ['project', 'Projects', 'accent'], ['competition', 'Competitions', 'accent2'], ['research', 'Research', undefined]];

export default function Teams() {
  const router = useRouter();
  const me = useMe();
  const requireMe = useRequireMe();
  const [cat, setCat] = useState<string | null>(null);
  const { data, setData, refreshing, refresh } = useData(() => getTeams(supabase, me?.id ?? null));
  const teams = (data?.teams ?? []).filter((t) => !cat || t.category === cat);

  const ask = async (id: number) => {
    if (!data || !requireMe()) return;
    const r = new Set(data.myRequests); if (r.has(id)) r.delete(id); else r.add(id);
    setData({ ...data, myRequests: r });
    await toggleTeamRequest(supabase, id).catch(refresh);
  };

  return (
    <Screen>
      <AppBar title="Team Up" subtitle={`${data?.teams.length ?? ''} open teams`} right={<IconBtn name="plus" color={colors.accent} label="Post a team" onPress={() => router.push({ pathname: '/new', params: { type: 'team' } })} />} />
      <PillRow>{CATS.map(([k, l, t]) => <Pill key={l} label={k && data ? `${l} · ${data.counts[k] ?? 0}` : l} tone={t ?? 'surface'} active={cat === k} onPress={() => setCat(k)} />)}</PillRow>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}>
        <Pressable onPress={() => router.navigate('/you')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.accent100, borderRadius: 2 }}>
          <Icon name="hand-waving" size={20} color={colors.accent700} />
          <T size={14} color={colors.accent900} style={{ flex: 1 }}>{me?.open_to_teams
            ? <>You&apos;re <T size={14} w={600} color={colors.accent900}>open to teams</T>{me.skills.length ? ` · ${me.skills.slice(0, 2).join(', ')}` : ''}</>
            : <>Turn on <T size={14} w={600} color={colors.accent900}>open to teams</T> so teams can find you</>}</T>
          <Icon name="caret-right" size={16} color={colors.accent900} />
        </Pressable>
        {teams.map((t, i) => {
          const req = data!.myRequests.has(t.id);
          return (
            <View key={t.id} style={{ padding: 16, gap: 10, marginTop: 12, backgroundColor: colors.surface, borderRadius: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Tag tone={t.event_tone}>{t.event_short ?? t.event_name}</Tag>
                <T size={12} w={600} color={t.urgent ? colors.accent2_700 : colors.neutral700} style={{ marginLeft: 'auto' }}>{deadlineText(t.deadline_on, t.deadline_label)}</T>
              </View>
              <T size={18} w={600} lh={1.25}>{t.title}</T>
              {t.description && i === 0 ? <T size={14} lh={1.5} color={colors.neutral800}>{t.description}</T> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 }}>
                {t.team_roles.map((r) => (
                  <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name={r.filled ? 'check-circle' : 'circle-dashed'} size={16} color={r.filled ? colors.neutral700 : colors.accent} />
                    <T size={13.5} w={r.filled ? 400 : 600} color={r.filled ? colors.neutral700 : colors.text}>{r.name}</T>
                  </View>
                ))}
              </View>
              {t.owner_id === me?.id
                ? <T size={13} color={colors.neutral700}>Your team</T>
                : <PrimaryBtn label={req ? 'Requested ✓' : 'Ask to join'} secondary={!req && i !== 0} onPress={() => ask(t.id)} />}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
