import { useState } from 'react';
import { Alert, Pressable, Switch, TextInput, View } from 'react-native';
import {
  addSocietyMember,
  colors,
  fonts,
  getMySocieties,
  removeSocietyMember,
  updateSocietyMember,
  type MySociety,
  type SocietyMember,
} from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useRequireMe } from '@/lib/auth';
import { useData } from '@/lib/useData';
import { T } from './T';
import { Avatar, PrimaryBtn, Seal, rowRule } from './ui';

const input = {
  height: 40,
  paddingHorizontal: 12,
  backgroundColor: colors.bg,
  borderRadius: 2,
  fontFamily: fonts.regular,
  fontSize: 14,
  color: colors.text,
} as const;

/** Societies I belong to (#62): anyone can leave; leads manage members. Not in the design; same surface box as the profile. */
export function MySocieties({ myId }: { myId: string }) {
  const { data, reload } = useData(() => getMySocieties(supabase, myId), [myId]);
  const requireMe = useRequireMe();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data?.length) return null;

  // purpose 'own': leaving is housekeeping a suspension still allows (#64).
  const act = async (fn: () => Promise<void>, purpose?: 'own') => {
    if (!requireMe(purpose)) return false;
    setBusy(true);
    try {
      await fn();
      await reload();
      return true;
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const leave = (m: MySociety) =>
    Alert.alert(`Leave ${m.society.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => act(() => removeSocietyMember(supabase, m.society.id, myId), 'own') },
    ]);

  return (
    <View style={{ marginTop: 16, padding: 14, backgroundColor: colors.surface, borderRadius: 2 }}>
      <T size={14} w={600}>
        Your societies
      </T>
      {data.map((m) => (
        <View key={m.society.id} style={[{ paddingVertical: 10 }, rowRule]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T size={16} w={600} style={{ flexShrink: 1 }} numberOfLines={1}>
              {m.society.name}
            </T>
            {m.society.verified && <Seal />}
          </View>
          <T size={12.5} color={colors.neutral700}>
            {m.role}
            {m.is_lead ? ' · lead' : ''}
            {m.can_post ? ' · can post' : ''}
          </T>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {m.is_lead && (
              <PrimaryBtn
                label={open === m.society.id ? 'Done' : 'Manage'}
                secondary
                height={36}
                onPress={() => setOpen(open === m.society.id ? null : m.society.id)}
              />
            )}
            <PrimaryBtn label="Leave" secondary height={36} disabled={busy} onPress={() => leave(m)} />
          </View>
          {m.is_lead && open === m.society.id && <Manage society={m} myId={myId} act={act} busy={busy} />}
        </View>
      ))}
    </View>
  );
}

type Act = (fn: () => Promise<void>) => Promise<boolean>;

function Manage({ society, myId, act, busy }: { society: MySociety; myId: string; act: Act; busy: boolean }) {
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('');
  const id = society.society.id;
  return (
    <View style={{ marginTop: 8 }}>
      {society.members.map((mem) => (
        <MemberRow key={mem.user_id} societyId={id} member={mem} me={mem.user_id === myId} act={act} busy={busy} />
      ))}
      <View style={{ gap: 8, marginTop: 10 }}>
        <TextInput
          value={handle}
          onChangeText={setHandle}
          placeholder="Handle, e.g. aarav.k"
          placeholderTextColor={colors.neutral700}
          autoCapitalize="none"
          accessibilityLabel="Handle"
          style={input}
        />
        <TextInput
          value={role}
          onChangeText={setRole}
          placeholder="Role (Member)"
          placeholderTextColor={colors.neutral700}
          maxLength={40}
          accessibilityLabel="Role"
          style={input}
        />
        <PrimaryBtn
          label="Add member"
          disabled={busy || !handle.trim()}
          onPress={async () => {
            if (await act(() => addSocietyMember(supabase, id, handle, role))) {
              setHandle('');
              setRole('');
            }
          }}
        />
      </View>
    </View>
  );
}

function MemberRow({
  societyId,
  member,
  me,
  act,
  busy,
}: {
  societyId: string;
  member: SocietyMember;
  me: boolean;
  act: Act;
  busy: boolean;
}) {
  const [role, setRole] = useState(member.role);
  const handle = `@${member.person.handle}`;
  const set = async (patch: Parameters<typeof updateSocietyMember>[3]) => {
    await act(() => updateSocietyMember(supabase, societyId, member.user_id, patch));
  };
  return (
    <View style={[{ paddingVertical: 10, gap: 8 }, rowRule]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar person={member.person} size={28} />
        <T size={14.5} w={600} style={{ flex: 1 }} numberOfLines={1}>
          {handle}
        </T>
        {!me && (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() =>
              Alert.alert(`Remove ${handle}?`, undefined, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => act(() => removeSocietyMember(supabase, societyId, member.user_id)),
                },
              ])
            }
          >
            <T size={13.5} color={colors.accent}>
              Remove
            </T>
          </Pressable>
        )}
      </View>
      <TextInput
        value={role}
        onChangeText={setRole}
        onEndEditing={() => role.trim() !== member.role && set({ role: role.trim() })}
        maxLength={40}
        accessibilityLabel={`Role of ${handle}`}
        style={input}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Switch
            value={member.can_post}
            disabled={busy}
            onValueChange={(on) => set({ can_post: on })}
            trackColor={{ true: colors.accent }}
            accessibilityLabel={`${handle} can post`}
          />
          <T size={13.5}>Can post</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Switch
            value={member.is_lead}
            disabled={busy}
            onValueChange={(on) => set({ is_lead: on })}
            trackColor={{ true: colors.accent }}
            accessibilityLabel={`${handle} is a lead`}
          />
          <T size={13.5}>Lead</T>
        </View>
      </View>
    </View>
  );
}
