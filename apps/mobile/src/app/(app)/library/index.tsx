import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, daysUntil, getLibrary, n } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useMe, useRequireMe } from '@/lib/auth';
import { useData } from '@/lib/useData';
import { T } from '@/components/T';
import { Icon } from '@/components/Icon';
import { UploadSheet } from '@/components/Upload';
import { AppBar, IconBtn, Pill, PillRow, Screen, Tag, rowRule } from '@/components/ui';

export default function Library() {
  const router = useRouter();
  const me = useMe();
  const requireMe = useRequireMe();
  const branch = me?.branch_code ?? 'COE';
  const [sem, setSem] = useState(me?.semester ?? 1);
  const [uploading, setUploading] = useState(false);
  const { data, refreshing, refresh, reload } = useData(() => getLibrary(supabase, branch, sem), [branch, sem]);
  const b = data?.branches.find((x) => x.code === branch);
  const top = data?.top[0];
  return (
    <Screen>
      <AppBar title="Library" subtitle={b?.full_name ?? branch} right={<IconBtn name="upload-simple" color={colors.accent} label="Upload" onPress={() => requireMe() && setUploading(true)} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}>
        <View style={{ paddingHorizontal: 20 }}>
          <T size={30} w={600} style={{ marginTop: 6, marginBottom: 4 }}>Semester {sem}</T>
          <T size={13.5} color={colors.neutral700}>{data ? `${n(data.totals.notes)} notes · ${n(data.totals.pyqs)} PYQs · ${n(data.totals.labs)} lab files` : ' '}</T>
          <Pressable onPress={() => router.push({ pathname: '/search', params: { q: 'lib:' } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, marginTop: 14, paddingHorizontal: 14, backgroundColor: colors.surface, borderRadius: 2 }}>
            <Icon name="magnifying-glass" size={18} color={colors.neutral700} /><T size={14.5} color={colors.neutral700}>Search subjects, CO201…</T>
          </Pressable>
        </View>
        <PillRow style={{ paddingTop: 14, paddingBottom: 6 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <Pill key={s} label={`Sem ${s}`} active={s === sem} onPress={() => setSem(s)} />)}
        </PillRow>
        <View style={{ paddingHorizontal: 20 }}>
          {data?.subjects.map((s, i) => {
            const d = s.exam_on ? daysUntil(s.exam_on) : null;
            return (
              <Pressable key={s.code} onPress={() => router.push(`/library/${s.code}`)} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 }, rowRule]}>
                <View style={{ flex: 1 }}>
                  <T size={17.5} w={600}>{s.short_name ?? s.name}</T>
                  <T size={12.5} color={colors.neutral700}>{s.code} · {s.notes_count} notes · {s.lab_count > s.pyq_count ? `${s.lab_count} labs` : `${s.pyq_count} PYQs`}</T>
                </View>
                {i === 0 && d != null && d >= 0 && d <= 30 ? <Tag tone="accent2">End-sem {d}d</Tag> : <Icon name="caret-right" size={16} color={colors.neutral500} />}
              </Pressable>
            );
          })}
          {data && !data.subjects.length && <T size={15} i color={colors.neutral700} style={{ paddingVertical: 20 }}>No subjects listed for this semester yet.</T>}
          {top && (
            <>
              <T size={18} w={600} style={{ marginTop: 24, marginBottom: 10 }}>Most downloaded this week</T>
              <Pressable onPress={() => router.push(`/library/${top.subject_code}`)} style={{ padding: 15, borderRadius: 2, backgroundColor: colors.surface, gap: 10 }}>
                <T size={10} ls={0.1} caps color={colors.accent}>{({ pyq: 'PYQ', notes: 'Notes', lab: 'Lab', slides: 'Slides' } as Record<string, string>)[top.kind]} · {top.subject_code}</T>
                <T size={17} w={600} lh={1.2}>{top.title}</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="download-simple" size={13} color={colors.neutral600} /><T size={11} color={colors.neutral600}>{n(top.downloads)}{top.uploader ? ` · @${top.uploader.handle}` : ''}</T></View>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
      {uploading && data && <UploadSheet subjects={data.subjects.map((s) => ({ code: s.code, name: s.name }))} onClose={() => setUploading(false)} onDone={reload} />}
    </Screen>
  );
}
