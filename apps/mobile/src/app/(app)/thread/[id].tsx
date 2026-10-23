import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Share, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  acceptReply, ago, colors, deleteReply, deleteThread, editReply, editThread, getThread, n, postReply, setSaved, sortReplies, voteReply, voteThread, votePoll, fonts,
  type ReplyNode, type ReportTarget,
} from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useMe, useRequireMe } from '@/lib/auth';
import { useData } from '@/lib/useData';
import { usePresence } from '@/lib/presence';
import { T } from '@/components/T';
import { Icon } from '@/components/Icon';
import { Markdown } from '@/components/Markdown';
import { AppBar, Avatar, FlairTag, IconBtn, Screen, Seal, Tag } from '@/components/ui';
import { ActionSheet, EditSheet, ReportSheet, type SheetAction } from '@/components/Sheets';

export default function Thread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const requireMe = useRequireMe();
  const { online, setBoard } = usePresence();
  const { data, setData, refreshing, refresh, reload } = useData(() => getThread(supabase, Number(id), me?.id ?? null), [id]);
  const [sort, setSort] = useState<'best' | 'newest'>('best');
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyNode | null>(null);
  const [menu, setMenu] = useState<SheetAction[] | null>(null);
  const [editing, setEditing] = useState<{ heading: string; title?: string; body: string; save: (v: { title?: string; body: string }) => Promise<void> } | null>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const slug = data?.board.slug;
  useEffect(() => { if (slug) { setBoard(slug); return () => setBoard(null); } }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <Screen><AppBar /></Screen>;
  const t = data.thread;
  const isOp = t.author.id === me?.id;

  const vote = async () => {
    if (!requireMe()) return;
    const next = data.myVote === 1 ? 0 : 1;
    setData({ ...data, myVote: next, thread: { ...t, score: t.score + (next - data.myVote) } });
    try { const s = await voteThread(supabase, t.id, next as 0 | 1); setData((d) => d && { ...d, thread: { ...d.thread, score: s } }); } catch { reload(); }
  };
  const save = async () => {
    const u = requireMe(); if (!u) return;
    setData({ ...data, saved: !data.saved });
    await setSaved(supabase, t.id, u.id, !data.saved).catch(reload);
  };
  const send = async () => {
    const u = requireMe(); if (!u) return;
    const body = draft.trim(); if (!body) return;
    setDraft('');
    const parent = replyTo ? (replyTo.parent_id ?? replyTo.id) : null;
    setReplyTo(null);
    await postReply(supabase, { threadId: t.id, userId: u.id, body, parentId: parent });
    reload();
  };

  const fail = (e: unknown) => Alert.alert('Something went wrong', (e as Error).message);
  const confirmDelete = (what: string, run: () => Promise<void>) => Alert.alert(`Delete this ${what}?`, 'This can’t be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { run().catch(fail); } },
  ]);
  const threadMenu = () => {
    const actions: SheetAction[] = [{ label: `Go to ${data.board.short_name ?? data.board.name}`, icon: 'squares-four', onPress: () => router.push(`/board/${data.board.slug}`) }];
    if (isOp) {
      actions.push(
        { label: 'Edit thread', icon: 'pencil-simple-line', onPress: () => setEditing({ heading: 'Edit thread', title: t.title, body: t.body, save: async (v) => { await editThread(supabase, t.id, { title: v.title ?? t.title, body: v.body }).catch((e) => { fail(e); throw e; }); reload(); } }) },
        { label: 'Delete thread', icon: 'trash', danger: true, onPress: () => confirmDelete('thread and all its replies', async () => { await deleteThread(supabase, t.id); router.back(); }) },
      );
    } else {
      actions.push({ label: 'Report thread', icon: 'flag', danger: true, onPress: () => requireMe() && setReport({ threadId: t.id }) });
    }
    setMenu(actions);
  };
  const replyMenu = (r: ReplyNode) => {
    if (r.author.id === me?.id) {
      setMenu([
        { label: 'Edit reply', icon: 'pencil-simple-line', onPress: () => setEditing({ heading: 'Edit reply', body: r.body, save: async (v) => { await editReply(supabase, r.id, v.body).catch((e) => { fail(e); throw e; }); reload(); } }) },
        { label: 'Delete reply', icon: 'trash', danger: true, onPress: () => confirmDelete('reply', async () => { await deleteReply(supabase, r.id); reload(); }) },
      ]);
    } else {
      setMenu([{ label: 'Report reply', icon: 'flag', danger: true, onPress: () => requireMe() && setReport({ replyId: r.id }) }]);
    }
  };

  return (
    <Screen>
      <AppBar title={data.board.short_name ?? data.board.name} subtitle={`${online.filter((u) => u.board === slug).length} online`}
        right={<IconBtn name="dots-three" label="More" onPress={threadMenu} />} />
      <ActionSheet visible={!!menu} actions={menu ?? []} onClose={() => setMenu(null)} />
      {editing && <EditSheet visible heading={editing.heading} title={editing.title} body={editing.body} onSave={editing.save} onClose={() => setEditing(null)} />}
      <ReportSheet target={report} onClose={() => setReport(null)} onDone={(msg) => Alert.alert(msg)} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}>
          {t.tags.length > 0 && <View style={{ flexDirection: 'row', gap: 6, paddingTop: 6, flexWrap: 'wrap' }}>{t.tags.slice(0, 3).map((g, i) => <Tag key={g} tone={i === 0 ? 'accent' : 'neutral'}>{g}</Tag>)}</View>}
          <T size={25} w={600} lh={1.14} style={{ marginVertical: 10 }}>{t.title}</T>
          <Pressable onPress={() => router.push(`/u/${t.author.handle}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Avatar person={t.author} size={26} />
            <T size={12.5} w={600}>@{t.author.handle}</T>{t.society?.verified && <Seal />}
            <FlairTag person={t.author} />
            <T size={12.5} color={colors.neutral700}>{ago(t.created_at)}{t.edited_at ? ' · edited' : ''}</T>
          </Pressable>
          <View style={{ marginTop: 14 }}><Markdown source={t.body} /></View>
          {data.poll && <Poll threadId={t.id} options={data.poll} mine={data.myPollOption} />}
          {t.attachment && (
            <Pressable onPress={() => t.attachment?.subject && router.push(`/library/${t.attachment.subject}`)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: colors.surface, borderRadius: 2 }}>
              <Icon name="file-pdf" size={24} color={colors.accent2} />
              <View style={{ flex: 1 }}>
                <T size={14} w={600} color={colors.accent700}>{t.attachment.name}</T>
                {t.attachment.subject && <T size={12} color={colors.neutral700}>Library › {t.attachment.subject}</T>}
              </View>
              <Icon name="download-simple" size={20} color={colors.accent} />
            </Pressable>
          )}
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 12 }}>
            <Pressable onPress={vote} accessibilityRole="button" accessibilityState={{ selected: data.myVote === 1 }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 44, paddingHorizontal: 12, borderRadius: 2, backgroundColor: data.myVote === 1 ? colors.accent : colors.accent100 }}>
              <Icon name="arrow-fat-up" size={20} color={data.myVote === 1 ? colors.bg : colors.accent800} weight={data.myVote === 1 ? 'fill' : 'duotone'} />
              <T size={14} w={600} color={data.myVote === 1 ? colors.bg : colors.accent800}>{n(t.score)}</T>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 44, paddingHorizontal: 12 }}>
              <Icon name="chat-circle" size={20} color={colors.neutral700} /><T size={14} color={colors.neutral700}>{n(Math.max(t.reply_count, data.replyCount))}</T>
            </View>
            <View style={{ marginLeft: 'auto', flexDirection: 'row' }}>
              <IconBtn name="bookmark-simple" label="Save" onPress={save} color={data.saved ? colors.accent : colors.text} weight={data.saved ? 'fill' : 'duotone'} />
              <IconBtn name="share-network" label="Share" onPress={() => Share.share({ message: `${t.title} — DTour` })} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 18, marginBottom: 14 }}>
            <T size={14} w={600}>{n(Math.max(t.reply_count, data.replyCount))} replies</T>
            {(['best', 'newest'] as const).map((s) => (
              <Pressable key={s} onPress={() => setSort(s)} hitSlop={10}>
                <T size={14} w={sort === s ? 600 : 400} color={sort === s ? colors.accent700 : colors.neutral700}>{s === 'best' ? 'Best' : 'Newest'}</T>
              </Pressable>
            ))}
          </View>
          <View style={{ gap: 18 }}>
            {sortReplies(data.replies, sort, t.accepted_reply_id).map((r) => (
              <Reply key={r.id} r={r} opId={t.author.id} acceptedId={t.accepted_reply_id} isOp={isOp} threadId={t.id} onReply={setReplyTo} onChange={reload} onMore={replyMenu} />
            ))}
            {!data.replies.length && <T size={15} i color={colors.neutral700}>No replies yet. Be the first.</T>}
          </View>
        </ScrollView>
        <View style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 30 }}>
          {replyTo && (
            <Pressable onPress={() => setReplyTo(null)} style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
              <T size={12.5} color={colors.neutral700}>Replying to @{replyTo.author.handle} ·</T><T size={12.5} w={600} color={colors.accent700}>Cancel</T>
            </Pressable>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TextInput value={draft} onChangeText={setDraft} placeholder={me ? 'Add a reply…' : 'Sign in to reply'} onFocus={() => { if (!me) requireMe(); }} placeholderTextColor={colors.neutral700} multiline
              style={{ flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, backgroundColor: colors.surface, borderRadius: 2, fontFamily: fonts.regular, fontSize: 15, color: colors.text }} />
            <Pressable onPress={send} accessibilityLabel="Send reply" style={{ width: 44, height: 44, borderRadius: 2, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="paper-plane-tilt" size={20} color={colors.bg} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Reply({ r, opId, acceptedId, isOp, threadId, onReply, onChange, onMore, nested }: {
  r: ReplyNode; opId: string; acceptedId: number | null; isOp: boolean; threadId: number;
  onReply: (r: ReplyNode) => void; onChange: () => void; onMore: (r: ReplyNode) => void; nested?: boolean;
}) {
  const deleted = !!r.deleted_at;
  const [v, setV] = useState(r.myVote);
  const [s, setS] = useState(r.score);
  const accepted = r.id === acceptedId;
  const requireMe = useRequireMe();
  const vote = async () => { if (!requireMe()) return; const nx = v === 1 ? 0 : 1; setS(s + nx - v); setV(nx); voteReply(supabase, r.id, nx as 0 | 1).catch(() => { setS(s); setV(v); }); };
  const head = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {r.society ? <><T size={12.5} w={600}>{r.society.name}</T>{r.society.verified && <Seal />}</> : <T size={nested ? 12 : 12.5} w={600}>@{r.author.handle}</T>}
      {!r.society && (r.author.id === opId ? <Tag tone="accent2">OP</Tag> : <FlairTag person={r.author} />)}
      <T size={12.5} color={colors.neutral700}>· {ago(r.created_at)}{r.edited_at && !deleted ? ' · edited' : ''}</T>
      {accepted && <View style={{ marginLeft: 'auto' }}><Tag tone="accent">Accepted</Tag></View>}
    </View>
  );
  const actions = deleted ? null : (
    <View style={{ flexDirection: 'row', gap: 4, marginTop: 2, marginLeft: -10 }}>
      <Pressable onPress={vote} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 10 }}>
        <Icon name="arrow-fat-up" size={16} color={v === 1 || s > 0 ? colors.accent : colors.neutral700} weight={v === 1 ? 'fill' : 'duotone'} /><T size={12.5} color={colors.neutral700}>{s}</T>
      </Pressable>
      <Pressable onPress={() => onReply(r)} style={{ height: 36, paddingHorizontal: 10, justifyContent: 'center' }}><T size={12.5} color={colors.neutral700}>Reply</T></Pressable>
      {isOp && !nested && (
        <Pressable onPress={async () => { await acceptReply(supabase, threadId, accepted ? null : r.id); onChange(); }} style={{ height: 36, paddingHorizontal: 10, justifyContent: 'center' }}>
          <T size={12.5} color={colors.neutral700}>{accepted ? 'Unaccept' : 'Accept'}</T>
        </Pressable>
      )}
      <Pressable onPress={() => onMore(r)} accessibilityLabel="More actions" style={{ height: 36, width: 40, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="dots-three" size={18} color={colors.neutral700} />
      </Pressable>
    </View>
  );
  const bodyStyle = deleted ? { fontStyle: 'italic' as const } : undefined;
  if (nested) {
    return (
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.neutral300 }}>
        <Avatar person={r.author} society={r.society} size={24} />
        <View style={{ flex: 1 }}>{head}<T size={14.5} i={deleted} color={deleted ? colors.neutral700 : colors.text} style={{ marginTop: 2, ...bodyStyle }}>{r.body}</T>{actions}</View>
      </View>
    );
  }
  return (
    <View>
      {head}
      <T size={15} lh={1.55} i={deleted} color={deleted ? colors.neutral700 : colors.text} style={{ marginTop: 4, ...bodyStyle }}>{r.body}</T>
      {actions}
      {r.children.map((c) => <Reply key={c.id} r={c} opId={opId} acceptedId={acceptedId} isOp={isOp} threadId={threadId} onReply={onReply} onChange={onChange} onMore={onMore} nested />)}
    </View>
  );
}

function Poll({ threadId, options, mine }: { threadId: number; options: { id: number; label: string; votes: number }[]; mine: number | null }) {
  const requireMe = useRequireMe();
  const [opts, setOpts] = useState(options);
  const [sel, setSel] = useState(mine);
  const total = opts.reduce((a, o) => a + o.votes, 0);
  const pick = async (id: number) => {
    const u = requireMe(); if (!u || id === sel) return;
    setOpts(opts.map((o) => ({ ...o, votes: o.votes + (o.id === id ? 1 : 0) - (o.id === sel ? 1 : 0) }))); setSel(id);
    await votePoll(supabase, threadId, id, u.id);
  };
  return (
    <View style={{ gap: 8, marginBottom: 14 }}>
      {opts.map((o) => {
        const pct = total ? Math.round((o.votes / total) * 100) : 0;
        return (
          <Pressable key={o.id} onPress={() => pick(o.id)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 2, backgroundColor: colors.surface, borderWidth: sel === o.id ? 2 : 0, borderColor: colors.accent, overflow: 'hidden' }}>
            {sel != null && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: colors.accent100 }} />}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T size={15} w={sel === o.id ? 600 : 400}>{o.label}</T>{sel != null && <T size={15} w={600}>{pct}%</T>}</View>
          </Pressable>
        );
      })}
      <T size={12.5} color={colors.neutral700}>{n(total)} votes</T>
    </View>
  );
}
