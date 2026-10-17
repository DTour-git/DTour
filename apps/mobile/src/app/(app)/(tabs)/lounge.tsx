import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatTime, colors, fonts, getLoungeMessage, getLoungeMessages, getLoungeRooms, sendLoungeMessage, unreadCounts, type LoungeMessage } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useMe } from '@/lib/auth';
import { useData } from '@/lib/useData';
import { usePresence } from '@/lib/presence';
import { T } from '@/components/T';
import { Icon } from '@/components/Icon';
import { Avatar, FlairTag, IconBtn, Screen, Seal, Tag } from '@/components/ui';

const SEEN_KEY = 'dtour_lounge_seen';

export default function Lounge() {
  const router = useRouter();
  const me = useMe();
  const { online } = usePresence();
  const { data: rooms } = useData(() => getLoungeRooms(supabase));
  const [room, setRoom] = useState('global');
  const [msgs, setMsgs] = useState<LoungeMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [unread, setUnread] = useState<Record<string, number>>({});
  const list = useRef<FlatList<LoungeMessage>>(null);
  const current = rooms?.find((r) => r.slug === room);

  // Messages + realtime inserts for the open room (optimistic sends reconcile on arrival).
  useEffect(() => {
    let alive = true;
    getLoungeMessages(supabase, room).then((m) => alive && setMsgs(m));
    const ch = supabase.channel(`lounge:${room}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lounge_messages', filter: `room_slug=eq.${room}` }, async (p) => {
        const full = await getLoungeMessage(supabase, (p.new as { id: number }).id);
        setMsgs((cur) => cur.some((m) => m.id === full.id) ? cur : [...cur.filter((m) => !(m.pending && m.body === full.body && m.author.id === full.author.id)), full]);
      }).subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [room]);

  // Unread counts per room since you last opened it.
  useEffect(() => {
    if (!rooms) return;
    (async () => {
      const seen = JSON.parse((await AsyncStorage.getItem(SEEN_KEY)) ?? '{}') as Record<string, string>;
      seen[room] = new Date().toISOString();
      await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(seen));
      const since = Object.fromEntries(rooms.filter((r) => r.slug !== room).map((r) => [r.slug, seen[r.slug] ?? new Date(Date.now() - 864e5).toISOString()]));
      setUnread(await unreadCounts(supabase, since));
    })();
  }, [room, rooms]);

  const send = async () => {
    const body = draft.trim(); if (!body) return;
    setDraft('');
    const temp: LoungeMessage = { id: -Date.now(), room_slug: room, body, created_at: new Date().toISOString(), promoted_thread_id: null, pending: true,
      author: { id: me.id, handle: me.handle, display_name: me.display_name, branch_code: me.branch_code, grad_year: me.grad_year, tint: me.tint as never, karma: me.karma }, society: null };
    setMsgs((m) => [...m, temp]);
    try { await sendLoungeMessage(supabase, room, me.id, body); } catch { setMsgs((m) => m.filter((x) => x.id !== temp.id)); setDraft(body); }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 20, paddingRight: 8 }}>
        <T size={28} w={600}>Lounge</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent }} /><T size={12.5} color={colors.neutral700}>{online.length} here</T>
        </View>
        <View style={{ marginLeft: 'auto' }}><IconBtn name="users-three" label="Who's here" onPress={() => router.navigate('/boards')} /></View>
      </View>
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingHorizontal: 20, paddingTop: 6 }}>
          {rooms?.map((r) => (
            <Pressable key={r.slug} onPress={() => setRoom(r.slug)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: r.slug === room ? colors.accent : 'transparent', minHeight: 36 }}>
              <T size={14.5} w={600} color={r.slug === room ? colors.accent700 : colors.neutral700}>{r.label}</T>
              {r.slug !== room && unread[r.slug] ? <Tag tone="accent2">{String(unread[r.slug])}</Tag> : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {current?.pinned_text && (
        <Pressable onPress={() => current.pinned_thread_id && router.push(`/thread/${current.pinned_thread_id}`)}
          style={{ marginTop: 12, marginHorizontal: 20, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.accent100, borderRadius: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="push-pin" size={16} color={colors.accent700} />
          <T size={13} color={colors.accent900} style={{ flex: 1 }}><T size={13} w={600} color={colors.accent900}>Pinned:</T> {current.pinned_text}</T>
        </Pressable>
      )}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList ref={list} data={msgs} keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, gap: 16 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: m }) => (
            <View style={{ flexDirection: 'row', gap: 10, opacity: m.pending ? 0.6 : 1 }}>
              <Avatar person={m.author} society={null} size={32} label={m.society ? m.society.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : undefined} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  <T size={12.5} w={600}>{m.society?.name ?? m.author.handle}</T>
                  {m.society?.verified ? <Seal /> : <FlairTag person={m.author} />}
                  <T size={12.5} color={colors.neutral700}>{chatTime(m.created_at)}</T>
                </View>
                <T size={15} lh={1.45}>{m.body}</T>
                {m.promoted && (
                  <Pressable onPress={() => router.push(`/thread/${m.promoted!.id}`)} style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.surface, borderRadius: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="arrow-bend-down-right" size={17} color={colors.accent} />
                    <T size={13} style={{ flex: 1 }}>Became a thread · {m.promoted.reply_count} replies</T>
                    <T size={13} w={600} color={colors.accent700}>Open</T>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
          <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={send} returnKeyType="send" placeholder={room === 'global' ? 'Message all of DTU' : `Message ${current?.label ?? ''}`}
            placeholderTextColor={colors.neutral700} maxLength={1000}
            style={{ flex: 1, height: 44, paddingHorizontal: 14, backgroundColor: colors.surface, borderRadius: 2, fontFamily: fonts.regular, fontSize: 15, color: colors.text }} />
          <Pressable onPress={send} accessibilityLabel="Send" style={{ width: 44, height: 44, borderRadius: 2, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="paper-plane-tilt" size={20} color={colors.bg} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
