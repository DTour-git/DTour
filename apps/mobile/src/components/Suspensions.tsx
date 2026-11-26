import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import {
  SUSPENSION_DAYS,
  agoLong,
  atHandle,
  clock,
  colors,
  fonts,
  liftSuspension,
  shortDate,
  suspendMember,
  suspensionActive,
  type Suspension,
} from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { T } from './T';
import { PrimaryBtn, rowRule } from './ui';

const until = (s: { ends_at: string | null }) => (s.ends_at ? `until ${shortDate(s.ends_at)}, ${clock(s.ends_at, false)}` : 'indefinitely');
const input = {
  height: 40,
  paddingHorizontal: 12,
  backgroundColor: colors.surface,
  borderRadius: 2,
  fontFamily: fonts.regular,
  fontSize: 14,
  color: colors.text,
} as const;

/** Suspend a member from writing (#64). Not in the design; same fields as the campus editor. */
export function SuspendForm({ handle = '', reason = '', onDone }: { handle?: string; reason?: string; onDone: () => void }) {
  const [h, setH] = useState(handle);
  const [why, setWhy] = useState(reason);
  const [days, setDays] = useState<number | null>(7);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await suspendMember(supabase, h, why, days);
      setH(handle);
      setWhy(reason);
      onDone();
    } catch (e) {
      Alert.alert('Could not suspend', (e as Error).message);
    }
    setBusy(false);
  };
  return (
    <View style={{ gap: 8, paddingVertical: 10 }}>
      <TextInput
        value={h}
        onChangeText={setH}
        placeholder="Handle, e.g. aarav.k"
        placeholderTextColor={colors.neutral700}
        autoCapitalize="none"
        accessibilityLabel="Handle"
        style={input}
      />
      <TextInput
        value={why}
        onChangeText={setWhy}
        placeholder="Reason (the member sees this)"
        placeholderTextColor={colors.neutral700}
        maxLength={500}
        accessibilityLabel="Reason"
        style={input}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SUSPENSION_DAYS.map(([d, label]) => (
          <Pressable
            key={label}
            onPress={() => setDays(d)}
            accessibilityRole="radio"
            accessibilityState={{ selected: days === d }}
            style={{
              paddingHorizontal: 12,
              height: 32,
              justifyContent: 'center',
              borderRadius: 16,
              backgroundColor: days === d ? colors.accent : colors.surface,
            }}
          >
            <T size={13.5} w={600} color={days === d ? colors.bg : colors.text}>
              {label}
            </T>
          </Pressable>
        ))}
      </View>
      <PrimaryBtn label="Suspend" disabled={busy || !h.trim() || !why.trim()} onPress={submit} />
    </View>
  );
}

/** The mod screen section: suspend by handle, active suspensions with Lift, and the log. */
export function Suspensions({ items, reload }: { items: Suspension[]; reload: () => void }) {
  const active = items.filter((s) => suspensionActive(s));
  const lift = (s: Suspension) =>
    Alert.alert(`Lift ${atHandle(s.user)}’s suspension?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Lift',
        onPress: () =>
          liftSuspension(supabase, s.id)
            .then(reload)
            .catch((e) => Alert.alert('Could not lift', (e as Error).message)),
      },
    ]);
  return (
    <View style={{ marginTop: 28 }}>
      <T size={18} w={600}>
        Suspensions · {active.length} active
      </T>
      <T size={13} color={colors.neutral700} style={{ marginTop: 4 }}>
        A suspended member can still read, but can’t post, reply, vote, RSVP, use the Lounge, upload or edit their profile. Only admins can
        suspend moderators.
      </T>
      <SuspendForm onDone={reload} />
      {active.map((s) => (
        <View key={s.id} style={[{ paddingVertical: 12, gap: 4 }, rowRule]}>
          <T size={15} w={600}>
            {atHandle(s.user)}
          </T>
          <T size={13.5} color={colors.neutral800}>
            {until(s)} · {s.reason}
          </T>
          <PrimaryBtn label="Lift" secondary height={36} style={{ alignSelf: 'flex-start', marginTop: 4 }} onPress={() => lift(s)} />
        </View>
      ))}
      {items.length > 0 && (
        <T size={15} w={600} style={{ marginTop: 18 }}>
          Log
        </T>
      )}
      {items.map((s) => (
        <View key={s.id} style={[{ paddingVertical: 8 }, rowRule]}>
          <T size={13.5} color={colors.neutral800}>
            {s.by ? atHandle(s.by) : 'A moderator'} suspended {atHandle(s.user)} {until(s)} · {agoLong(s.created_at)} · “{s.reason}”
            {s.lifted_at ? ` · lifted by ${s.lifter ? atHandle(s.lifter) : 'a moderator'} ${agoLong(s.lifted_at)}` : ''}
          </T>
        </View>
      ))}
    </View>
  );
}
