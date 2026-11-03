import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import {
  REPORT_REASONS, agoLong, colors, fonts, getModQueue, getOpenReports, getSuspensionHistory, setMemberSuspension, plain, resolveReport, reviewArticle, reviewRevision,
} from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useMe } from '@/lib/auth';
import { useData } from '@/lib/useData';
import { appRoute } from '@/lib/routes';
import { T } from '@/components/T';
import { AppBar, PrimaryBtn, Screen, Tag, rowRule } from '@/components/ui';

const REASON = Object.fromEntries(REPORT_REASONS);

/** Moderation queue: reported posts, new guides and suggested wiki edits. */
export default function Mod() {
  const me = useMe();
  const router = useRouter();
  const { data, refreshing, refresh, reload } = useData(async () => {
    const [queue, reports, history] = await Promise.all([getModQueue(supabase), getOpenReports(supabase), getSuspensionHistory(supabase)]);
    return { ...queue, reports, history };
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [handle, setHandle] = useState('');
  const [reason, setReason] = useState('');
  const [end, setEnd] = useState('');
  const [share, setShare] = useState(false);
  if (!me) return <Redirect href="/login" />;
  if (me.role !== 'moderator' && me.role !== 'admin') return <Redirect href="/" />;

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); reload(); } catch (e) { Alert.alert('Could not update', (e as Error).message); } finally { setBusy(null); }
  };
  const confirmRemove = (key: string, what: string, run: () => Promise<void>) => Alert.alert(`Remove this ${what}?`, 'It disappears for everyone.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => act(key, run) },
  ]);
  return (
    <Screen>
      <AppBar title="Moderation" subtitle="Reports, new guides and wiki edits" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}>
        <Section title="Member suspensions" count={data?.history.length ?? 0} />
        <T size={14} color={colors.neutral700}>Enter a handle and a reason for the moderator record. Leave the end date empty for an indefinite suspension.</T>
        <TextInput accessibilityLabel="Member handle" value={handle} onChangeText={setHandle} placeholder="@handle" autoCapitalize="none" style={{ marginTop: 10, padding: 10, backgroundColor: colors.surface, fontFamily: fonts.regular }} />
        <TextInput accessibilityLabel="Suspension reason" value={reason} onChangeText={setReason} placeholder="Reason (required)" maxLength={1000} style={{ marginTop: 10, padding: 10, backgroundColor: colors.surface, fontFamily: fonts.regular }} />
        <TextInput accessibilityLabel="Suspension end date" value={end} onChangeText={setEnd} placeholder="End date, YYYY-MM-DD (optional)" style={{ marginTop: 10, padding: 10, backgroundColor: colors.surface, fontFamily: fonts.regular }} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: share }} onPress={() => setShare(!share)} style={{ paddingVertical: 12 }}><T>{share ? '☑' : '☐'} Show the reason to the member</T></Pressable>
        <Buttons busy={busy === 'suspension'} no="Lift suspension" yes="Suspend member"
          onNo={() => act('suspension', () => setMemberSuspension(supabase, handle, reason, null, false, false))}
          onYes={() => act('suspension', async () => {
            if (end && (!/^\d{4}-\d{2}-\d{2}$/.test(end) || Number.isNaN(Date.parse(`${end}T23:59:59+05:30`)))) throw new Error('Enter a valid date as YYYY-MM-DD');
            await setMemberSuspension(supabase, handle, reason, end ? new Date(`${end}T23:59:59+05:30`).toISOString() : null, share, true);
          })} />
        <T size={16} w={600} style={{ marginTop: 20 }}>Suspension history</T>
        {data?.history.map((e) => <View key={e.id} style={[{ paddingVertical: 10 }, rowRule]}><T size={14}><T w={600}>@{e.handle}</T> · {e.action === 'suspend' ? 'suspended' : 'suspension lifted'} by @{e.actor_handle} · {new Date(e.created_at).toLocaleString()}</T><T size={14}>{e.reason}{e.action === 'suspend' ? ` · ${e.ends_at ? `until ${new Date(e.ends_at).toLocaleString()}` : 'indefinite'} · reason ${e.share_reason ? 'shared' : 'private'}` : ''}</T></View>)}
        {data && !data.history.length && <Empty>No suspension history.</Empty>}
        <Section title="Reported posts" count={data?.reports.length ?? 0} />
        {data?.reports.map((r) => (
          <View key={r.key} style={[{ paddingVertical: 14 }, rowRule]}>
            <Pressable onPress={() => router.push(appRoute(r.route))}>
              <T size={16} w={600} color={colors.accent700}>{r.title}</T>
            </Pressable>
            <T size={12.5} color={colors.neutral700} style={{ marginTop: 2 }}>{r.author ? `by @${r.author.handle} · ` : ''}{r.count} {r.count === 1 ? 'report' : 'reports'} · first {agoLong(r.first_at)}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{r.reasons.map((x) => <Tag key={x} tone="accent2">{REASON[x] ?? x}</Tag>)}</View>
            <T size={14.5} lh={1.5} style={{ marginTop: 8, padding: 10, backgroundColor: colors.surface }} numberOfLines={6}>{r.body || 'No text'}</T>
            {r.details.map((d, i) => <T key={i} size={13.5} i color={colors.neutral800} style={{ marginTop: 6 }}>“{d}”</T>)}
            <Buttons busy={busy === r.key} no="Keep it up" yes={`Remove ${r.kind === 'lounge' ? 'message' : r.kind}`}
              onNo={() => act(r.key, () => resolveReport(supabase, r.ids[0], false))}
              onYes={() => confirmRemove(r.key, r.kind === 'lounge' ? 'message' : r.kind, () => resolveReport(supabase, r.ids[0], true))} />
          </View>
        ))}
        {data && !data.reports.length && <Empty>No open reports.</Empty>}

        <Section title="New guides" count={data?.articles.length ?? 0} />
        {data?.articles.map((a) => {
          const k = `a${a.id}`;
          return (
            <View key={a.id} style={[{ paddingVertical: 14 }, rowRule]}>
              <T size={16} w={600}>{a.title}</T>
              <T size={12.5} color={colors.neutral700} style={{ marginTop: 2 }}>by @{a.starter?.handle} · {agoLong(a.created_at)}</T>
              <T size={14} lh={1.5} color={colors.neutral800} style={{ marginTop: 6 }} numberOfLines={5}>{plain(a.body || '', 400)}</T>
              <Note value={notes[k] ?? ''} onChange={(v) => setNotes({ ...notes, [k]: v })} />
              <Buttons busy={busy === k} no="Reject" yes="Approve"
                onNo={() => act(k, () => reviewArticle(supabase, a.id, false, notes[k]))}
                onYes={() => act(k, () => reviewArticle(supabase, a.id, true, notes[k]))} />
            </View>
          );
        })}
        {data && !data.articles.length && <Empty>No new guides waiting.</Empty>}

        <Section title="Suggested edits" count={data?.revisions.length ?? 0} />
        {data?.revisions.map((r) => {
          const k = `r${r.id}`;
          return (
            <View key={r.id} style={[{ paddingVertical: 14 }, rowRule]}>
              <Pressable onPress={() => router.push(appRoute(`/wiki/${r.article.slug}`))}><T size={16} w={600} color={colors.accent700}>{r.article.title}</T></Pressable>
              <T size={13.5} style={{ marginTop: 2 }}><T size={13.5} w={600}>@{r.editor.handle}</T> {r.summary}</T>
              <T size={12.5} color={colors.neutral700}>{agoLong(r.created_at)}{r.delta_words != null ? ` · ${r.delta_words >= 0 ? '+' : '−'}${Math.abs(r.delta_words)} words` : ''}</T>
              <T size={14} lh={1.5} color={colors.neutral800} style={{ marginTop: 6, padding: 10, backgroundColor: colors.accent100 }} numberOfLines={6}>{plain(r.body ?? '', 400)}</T>
              <Note value={notes[k] ?? ''} onChange={(v) => setNotes({ ...notes, [k]: v })} />
              <Buttons busy={busy === k} no="Reject" yes="Approve"
                onNo={() => act(k, () => reviewRevision(supabase, r.id, false, notes[k]))}
                onYes={() => act(k, () => reviewRevision(supabase, r.id, true, notes[k]))} />
            </View>
          );
        })}
        {data && !data.revisions.length && <Empty>No edits waiting.</Empty>}
      </ScrollView>
    </Screen>
  );
}

function Note({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput value={value} onChangeText={onChange} placeholder="Note to the author (optional)" placeholderTextColor={colors.neutral700}
      style={{ marginTop: 10, height: 40, paddingHorizontal: 12, backgroundColor: colors.surface, borderRadius: 2, fontFamily: fonts.regular, fontSize: 14, color: colors.text }} />
  );
}
function Buttons({ busy, no, yes, onNo, onYes }: { busy: boolean; no: string; yes: string; onNo: () => void; onYes: () => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
      <PrimaryBtn label={no} secondary height={40} disabled={busy} onPress={onNo} style={{ flex: 1 }} />
      <PrimaryBtn label={yes} height={40} disabled={busy} onPress={onYes} style={{ flex: 1 }} />
    </View>
  );
}
function Section({ title, count }: { title: string; count: number }) {
  return <T size={19} w={600} style={{ marginTop: 24, marginBottom: 4 }}>{title} · {count}</T>;
}
function Empty({ children }: { children: string }) {
  return <T size={14.5} i color={colors.neutral700} style={{ paddingVertical: 10 }}>{children}</T>;
}
