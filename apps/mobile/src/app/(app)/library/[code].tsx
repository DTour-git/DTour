import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, compact, daysUntil, downloadItem, fileSize, getSubject, n } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/useData';
import { useRequireMe } from '@/lib/auth';
import { T } from '@/components/T';
import { Icon } from '@/components/Icon';
import { UploadSheet } from '@/components/Upload';
import { AppBar, IconBtn, Pill, PillRow, Screen, Tag, rowRule } from '@/components/ui';

const FILTERS = ['All', 'PYQs', 'Notes', 'Lab files', 'Threads'] as const;
const ICON: Record<string, [string, string]> = { pyq: ['file-pdf', colors.accent2], notes: ['file-text', colors.accent], slides: ['presentation', colors.accent], lab: ['file-code', colors.neutral700] };

export default function SubjectFiles() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [f, setF] = useState<(typeof FILTERS)[number]>('All');
  const [uploading, setUploading] = useState(false);
  const requireMe = useRequireMe();
  const { data, reload } = useData(() => getSubject(supabase, code), [code]);
  if (!data) return <Screen><AppBar /></Screen>;
  const s = data.subject;
  const d = s.exam_on ? daysUntil(s.exam_on) : null;
  const show = { pyq: f === 'All' || f === 'PYQs', notes: f === 'All' || f === 'Notes', lab: f === 'All' || f === 'Lab files', threads: f === 'All' || f === 'Threads' };

  const download = async (id: number) => {
    if (!requireMe()) return;
    try {
      const url = await downloadItem(supabase, id);
      if (url) Linking.openURL(url); else Alert.alert('Demo file', 'Real uploads open in your PDF viewer here.');
      reload();
    } catch (e) { Alert.alert('Download failed', (e as Error).message); }
  };
  const section = (title: string, count: string, items: typeof data.items) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 20 }}>
        <T size={18} w={600}>{title}</T><T size={12.5} color={colors.neutral700}>{count}</T>
      </View>
      {items.map((it) => {
        const [ic, col] = ICON[it.kind] ?? ICON.notes;
        return (
          <View key={it.id} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, rowRule]}>
            <View style={{ width: 42, height: 48, borderRadius: 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={24} color={col} /></View>
            <View style={{ flex: 1 }}>
              <T size={15.5} w={600} lh={1.3}>{it.title}</T>
              <T size={12} color={colors.neutral700} style={{ marginTop: 2 }}>{[it.format, fileSize(it.size_bytes), it.uploader && `@${it.uploader.handle}`].filter(Boolean).join(' · ')}</T>
              {it.top_rated && <View style={{ marginTop: 4 }}><Tag tone="accent" size={10.5}>Top rated</Tag></View>}
            </View>
            <Pressable onPress={() => download(it.id)} accessibilityLabel={`Download ${it.title}`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="download-simple" size={20} color={colors.accent} /><T size={10.5} color={colors.neutral700}>{compact(it.downloads)}</T>
            </Pressable>
          </View>
        );
      })}
    </View>
  );

  return (
    <Screen>
      <AppBar title={`${s.code} · ${s.name}`} subtitle={`${s.branch_code} › Sem ${s.semester}`} right={<IconBtn name="bookmark-simple" label="Save" />} />
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={{ paddingHorizontal: 20 }}>
          <T size={28} w={600} lh={1.1} style={{ marginTop: 6 }}>{s.name}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {d != null && d >= 0 && <Tag tone="accent2">End-sem in {d} days</Tag>}
            <T size={13} color={colors.neutral700}>{[s.professor, s.credits && `${s.credits} credits`].filter(Boolean).join(' · ')}</T>
          </View>
        </View>
        <PillRow style={{ paddingTop: 16 }}>{FILTERS.map((x) => <Pill key={x} label={x} active={f === x} onPress={() => setF(x)} />)}</PillRow>
        <View style={{ paddingHorizontal: 20 }}>
          {show.pyq && section('PYQs', `${s.pyq_count} papers`, data.items.filter((i) => i.kind === 'pyq'))}
          {show.notes && section('Notes', `${s.notes_count} files`, data.items.filter((i) => i.kind === 'notes' || i.kind === 'slides'))}
          {show.lab && section('Lab files', `${s.lab_count} files`, data.items.filter((i) => i.kind === 'lab'))}
          {show.threads && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 20 }}>
                <T size={18} w={600}>Discussions</T><T size={12.5} color={colors.neutral700}>{data.threads.length} active</T>
              </View>
              {data.threads.map((t) => (
                <Pressable key={t.id} onPress={() => router.push(`/thread/${t.id}`)} style={[{ paddingVertical: 12 }, rowRule]}>
                  <T size={15.5} w={600} lh={1.3}>{t.title}</T>
                  <T size={12} color={colors.neutral700} style={{ marginTop: 2 }}>{n(t.score)} votes · {n(t.reply_count)} replies</T>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <Pressable onPress={() => requireMe() && setUploading(true)} style={{ position: 'absolute', right: 20, bottom: 40, height: 48, paddingHorizontal: 18, borderRadius: 2, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#2d2b2b', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 }}>
        <Icon name="upload-simple" size={18} color={colors.bg} /><T size={14} w={600} color={colors.bg}>Upload</T>
      </Pressable>
      {uploading && <UploadSheet subjects={[{ code: s.code, name: s.name }]} defaultSubject={s.code} onClose={() => setUploading(false)} onDone={reload} />}
    </Screen>
  );
}
