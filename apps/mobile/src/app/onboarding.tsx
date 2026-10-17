import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { colors, flair, fonts, getBranches, handleAvailable, updateProfile } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useAuth, useMe } from '@/lib/auth';
import { useData } from '@/lib/useData';
import { T } from '@/components/T';
import { Avatar, LogoMark, Pill, PrimaryBtn, Screen, Tag } from '@/components/ui';

const HANDLE = /^[a-z0-9][a-z0-9._]{2,23}$/;

export default function Onboarding() {
  const me = useMe()!; // onboarding is only reachable while signed in
  const { refreshProfile } = useAuth();
  const { data: branches } = useData(() => getBranches(supabase));
  const [handle, setHandle] = useState(me.handle);
  const [branch, setBranch] = useState(me.branch_code ?? '');
  const [grad, setGrad] = useState(me.grad_year ?? 0);
  const [sem, setSem] = useState(me.semester ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const year = new Date().getFullYear();

  const save = async () => {
    const h = handle.trim().toLowerCase();
    if (!HANDLE.test(h)) return setError('Handles are 3–24 characters: lowercase letters, numbers, dots and underscores.');
    setBusy(true); setError(null);
    try {
      if (!(await handleAvailable(supabase, h, me.id))) throw new Error(`@${h} is taken — try another.`);
      await updateProfile(supabase, me.id, { handle: h, branch_code: branch || null, grad_year: grad || null, semester: sem || null, onboarded: true });
      await refreshProfile();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><LogoMark size={24} /><T size={27} w={600} ls={-0.03}>DTour</T></View>
        <T size={34} w={600} ls={-0.025} style={{ marginTop: 26 }}>Welcome to campus.</T>
        <T size={16.5} i lh={1.45} color={colors.neutral800} style={{ marginTop: 8, marginBottom: 24 }}>Pick a handle — your branch and batch show as a flair on everything you post.</T>
        <T size={11} w={600} ls={0.12} caps color={colors.neutral700}>Handle</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 2, borderBottomColor: colors.text, paddingBottom: 6, marginTop: 8 }}>
          <T size={24} w={600} color={colors.neutral600}>@</T>
          <TextInput value={handle} onChangeText={(v) => setHandle(v.toLowerCase())} autoCapitalize="none" autoCorrect={false} maxLength={24}
            style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 24, color: colors.text, paddingVertical: 4 }} />
        </View>
        <T size={11} w={600} ls={0.12} caps color={colors.neutral700} style={{ marginTop: 24, marginBottom: 8 }}>Branch</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {branches?.filter((b) => b.code !== 'FY').map((b) => <Pill key={b.code} label={b.code} active={branch === b.code} onPress={() => setBranch(b.code)} />)}
        </View>
        <T size={11} w={600} ls={0.12} caps color={colors.neutral700} style={{ marginTop: 20, marginBottom: 8 }}>Graduating</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Array.from({ length: 6 }, (_, i) => year - 1 + i).map((y) => <Pill key={y} label={String(y)} active={grad === y} onPress={() => setGrad(y)} />)}
        </View>
        <T size={11} w={600} ls={0.12} caps color={colors.neutral700} style={{ marginTop: 20, marginBottom: 8 }}>Semester</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <Pill key={s} label={`Sem ${s}`} active={sem === s} onPress={() => setSem(s)} />)}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 26, padding: 14, backgroundColor: colors.surface, borderRadius: 2 }}>
          <Avatar person={{ handle: handle || 'you', tint: me.tint }} size={34} />
          <T size={16} w={600}>@{handle || 'you'}</T>
          {flair(branch, grad) && <Tag>{flair(branch, grad)!}</Tag>}
        </View>
        {error && <T size={14} color={colors.accent2_800} style={{ marginTop: 14, padding: 12, backgroundColor: colors.accent2_100 }}>{error}</T>}
        <PrimaryBtn label="Enter DTour" height={48} onPress={save} disabled={busy} style={{ marginTop: 22 }} />
      </ScrollView>
    </Screen>
  );
}
