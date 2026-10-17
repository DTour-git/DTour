import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, TextInput, View, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { agoLong, colors, fonts, getDrafts, getProfile, getSaved, n, updateProfile, yearLabel, flair } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/useData';
import { appRoute } from '@/lib/routes';
import { registerPush, unregisterPush } from '@/lib/push';
import { T, Kicker } from './T';
import { Icon } from './Icon';
import { AppBar, Avatar, CmykNum, IconBtn, PrimaryBtn, Screen, Tag, rowRule } from './ui';

const ACT_ICON: Record<string, string> = { accepted: 'check-circle', upload: 'file-pdf', thread: 'chat-circle', wiki_edit: 'pencil-simple-line', team: 'users-three', reply: 'chat-circle' };
const ACT_SHORT: Record<string, string> = { accepted: 'Accepted answer', upload: 'Uploaded', wiki_edit: 'Edited wiki', team: 'Joined team' };

export function ProfileView({ handle, isTab }: { handle: string; isTab?: boolean }) {
  const router = useRouter();
  const { profile: me, refreshProfile } = useAuth();
  const { data, refreshing, refresh, reload } = useData(async () => {
    const p = await getProfile(supabase, handle);
    const mine = p && me?.id === p.profile.id;
    const [saved, drafts] = mine ? await Promise.all([getSaved(supabase, p.profile.id), getDrafts(supabase)]) : [[], []];
    return p && { ...p, saved, drafts };
  }, [handle]);
  const [tab, setTab] = useState<'activity' | 'threads' | 'saved' | 'library' | 'drafts'>('activity');
  const [editing, setEditing] = useState(false);
  if (!data) return <Screen>{!isTab && <AppBar />}</Screen>;
  const p = data.profile;
  const mine = me?.id === p.id;
  const f = flair(p.branch_code, p.grad_year);
  const yl = yearLabel(p.semester);

  const settings = () => Alert.alert('Settings', 'Signed in with your DTU account.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Enable phone alerts', onPress: async () => {
      try {
        if (!me) return;
        const enabled = await registerPush(me.id, true);
        Alert.alert(enabled ? 'Phone alerts enabled' : 'Permission not granted', enabled ? 'You will receive DTour updates on this device.' : 'You can allow notifications in your phone settings.');
      } catch (error) { Alert.alert('Could not enable alerts', (error as Error).message); }
    } },
    { text: 'Sign out', style: 'destructive', onPress: async () => { await unregisterPush(); await supabase.auth.signOut(); } },
  ]);

  return (
    <Screen>
      {isTab ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8 }}>
          <T size={17} w={600}>@{p.handle}</T>
          <View style={{ marginLeft: 'auto', flexDirection: 'row' }}>
            <IconBtn name="pencil-simple-line" label="Edit profile" onPress={() => setEditing(true)} />
            <IconBtn name="gear-six" label="Settings" onPress={settings} />
          </View>
        </View>
      ) : <AppBar title={`@${p.handle}`} right={mine ? <IconBtn name="pencil-simple-line" onPress={() => setEditing(true)} /> : undefined} />}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 }}>
          <Avatar person={p} size={76} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>{f && <Tag>{f}</Tag>}{yl && <Tag tone="accent">{yl}</Tag>}</View>
            {p.bio ? <T size={14.5} i lh={1.4} color={colors.neutral800} style={{ marginTop: 8 }}>{p.bio}</T> : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 22 }}>
          <CmykNum size={52} tracking={-0.03}>{n(p.karma)}</CmykNum>
          <T size={12.5} color={colors.neutral700} lh={1.3} style={{ paddingBottom: 4 }}>karma{'\n'}<T size={12.5} w={600} color={colors.accent700}>{data.karmaWeek >= 0 ? '+' : ''}{data.karmaWeek} this week</T></T>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 18 }}>
          {([[p.thread_count, 'threads'], [p.reply_count, 'replies'], [p.accepted_count, 'accepted'], [p.upload_count, 'uploads']] as const).map(([v, l]) => (
            <View key={l} style={{ flex: 1 }}><T size={21} w={600}>{n(v)}</T><T size={12} color={colors.neutral700}>{l}</T></View>
          ))}
        </View>
        <Pressable onPress={async () => { if (mine) { await updateProfile(supabase, p.id, { open_to_teams: !p.open_to_teams }); reload(); refreshProfile(); } else router.push('/teams'); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, padding: 12, paddingHorizontal: 14, backgroundColor: colors.surface, borderRadius: 2 }}>
          <Icon name="hand-waving" size={20} color={colors.accent} />
          <T size={14} style={{ flex: 1 }} numberOfLines={1}><T size={14} w={600}>Open to teams</T>{p.skills.length ? ` · ${p.skills.slice(0, 3).join(', ')}` : ''}</T>
          <Tag tone={p.open_to_teams ? 'accent' : 'neutral'}>{p.open_to_teams ? 'On' : 'Off'}</Tag>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 20, marginTop: 22, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
          {(['activity', 'threads', ...(mine ? ['saved', 'drafts'] : []), 'library'] as const).map((k) => (
            <Pressable key={k} onPress={() => setTab(k as typeof tab)} style={{ paddingBottom: 8, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: tab === k ? colors.accent : 'transparent', minHeight: 32 }}>
              <T size={14.5} w={600} color={tab === k ? colors.text : colors.neutral700}>{k[0].toUpperCase() + k.slice(1)}</T>
            </Pressable>
          ))}
        </ScrollView>
        {tab === 'activity' && data.activities.map((a) => (
          <Pressable key={a.id} onPress={() => router.push(appRoute(a.route))} style={[{ flexDirection: 'row', gap: 12, paddingVertical: 14 }, rowRule]}>
            <Icon name={ACT_ICON[a.kind] ?? 'chat-circle'} size={20} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Kicker color={colors.neutral700}>{a.kind === 'thread' ? a.kicker : a.kind === 'upload' ? a.kicker.replace('Uploaded to Library', 'Uploaded') : ACT_SHORT[a.kind] ?? a.kicker}</Kicker>
              <T size={16} w={600} lh={1.3} style={{ marginTop: 3 }}>{a.title}</T>
              <T size={12.5} color={colors.neutral700} style={{ marginTop: 2 }}>{agoLong(a.created_at)}{a.meta ? ` · ${a.meta}` : ''}</T>
            </View>
          </Pressable>
        ))}
        {(tab === 'threads' ? data.threads : tab === 'saved' ? data.saved : []).map((t) => (
          <Pressable key={t.id} onPress={() => router.push(`/thread/${t.id}`)} style={[{ paddingVertical: 14 }, rowRule]}>
            <T size={16} w={600} lh={1.3}>{t.title}</T>
            <T size={12.5} color={colors.neutral700} style={{ marginTop: 3 }}>{n(t.score)} votes · {n(t.reply_count)} replies · {agoLong(t.created_at)}</T>
          </Pressable>
        ))}
        {tab === 'library' && data.uploads.map((u) => (
          <Pressable key={u.id} onPress={() => router.push(`/library/${u.subject_code}`)} style={[{ flexDirection: 'row', gap: 12, paddingVertical: 14 }, rowRule]}>
            <Icon name={u.kind === 'pyq' ? 'file-pdf' : 'file-text'} size={20} color={colors.accent} />
            <View style={{ flex: 1 }}><T size={16} w={600} lh={1.3}>{u.title}</T><T size={12.5} color={colors.neutral700}>{u.subject_code} · {n(u.downloads)} downloads</T></View>
          </Pressable>
        ))}
        {tab === 'drafts' && data.drafts.map((draft) => (
          <Pressable key={draft.id} onPress={() => router.push({ pathname: '/new', params: { draft: draft.id } })} style={[{ paddingVertical: 14 }, rowRule]}>
            <T size={16} w={600}>{draft.title || 'Untitled draft'}</T>
            <T size={12.5} color={colors.neutral700}>{draft.kind} · saved {agoLong(draft.updated_at)}</T>
          </Pressable>
        ))}
      </ScrollView>
      {editing && <EditProfile profile={p} onClose={() => { setEditing(false); reload(); refreshProfile(); }} />}
    </Screen>
  );
}

function EditProfile({ profile, onClose }: { profile: { id: string; bio: string | null; hostel: string | null; skills: string[]; semester: number | null }; onClose: () => void }) {
  const [bio, setBio] = useState(profile.bio ?? '');
  const [hostel, setHostel] = useState(profile.hostel ?? '');
  const [skills, setSkills] = useState(profile.skills.join(', '));
  const [sem, setSem] = useState(String(profile.semester ?? ''));
  const save = async () => {
    await updateProfile(supabase, profile.id, { bio: bio || null, hostel: hostel || null, skills: skills.split(',').map((s) => s.trim()).filter(Boolean), semester: Number(sem) || null });
    onClose();
  };
  const input = { height: 44, paddingHorizontal: 12, backgroundColor: colors.surface, borderRadius: 2, fontFamily: fonts.regular, fontSize: 15, color: colors.text } as const;
  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20, gap: 12 }}>
        <T size={23} w={600}>Edit profile</T>
        <TextInput style={[input, { height: 80, paddingTop: 12 }]} multiline value={bio} onChangeText={setBio} placeholder="Bio" placeholderTextColor={colors.neutral700} />
        <TextInput style={input} value={hostel} onChangeText={setHostel} placeholder="Hostel" placeholderTextColor={colors.neutral700} />
        <TextInput style={input} value={skills} onChangeText={setSkills} placeholder="Skills, comma separated" placeholderTextColor={colors.neutral700} />
        <TextInput style={input} value={sem} onChangeText={setSem} keyboardType="number-pad" placeholder="Semester (1–8)" placeholderTextColor={colors.neutral700} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <PrimaryBtn label="Cancel" secondary onPress={onClose} style={{ flex: 1 }} />
          <PrimaryBtn label="Save" onPress={save} style={{ flex: 1 }} />
        </View>
      </View>
    </Modal>
  );
}
