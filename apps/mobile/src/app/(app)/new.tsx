import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { boardPicker, colors, createTeam, createThread, createWikiArticle, createSocietyPost, fonts, myPostingSocieties, similarThreads, type SocietyLite } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useMe } from '@/lib/auth';
import { useData } from '@/lib/useData';
import { appRoute } from '@/lib/routes';
import { T } from '@/components/T';
import { Icon } from '@/components/Icon';
import { IconBtn, PrimaryBtn, Screen } from '@/components/ui';

const TYPES = [['thread', 'Thread'], ['question', 'Question'], ['article', 'Wiki'], ['team', 'Team'], ['poll', 'Poll'], ['event', 'Society']] as const;
type Kind = (typeof TYPES)[number][0];
const TONE = { accent: colors.accent, accent2: colors.accent2, ink: colors.text };

export default function NewPost() {
  const router = useRouter();
  const me = useMe();
  const params = useLocalSearchParams<{ type?: string; board?: string; title?: string }>();
  const [type, setType] = useState<Kind>((TYPES.find(([k]) => k === params.type)?.[0]) ?? 'thread');
  const [title, setTitle] = useState(params.title ?? '');
  const [body, setBody] = useState('');
  const [pickedBoard, setBoardId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [opts, setOpts] = useState(['', '']);
  const [eventName, setEventName] = useState('');
  const [roles, setRoles] = useState('');
  const [when, setWhen] = useState('');
  const [where, setWhere] = useState('');
  const [sim, setSim] = useState<{ title: string; sub: string; route: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { data } = useData(async () => {
    const [boards, societies] = await Promise.all([boardPicker(supabase), myPostingSocieties(supabase, me.id)]);
    return { boards, societies: societies as SocietyLite[] };
  });


  useEffect(() => {
    const t = setTimeout(async () => setSim(title.trim().length > 3 ? (await similarThreads(supabase, title, 1))[0] ?? null : null), 250);
    return () => clearTimeout(t);
  }, [title]);

  const defaultBoard = useMemo(() => data?.boards.find((x) => x.slug === params.board) ?? data?.boards.find((x) => x.slug === `academics-${(me.branch_code ?? '').toLowerCase()}`) ?? data?.boards.find((x) => x.slug === 'campus-buzz'), [data, params.board, me.branch_code]);
  const boardId = pickedBoard ?? defaultBoard?.id ?? null;
  const board = useMemo(() => data?.boards.find((b) => b.id === boardId), [data, boardId]);
  const insert = (s: string) => setBody((b) => b + s);

  const post = async () => {
    if (title.trim().length < 3) return Alert.alert('Add a title first.');
    setBusy(true);
    try {
      if (type === 'article') { const slug = await createWikiArticle(supabase, { userId: me.id, title, body, boardId }); router.replace(`/wiki/${slug}`); return; }
      if (type === 'team') {
        await createTeam(supabase, { userId: me.id, category: 'hackathon', eventName: eventName || 'Project', title, description: body, deadlineOn: null, roles: roles.split(',').map((r) => r.trim()).filter(Boolean).map((name) => ({ name, filled: false })) });
        router.replace('/teams'); return;
      }
      if (type === 'event') {
        const soc = data?.societies[0];
        if (!soc) throw new Error('Only verified society accounts can post to the Society board.');
        await createSocietyPost(supabase, { userId: me.id, societyId: soc.id, kind: 'event', title, body, whenLabel: when || 'soon', whereLabel: where });
        router.replace('/societies'); return;
      }
      if (!boardId) throw new Error('Pick a board.');
      const id = await createThread(supabase, { userId: me.id, boardId, kind: type === 'poll' ? 'poll' : type === 'question' ? 'question' : 'thread', title, body, tags: [], pollOptions: opts.filter((o) => o.trim()) });
      router.replace(`/thread/${id}`);
    } catch (e) { Alert.alert('Could not post', (e as Error).message); setBusy(false); }
  };

  const input = { fontFamily: fonts.regular, fontSize: 15, color: colors.text, backgroundColor: colors.surface, borderRadius: 2, height: 44, paddingHorizontal: 12 } as const;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 6, paddingRight: 12, paddingBottom: 6 }}>
        <IconBtn name="x" label="Close" onPress={() => router.back()} />
        <T size={17} w={600}>New post</T>
        <PrimaryBtn label="Post" height={38} onPress={post} disabled={busy} style={{ marginLeft: 'auto' }} />
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {TYPES.map(([k, l]) => (
            <Pressable key={k} onPress={() => setType(k)} style={{ height: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 2, backgroundColor: type === k ? colors.accent100 : colors.surface, borderWidth: 2, borderColor: type === k ? colors.accent : 'transparent' }}>
              <T size={13.5} w={600} color={type === k ? colors.accent900 : colors.neutral800}>{l}</T>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
          {(type === 'thread' || type === 'question' || type === 'poll') && (
            <>
              <Pressable onPress={() => setPicking(!picking)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, marginTop: 16, paddingHorizontal: 14, backgroundColor: colors.surface, borderRadius: 2 }}>
                {board && <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: TONE[board.tone] }} />}
                <T size={14.5} color={colors.neutral700} numberOfLines={1} style={{ flex: 1 }}>
                  {board ? <>{board.path.slice(1, -1).join(' › ')}{board.path.length > 2 ? ' › ' : ''}<T size={14.5} w={600}>{board.path[board.path.length - 1]}</T></> : 'Pick a board'}
                </T>
                <Icon name="caret-down" size={16} color={colors.neutral700} />
              </Pressable>
              {picking && data?.boards.filter((b) => !b.verified_only || data.societies.length).map((b) => (
                <Pressable key={b.id} onPress={() => { setBoardId(b.id); setPicking(false); }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, backgroundColor: b.id === boardId ? colors.accent100 : 'transparent' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: TONE[b.tone] }} /><T size={14.5}>{b.path.join(' › ')}</T>
                </Pressable>
              ))}
            </>
          )}
          <TextInput value={title} onChangeText={(v) => setTitle(v.slice(0, 140))} placeholder="A clear, specific title" placeholderTextColor={colors.neutral600} multiline
            style={{ borderBottomWidth: 2, borderBottomColor: colors.text, paddingTop: 18, paddingBottom: 10, marginTop: 6, fontFamily: fonts.semibold, fontSize: 23, lineHeight: 29, color: colors.text }} />
          <T size={12} color={colors.neutral700} align="right" style={{ marginTop: 6 }}>{title.length}/140</T>
          {sim && (
            <Pressable onPress={() => router.push(appRoute(sim.route))} style={{ marginTop: 12, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: colors.accent100, borderRadius: 2 }}>
              <T size={10.5} w={600} ls={0.12} caps color={colors.accent800}>Already asked?</T>
              <T size={15.5} w={600} lh={1.3} color={colors.accent900} style={{ marginTop: 6 }}>{sim.title}</T>
              <T size={12.5} color={colors.accent800} style={{ marginTop: 2 }}>{sim.sub}</T>
            </Pressable>
          )}
          {type === 'poll' && (
            <View style={{ gap: 8, marginTop: 16 }}>
              {opts.map((o, i) => <TextInput key={i} value={o} onChangeText={(v) => setOpts(opts.map((x, k) => (k === i ? v : x)))} placeholder={`Option ${i + 1}`} placeholderTextColor={colors.neutral700} style={input} />)}
              <Pressable onPress={() => setOpts([...opts, ''])}><T size={14} w={600} color={colors.accent700}>+ Add option</T></Pressable>
            </View>
          )}
          {type === 'team' && (
            <View style={{ gap: 8, marginTop: 16 }}>
              <TextInput value={eventName} onChangeText={setEventName} placeholder="Event / hackathon" placeholderTextColor={colors.neutral700} style={input} />
              <TextInput value={roles} onChangeText={setRoles} placeholder="Open roles, comma separated" placeholderTextColor={colors.neutral700} style={input} />
            </View>
          )}
          {type === 'event' && (
            <View style={{ gap: 8, marginTop: 16 }}>
              {!data?.societies.length && <T size={13.5} color={colors.neutral700}>Only verified society accounts can post here.</T>}
              <TextInput value={when} onChangeText={setWhen} placeholder="When — Fri 23 Oct · 5 pm" placeholderTextColor={colors.neutral700} style={input} />
              <TextInput value={where} onChangeText={setWhere} placeholder="Where — SPS-12" placeholderTextColor={colors.neutral700} style={input} />
            </View>
          )}
          <TextInput value={body} onChangeText={setBody} multiline placeholder="Add context. What have you tried? Which professor?" placeholderTextColor={colors.neutral600}
            style={{ marginTop: 16, minHeight: 150, textAlignVertical: 'top', fontFamily: fonts.regular, fontSize: 16, lineHeight: 25, color: colors.text }} />
        </ScrollView>
        <View style={{ borderTopWidth: 1, borderTopColor: colors.divider, flexDirection: 'row', alignItems: 'center', paddingTop: 4, paddingHorizontal: 8, paddingBottom: 30 }}>
          <IconBtn name="image" label="Image" onPress={() => Alert.alert('Images', 'Attach images from the website for now.')} />
          <IconBtn name="paperclip" label="Attach" onPress={() => router.push('/library')} />
          <IconBtn name="text-b" label="Bold" onPress={() => insert('**bold**')} />
          <IconBtn name="link" label="Link" onPress={() => insert('[link](https://)')} />
          <IconBtn name="code" label="Code" onPress={() => insert('`code`')} />
          <IconBtn name="function" label="LaTeX" onPress={() => insert('$x^2$')} />
          <IconBtn name="hash" label="Tag" onPress={() => insert(' #')} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
