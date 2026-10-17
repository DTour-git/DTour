import { useState } from 'react';
import { Alert, Modal, Pressable, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors, fonts, uploadLibraryItem } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useRequireMe } from '@/lib/auth';
import { T } from './T';
import { Icon } from './Icon';
import { Pill, PrimaryBtn } from './ui';

const KINDS = [['notes', 'Notes'], ['pyq', 'PYQ'], ['lab', 'Lab'], ['slides', 'Slides']] as const;

/** Document picker → asks for type (Notes / PYQ / Lab) + subject → uploads to the Library. */
export function UploadSheet({ subjects, defaultSubject, onClose, onDone }: { subjects: { code: string; name: string }[]; defaultSubject?: string; onClose: () => void; onDone: () => void }) {
  const requireMe = useRequireMe();
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>('notes');
  const [subject, setSubject] = useState(defaultSubject ?? subjects[0]?.code ?? '');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/zip', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'image/*'], copyToCacheDirectory: true });
    if (!r.canceled && r.assets[0]) { setFile(r.assets[0]); if (!title) setTitle(r.assets[0].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')); }
  };
  const upload = async () => {
    const me = requireMe(); if (!me) return;
    if (!file || !subject || !title.trim()) return Alert.alert('Pick a file, subject and title.');
    setBusy(true);
    try {
      const body = await (await fetch(file.uri)).arrayBuffer();
      await uploadLibraryItem(supabase, { userId: me.id, subjectCode: subject, kind, title: title.trim(), file: body, fileName: file.name, contentType: file.mimeType ?? 'application/octet-stream', size: file.size ?? body.byteLength });
      onDone(); onClose();
    } catch (e) { Alert.alert('Upload failed', (e as Error).message); setBusy(false); }
  };

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20, gap: 16 }}>
        <T size={23} w={600}>Upload to the Library</T>
        <Pressable onPress={pick} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.neutral400, borderRadius: 2 }}>
          <Icon name="upload-simple" size={20} color={colors.accent} />
          <T size={14} color={colors.neutral700} style={{ flex: 1 }}>{file ? `${file.name}` : 'Choose a PDF, PPT, ZIP or image'}</T>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{KINDS.map(([k, l]) => <Pill key={k} label={l} active={kind === k} onPress={() => setKind(k)} />)}</View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{subjects.map((s) => <Pill key={s.code} label={s.code} active={subject === s.code} onPress={() => setSubject(s.code)} />)}</View>
        <TextInput value={title} onChangeText={setTitle} placeholder="Title — e.g. Unit 4 notes, handwritten" placeholderTextColor={colors.neutral700}
          style={{ height: 44, paddingHorizontal: 12, backgroundColor: colors.surface, borderRadius: 2, fontFamily: fonts.regular, fontSize: 15, color: colors.text }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PrimaryBtn label="Cancel" secondary onPress={onClose} style={{ flex: 1 }} />
          <PrimaryBtn label={busy ? 'Uploading…' : 'Upload'} onPress={upload} disabled={busy} style={{ flex: 1 }} />
        </View>
      </View>
    </Modal>
  );
}
