import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { boardPicker, colors, createTeam, createThread, createWikiArticle, createSocietyPost, fonts, getArticle, myPostingSocieties, saveDraft, similarThreads, suggestWikiEdit, uploadImage, uploadLibraryItem, type ProfileRow, type SocietyLite } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useMe } from '@/lib/auth';
import { useData } from '@/lib/useData';
import { appRoute } from '@/lib/routes';
import { T } from '@/components/T';
import { Icon } from '@/components/Icon';
import { IconBtn, Pill, PrimaryBtn, Screen } from '@/components/ui';

const TYPES = [['thread', 'Thread'], ['question', 'Question'], ['article', 'Wiki'], ['team', 'Team'], ['poll', 'Poll'], ['event', 'Society']] as const;
type Kind = (typeof TYPES)[number][0];
const TONE = { accent: colors.accent, accent2: colors.accent2, ink: colors.text };

export default function NewPost() {
  const me = useMe();
  if (!me) return <Redirect href="/login" />;
  return <Composer me={me} />;
}

function Composer({ me }: { me: ProfileRow }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; board?: string; title?: string; edit?: string; draft?: string }>();
  const [type, setType] = useState<Kind>((TYPES.find(([k]) => k === params.type)?.[0]) ?? 'thread');
  const [title, setTitle] = useState(params.title ?? '');
  const [body, setBody] = useState('');
  const [pickedBoard, setBoardId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [opts, setOpts] = useState(['', '']);
  const [pollDays, setPollDays] = useState(3);
  const [notifyReplies, setNotifyReplies] = useState(true);
  const [eventName, setEventName] = useState('');
  const [roles, setRoles] = useState('');
  const [teamCategory, setTeamCategory] = useState('hackathon');
  const [deadline, setDeadline] = useState('');
  const [societyKind, setSocietyKind] = useState('event');
  const [societyId, setSocietyId] = useState<string | null>(null);
  const [when, setWhen] = useState('');
  const [where, setWhere] = useState('');
  const [starts, setStarts] = useState('');
  const [applyUrl, setApplyUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [cover, setCover] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [poster, setPoster] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [fileSubject, setFileSubject] = useState('');
  const [fileKind, setFileKind] = useState<'notes' | 'pyq' | 'lab' | 'slides'>('notes');
  const [draftId, setDraftId] = useState<string | undefined>(params.draft);
  const restoredDraft = useRef<string | null>(null);
  const [sim, setSim] = useState<{ title: string; sub: string; route: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState('');
  const { data } = useData(async () => {
    const [boards, societies, editing, subjects, draft] = await Promise.all([
      boardPicker(supabase), myPostingSocieties(supabase, me.id),
      params.edit ? getArticle(supabase, params.edit, me.id) : null,
      supabase.from('subjects').select('code,name').order('code'),
      params.draft ? supabase.from('drafts').select('*').eq('id', params.draft).eq('user_id', me.id).maybeSingle() : null,
    ]);
    if (editing) { setTitle(editing.article.title); setBody(editing.article.body); }
    if (draft?.data && restoredDraft.current !== draft.data.id) {
      const saved = draft.data;
      restoredDraft.current = saved.id;
      const payload = saved.payload as Record<string, unknown>;
      setType((TYPES.find(([kind]) => kind === saved.kind)?.[0]) ?? 'thread');
      setTitle(saved.title); setBody(saved.body); setBoardId(saved.board_id);
      setOpts(Array.isArray(payload.opts) ? payload.opts as string[] : ['', '']);
      setPollDays(typeof payload.pollDays === 'number' ? payload.pollDays : 3);
      setNotifyReplies(payload.notifyReplies !== false);
      setTags(Array.isArray(payload.tags) ? payload.tags as string[] : []);
      setEventName(typeof payload.eventName === 'string' ? payload.eventName : '');
      setRoles(typeof payload.roles === 'string' ? payload.roles : '');
      setTeamCategory(typeof payload.teamCategory === 'string' ? payload.teamCategory : 'hackathon');
      setDeadline(typeof payload.deadline === 'string' ? payload.deadline : '');
      setSocietyKind(typeof payload.societyKind === 'string' ? payload.societyKind : 'event');
      setSocietyId(typeof payload.societyId === 'string' ? payload.societyId : null);
      setWhen(typeof payload.when === 'string' ? payload.when : '');
      setWhere(typeof payload.where === 'string' ? payload.where : '');
      setStarts(typeof payload.starts === 'string' ? payload.starts : '');
      setApplyUrl(typeof payload.applyUrl === 'string' ? payload.applyUrl : '');
      setDraftId(saved.id);
    }
    return { boards, societies: societies as SocietyLite[], editing, subjects: subjects.data ?? [], draft: draft?.data ?? null };
  });
  const editing = data?.editing ?? null;
  const isMod = me.role === 'moderator' || me.role === 'admin';

  const addImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    try {
      const buf = await (await fetch(a.uri)).arrayBuffer();
      const url = await uploadImage(supabase, me.id, buf, a.fileName ?? 'photo.jpg', a.mimeType ?? 'image/jpeg');
      setBody((b) => `${b}${b && !b.endsWith('\n') ? '\n\n' : ''}![photo](${url})\n`);
    } catch (e) { Alert.alert('Upload failed', (e as Error).message); }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/zip', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'image/*'], copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) setFile(result.assets[0]);
  };

  const addTag = () => {
    const tag = tagDraft.trim().replace(/^#/, '');
    if (tag && !tags.includes(tag) && tags.length < 6) setTags([...tags, tag]);
    setTagDraft('');
  };

  const discardDraft = async () => {
    if (draftId) await supabase.from('drafts').delete().eq('id', draftId);
  };

  const save = async () => {
    try {
      const id = await saveDraft(supabase, { id: draftId, userId: me.id, kind: type, boardId, title, body, payload: { opts, pollDays, notifyReplies, tags, eventName, roles, teamCategory, deadline, societyKind, societyId, when, where, starts, applyUrl } });
      setDraftId(id);
      Alert.alert('Draft saved', 'Find it on your profile to continue editing.');
    } catch (error) { Alert.alert('Could not save draft', (error as Error).message); }
  };


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
      if (editing) {
        if (!summary.trim()) throw new Error('Add a one-line summary of your edit.');
        const live = await suggestWikiEdit(supabase, { articleId: editing.article.id, userId: me.id, summary: summary.trim(), body, oldBody: editing.article.body });
        Alert.alert(live ? 'Edit published' : 'Sent for review', live ? 'You’re credited as an editor.' : 'A moderator checks edits before they go live.');
        router.back(); return;
      }
      if (type === 'article') {
        const coverPath = cover ? await uploadImage(supabase, me.id, await (await fetch(cover.uri)).arrayBuffer(), cover.fileName ?? 'cover.jpg', cover.mimeType ?? 'image/jpeg') : null;
        const slug = await createWikiArticle(supabase, { userId: me.id, title, body, boardId, coverPath });
        await discardDraft();
        if (!isMod) Alert.alert('Sent for review', 'Your guide goes live once a moderator approves it.');
        router.replace(`/wiki/${slug}`); return;
      }
      if (type === 'team') {
        if (!eventName.trim()) throw new Error('Name the event or project.');
        if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) throw new Error('Enter the deadline as YYYY-MM-DD.');
        await createTeam(supabase, { userId: me.id, category: teamCategory, eventName: eventName.trim(), title, description: body, deadlineOn: deadline || null, roles: roles.split(',').map((r) => r.trim()).filter(Boolean).map((name) => ({ name, filled: false })) });
        await discardDraft();
        router.replace('/teams'); return;
      }
      if (type === 'event') {
        const soc = data?.societies.find((item) => item.id === societyId) ?? data?.societies[0];
        if (!soc) throw new Error('Only verified society accounts can post to the Society board.');
        const startTime = starts.trim() ? new Date(starts.trim().replace(' ', 'T')) : null;
        if (startTime && Number.isNaN(startTime.getTime())) throw new Error('Enter the start as YYYY-MM-DD HH:mm.');
        const posterPath = poster ? await uploadImage(supabase, me.id, await (await fetch(poster.uri)).arrayBuffer(), poster.fileName ?? 'poster.jpg', poster.mimeType ?? 'image/jpeg') : null;
        await createSocietyPost(supabase, { userId: me.id, societyId: soc.id, kind: societyKind, title, body, whenLabel: when || 'soon', whereLabel: where, startsAt: startTime?.toISOString() ?? null, applyUrl, posterPath });
        await discardDraft();
        router.replace('/societies'); return;
      }
      if (!boardId) throw new Error('Pick a board.');
      if (type === 'poll' && opts.filter((option) => option.trim()).length < 2) throw new Error('Add at least two poll options.');
      if (file && !data?.subjects.some((subject) => subject.code.toLowerCase() === fileSubject.trim().toLowerCase())) throw new Error('Choose a valid Library subject code for the attachment.');
      const id = await createThread(supabase, { userId: me.id, boardId, kind: type === 'poll' ? 'poll' : type === 'question' ? 'question' : 'thread', title, body, tags: [...tags, tagDraft.trim().replace(/^#/, '')].filter(Boolean), pollOptions: opts.filter((o) => o.trim()), pollDays, notifyOnReply: notifyReplies });
      if (file) {
        try {
          const bytes = await (await fetch(file.uri)).arrayBuffer();
          const subjectCode = fileSubject.trim().toUpperCase();
          const itemId = await uploadLibraryItem(supabase, { userId: me.id, subjectCode, kind: fileKind, title: file.name.replace(/\.[^.]+$/, ''), file: bytes, fileName: file.name, contentType: file.mimeType ?? 'application/octet-stream', size: file.size ?? bytes.byteLength });
          const { error } = await supabase.from('threads').update({ attachment: { name: file.name, size: `${((file.size ?? bytes.byteLength) / 1048576).toFixed(1)} MB`, subject: subjectCode, library_item_id: itemId } }).eq('id', id);
          if (error) throw error;
        } catch (error) { Alert.alert('Post published', `The attachment could not be added: ${(error as Error).message}`); }
      }
      await discardDraft();
      router.replace(`/thread/${id}`);
    } catch (e) { Alert.alert('Could not post', (e as Error).message); setBusy(false); }
  };

  const input = { fontFamily: fonts.regular, fontSize: 15, color: colors.text, backgroundColor: colors.surface, borderRadius: 2, height: 44, paddingHorizontal: 12 } as const;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 6, paddingRight: 12, paddingBottom: 6 }}>
        <IconBtn name="x" label="Close" onPress={() => router.back()} />
        <T size={17} w={600}>{editing ? 'Suggest an edit' : 'New post'}</T>
        <PrimaryBtn label={editing ? (isMod ? 'Publish' : 'Submit') : 'Post'} height={38} onPress={post} disabled={busy} style={{ marginLeft: 'auto' }} />
      </View>
      <View style={editing ? { display: 'none' } : undefined}>
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
          {editing && (
            <View style={{ marginTop: 14, gap: 10 }}>
              {!isMod && <T size={13.5} lh={1.45} color={colors.accent900} style={{ padding: 12, backgroundColor: colors.accent100 }}>Edits are checked by a moderator before they go live.</T>}
              <TextInput value={summary} onChangeText={setSummary} placeholder="What did you change? e.g. added IT lab tips" placeholderTextColor={colors.neutral700} style={input} />
            </View>
          )}
          {!editing && (type === 'thread' || type === 'question' || type === 'poll') && (
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
          <TextInput editable={!editing} value={title} onChangeText={(v) => setTitle(v.slice(0, 140))} placeholder="A clear, specific title" placeholderTextColor={colors.neutral600} multiline
            style={{ borderBottomWidth: 2, borderBottomColor: colors.text, paddingTop: 18, paddingBottom: 10, marginTop: 6, fontFamily: fonts.semibold, fontSize: 23, lineHeight: 29, color: colors.text }} />
          <T size={12} color={colors.neutral700} align="right" style={{ marginTop: 6 }}>{title.length}/140</T>
          {sim && !editing && (
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
              <T size={12.5} color={colors.neutral700}>Closes in</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>{([[1, '1 day'], [3, '3 days'], [7, '1 week']] as const).map(([days, label]) => <Pill key={days} label={label} active={pollDays === days} onPress={() => setPollDays(days)} />)}</View>
            </View>
          )}
          {type === 'team' && (
            <View style={{ gap: 8, marginTop: 16 }}>
              <TextInput value={eventName} onChangeText={setEventName} placeholder="Event / hackathon" placeholderTextColor={colors.neutral700} style={input} />
              <TextInput value={deadline} onChangeText={setDeadline} placeholder="Applications close (YYYY-MM-DD)" placeholderTextColor={colors.neutral700} style={input} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{[['hackathon', 'Hackathon'], ['project', 'Project'], ['competition', 'Competition'], ['research', 'Research']].map(([key, label]) => <Pill key={key} label={label} active={teamCategory === key} onPress={() => setTeamCategory(key)} />)}</ScrollView>
              <TextInput value={roles} onChangeText={setRoles} placeholder="Open roles, comma separated" placeholderTextColor={colors.neutral700} style={input} />
            </View>
          )}
          {type === 'event' && (
            <View style={{ gap: 8, marginTop: 16 }}>
              {!data?.societies.length && <T size={13.5} color={colors.neutral700}>Only verified society accounts can post here.</T>}
              {!!data?.societies.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{data.societies.map((society) => <Pill key={society.id} label={society.short_name ?? society.name} active={(societyId ?? data.societies[0].id) === society.id} onPress={() => setSocietyId(society.id)} />)}</ScrollView>}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{[['event', 'Event'], ['recruiting', 'Recruiting'], ['workshop', 'Workshop'], ['talk', 'Talk']].map(([key, label]) => <Pill key={key} label={label} active={societyKind === key} onPress={() => setSocietyKind(key)} />)}</ScrollView>
              <TextInput value={when} onChangeText={setWhen} placeholder="When — Fri 23 Oct · 5 pm" placeholderTextColor={colors.neutral700} style={input} />
              <TextInput value={where} onChangeText={setWhere} placeholder="Where — SPS-12" placeholderTextColor={colors.neutral700} style={input} />
              {societyKind !== 'recruiting' && <TextInput value={starts} onChangeText={setStarts} placeholder="Start for reminders: YYYY-MM-DD HH:mm" placeholderTextColor={colors.neutral700} style={input} />}
              {societyKind === 'recruiting' && <TextInput value={applyUrl} onChangeText={setApplyUrl} autoCapitalize="none" keyboardType="url" placeholder="Application link (https://…)" placeholderTextColor={colors.neutral700} style={input} />}
              <Pressable onPress={async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 }); if (!result.canceled) setPoster(result.assets[0] ?? null); }} style={{ minHeight: 44, justifyContent: 'center' }}><T size={14} w={600} color={colors.accent700}>{poster ? `Poster: ${poster.fileName ?? 'selected image'}` : '+ Add poster image'}</T></Pressable>
            </View>
          )}
          {type === 'article' && !editing && <View style={{ marginTop: 16, padding: 14, gap: 10, backgroundColor: colors.accent100 }}>
            <T size={13.5} color={colors.accent900}>Guides are shared and reviewed before publication. Start from a template:</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>{[['Guide', '### What this guide covers\n\n### Step by step\n\n### Common mistakes\n\n'], ['Roadmap', '### Month 1\n\n### Month 2\n\n### Resources\n\n']].map(([label, template]) => <Pill key={label} label={label} onPress={() => setBody(template)} />)}</View>
          </View>}
          {type === 'article' && !editing && <Pressable onPress={async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 }); if (!result.canceled) setCover(result.assets[0] ?? null); }} style={{ minHeight: 44, justifyContent: 'center', marginTop: 8 }}><T size={14} w={600} color={colors.accent700}>{cover ? `Cover: ${cover.fileName ?? 'selected image'}` : '+ Add cover image'}</T></Pressable>}
          <TextInput value={body} onChangeText={setBody} multiline placeholder="Add context. What have you tried? Which professor?" placeholderTextColor={colors.neutral600}
            style={{ marginTop: 16, minHeight: 150, textAlignVertical: 'top', fontFamily: fonts.regular, fontSize: 16, lineHeight: 25, color: colors.text }} />
          {!editing && (type === 'thread' || type === 'question' || type === 'poll') && <View style={{ gap: 8, marginTop: 14 }}>
            <T size={13} w={600}>Tags</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{tags.map((tag) => <Pill key={tag} label={`${tag} ×`} onPress={() => setTags(tags.filter((item) => item !== tag))} />)}</View>
            <TextInput value={tagDraft} onChangeText={setTagDraft} onSubmitEditing={addTag} returnKeyType="done" placeholder="Add a tag" placeholderTextColor={colors.neutral700} style={input} />
          </View>}
          {file && !editing && (type === 'thread' || type === 'question' || type === 'poll') && <View style={{ gap: 8, marginTop: 16, padding: 12, backgroundColor: colors.surface }}>
            <T size={13.5} w={600}>{file.name}</T>
            <TextInput value={fileSubject} onChangeText={setFileSubject} autoCapitalize="characters" placeholder="Library subject code, e.g. CO201" placeholderTextColor={colors.neutral700} style={[input, { backgroundColor: colors.bg }]} />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{([['notes', 'Notes'], ['pyq', 'PYQ'], ['lab', 'Lab'], ['slides', 'Slides']] as const).map(([kind, label]) => <Pill key={kind} label={label} active={fileKind === kind} onPress={() => setFileKind(kind)} />)}</View>
            <Pressable onPress={() => setFile(null)}><T size={13} color={colors.accent2_700}>Remove attachment</T></Pressable>
          </View>}
          {!editing && (type === 'thread' || type === 'question' || type === 'poll') && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: notifyReplies }} onPress={() => setNotifyReplies(!notifyReplies)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, minHeight: 44 }}>
            <View style={{ width: 20, height: 20, borderWidth: 2, borderColor: colors.accent, backgroundColor: notifyReplies ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{notifyReplies && <T size={14} w={600} color={colors.surface}>✓</T>}</View>
            <T size={14}>Notify me about replies</T>
          </Pressable>}
          {!editing && <PrimaryBtn label="Save draft" secondary onPress={save} style={{ marginTop: 20 }} />}
        </ScrollView>
        <View style={{ borderTopWidth: 1, borderTopColor: colors.divider, flexDirection: 'row', alignItems: 'center', paddingTop: 4, paddingHorizontal: 8, paddingBottom: 30 }}>
          <IconBtn name="image" label="Add image" onPress={addImage} />
          {!editing && (type === 'thread' || type === 'question' || type === 'poll') && <IconBtn name="paperclip" label="Attach" onPress={pickFile} />}
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
