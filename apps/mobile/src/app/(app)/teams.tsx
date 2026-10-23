import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ago, colors, deadlineText, flair, getTeams, matchesSkills, reviewTeamRequest, toggleTeamRequest, type TeamCard, type TeamRequest } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useMe, useRequireMe } from '@/lib/auth';
import { useData } from '@/lib/useData';
import { T } from '@/components/T';
import { Icon } from '@/components/Icon';
import { AppBar, Avatar, IconBtn, Pill, PillRow, PrimaryBtn, Screen, Tag } from '@/components/ui';
import { ActionSheet, type SheetAction } from '@/components/Sheets';

const CATS: [string | null, string, 'accent' | 'accent2' | undefined][] = [[null, 'All', undefined], ['hackathon', 'Hackathons', 'accent'], ['project', 'Projects', 'accent'], ['competition', 'Competitions', 'accent2'], ['research', 'Research', undefined]];

export default function Teams() {
  const router = useRouter();
  const me = useMe();
  const requireMe = useRequireMe();
  const [cat, setCat] = useState<string | null>(null);
  const [mine, setMine] = useState(false);
  const [menu, setMenu] = useState<SheetAction[] | null>(null);
  const { data, setData, refreshing, refresh } = useData(() => getTeams(supabase, me?.id ?? null));
  const skills = me?.skills ?? [];
  const teams = (data?.teams ?? []).filter((t) => (!cat || t.category === cat) && (!mine || matchesSkills(t, skills)));

  const answer = async (t: TeamCard, r: TeamRequest, accept: boolean, roleId?: number) => {
    if (!data) return;
    const left = (data.requests.get(t.id) ?? []).filter((x) => x.user.id !== r.user.id);
    setData({ ...data, requests: new Map(data.requests).set(t.id, left) });
    try { await reviewTeamRequest(supabase, { teamId: t.id, userId: r.user.id, accept, roleId }); refresh(); }
    catch (e) { Alert.alert('Could not update the request', (e as Error).message); refresh(); }
  };
  const acceptWithRole = (t: TeamCard, r: TeamRequest) => {
    const open = t.team_roles.filter((x) => !x.filled);
    if (!open.length) return answer(t, r, true);
    setMenu([
      ...open.map((role) => ({ label: `Accept as ${role.name}`, icon: 'check-circle', onPress: () => answer(t, r, true, role.id) })),
      { label: 'Accept without a role', icon: 'user-circle', onPress: () => answer(t, r, true) },
    ]);
  };

  const ask = async (id: number) => {
    if (!data || !requireMe()) return;
    const r = new Set(data.myRequests); if (r.has(id)) r.delete(id); else r.add(id);
    setData({ ...data, myRequests: r });
    await toggleTeamRequest(supabase, id).catch(refresh);
  };

  return (
    <Screen>
      <AppBar title="Team Up" subtitle={`${data?.teams.length ?? ''} open teams`} right={<IconBtn name="plus" color={colors.accent} label="Post a team" onPress={() => router.push({ pathname: '/new', params: { type: 'team' } })} />} />
      <ActionSheet visible={!!menu} actions={menu ?? []} onClose={() => setMenu(null)} />
      <PillRow>
        {CATS.map(([k, l, t]) => <Pill key={l} label={k && data ? `${l} · ${data.counts[k] ?? 0}` : l} tone={t ?? 'surface'} active={cat === k} onPress={() => setCat(k)} />)}
        {skills.length > 0 && <Pill label="Needs my skills" tone="accent" active={mine} onPress={() => setMine(!mine)} />}
      </PillRow>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}>
        <Pressable onPress={() => router.navigate('/you')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.accent100, borderRadius: 2 }}>
          <Icon name="hand-waving" size={20} color={colors.accent700} />
          <T size={14} color={colors.accent900} style={{ flex: 1 }}>{me?.open_to_teams
            ? <>You&apos;re <T size={14} w={600} color={colors.accent900}>open to teams</T>{me.skills.length ? ` · ${me.skills.slice(0, 2).join(', ')}` : ''}</>
            : <>Turn on <T size={14} w={600} color={colors.accent900}>open to teams</T> so teams can find you</>}</T>
          <Icon name="caret-right" size={16} color={colors.accent900} />
        </Pressable>
        {mine && !teams.length && <T size={15} i color={colors.neutral700} style={{ paddingVertical: 20 }}>No open roles match {skills.slice(0, 2).join(', ')} right now.</T>}
        {teams.map((t, i) => {
          const req = data!.myRequests.has(t.id);
          const status = data!.myRequestStatus.get(t.id);
          const incoming = t.owner_id === me?.id ? data!.requests.get(t.id) ?? [] : [];
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
                ? <T size={13} color={colors.neutral700}>Your team{incoming.length ? ` · ${incoming.length} ${incoming.length === 1 ? 'request' : 'requests'} to join` : ''}</T>
                : status === 'accepted'
                  ? <T size={14} w={600} color={colors.accent700}>You&apos;re in ✓</T>
                  : status === 'declined'
                    ? <T size={13} color={colors.neutral700}>Request not accepted</T>
                    : <PrimaryBtn label={req ? 'Requested ✓' : 'Ask to join'} secondary={!req && i !== 0} onPress={() => ask(t.id)} />}
              {incoming.map((r) => (
                <View key={r.user.id} style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10, gap: 8 }}>
                  <Pressable onPress={() => router.push(`/u/${r.user.handle}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Avatar person={r.user} size={30} />
                    <View style={{ flex: 1 }}>
                      <T size={14} w={600}>@{r.user.handle}<T size={12.5} color={colors.neutral700}>{flair(r.user.branch_code, r.user.grad_year) ? ` · ${flair(r.user.branch_code, r.user.grad_year)}` : ''} · {ago(r.created_at)}</T></T>
                      {r.user.skills.length > 0 && <T size={12.5} color={colors.neutral700}>{r.user.skills.join(', ')}</T>}
                    </View>
                  </Pressable>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <PrimaryBtn label="Decline" secondary height={40} style={{ flex: 1 }} onPress={() => answer(t, r, false)} />
                    <PrimaryBtn label="Accept" height={40} style={{ flex: 1 }} onPress={() => acceptWithRole(t, r)} />
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
