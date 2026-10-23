// Bottom sheets for managing posts: an action menu, a text editor, and the
// report form. Native Alert can't hold more than three buttons on Android.

import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { REPORT_REASONS, colors, fonts, reportContent, type ReportReason, type ReportTarget } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useRequireMe } from '@/lib/auth';
import { T } from './T';
import { Icon } from './Icon';
import { PrimaryBtn } from './ui';

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(45,43,43,0.45)' }} onPress={onClose} accessibilityLabel="Close" />
        <View style={{ backgroundColor: colors.bg, paddingTop: 8, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 8, borderTopLeftRadius: 4, borderTopRightRadius: 4 }}>
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.neutral300, marginBottom: 10 }} />
          {title ? <T size={18} w={600} style={{ marginBottom: 8 }}>{title}</T> : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export interface SheetAction { label: string; icon: string; onPress: () => void; danger?: boolean }

export function ActionSheet({ visible, onClose, actions }: { visible: boolean; onClose: () => void; actions: SheetAction[] }) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      {actions.map((a) => (
        <Pressable key={a.label} accessibilityRole="button" onPress={() => { onClose(); a.onPress(); }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, height: 52, opacity: pressed ? 0.6 : 1 })}>
          <Icon name={a.icon} size={22} color={a.danger ? colors.accent2_700 : colors.text} />
          <T size={16} color={a.danger ? colors.accent2_700 : colors.text}>{a.label}</T>
        </Pressable>
      ))}
    </Sheet>
  );
}

/** Edit a body, and optionally a title. */
export function EditSheet({ visible, onClose, heading, title, body, onSave, maxLength = 10000 }: {
  visible: boolean; onClose: () => void; heading: string; title?: string; body: string;
  onSave: (v: { title?: string; body: string }) => Promise<void>; maxLength?: number;
}) {
  const [t, setT] = useState(title);
  const [b, setB] = useState(body);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await onSave({ title: t, body: b }); onClose(); } finally { setBusy(false); }
  };
  const input = { backgroundColor: colors.surface, borderRadius: 2, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 15, color: colors.text };
  return (
    <Sheet visible={visible} onClose={onClose} title={heading}>
      {title !== undefined && (
        <TextInput value={t} onChangeText={setT} maxLength={140} placeholder="Title" placeholderTextColor={colors.neutral700}
          style={[input, { fontFamily: fonts.semibold, fontSize: 17, marginBottom: 10 }]} />
      )}
      <TextInput value={b} onChangeText={setB} maxLength={maxLength} multiline autoFocus={title === undefined} placeholderTextColor={colors.neutral700}
        style={[input, { minHeight: 120, maxHeight: 280, textAlignVertical: 'top' }]} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <PrimaryBtn label="Cancel" secondary onPress={onClose} style={{ flex: 1 }} />
        <PrimaryBtn label="Save" disabled={busy || !b.trim() || (title !== undefined && (t ?? '').trim().length < 3)} onPress={save} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

export function ReportSheet({ target, onClose, onDone }: { target: ReportTarget | null; onClose: () => void; onDone: (msg: string) => void }) {
  const requireMe = useRequireMe();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => { setReason(null); setDetails(''); onClose(); };
  const submit = async () => {
    const me = requireMe(); if (!me || !reason || !target) return;
    setBusy(true);
    try {
      const fresh = await reportContent(supabase, { userId: me.id, target, reason, details });
      close();
      onDone(fresh ? 'Thanks. A moderator will take a look.' : 'You already reported this.');
    } catch (e) { onDone((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={!!target} onClose={close} title="Report this post">
      <T size={13.5} color={colors.neutral700} style={{ marginBottom: 6 }}>Moderators review reports. The author isn&apos;t told who reported them.</T>
      <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
        {REPORT_REASONS.map(([k, label]) => (
          <Pressable key={k} onPress={() => setReason(k)} accessibilityRole="radio" accessibilityState={{ checked: reason === k }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 46 }}>
            <Icon name={reason === k ? 'check-circle' : 'circle-dashed'} size={22} color={reason === k ? colors.accent : colors.neutral700} weight={reason === k ? 'fill' : 'duotone'} />
            <T size={15.5}>{label}</T>
          </Pressable>
        ))}
        <TextInput value={details} onChangeText={setDetails} maxLength={500} multiline placeholder="Anything moderators should know (optional)" placeholderTextColor={colors.neutral700}
          style={{ marginTop: 6, minHeight: 64, backgroundColor: colors.surface, borderRadius: 2, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 15, color: colors.text, textAlignVertical: 'top' }} />
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <PrimaryBtn label="Cancel" secondary onPress={close} style={{ flex: 1 }} />
        <PrimaryBtn label="Report" icon="flag" disabled={!reason || busy} onPress={submit} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}
