import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts, MOBILE_SCOPES, parseQuery, search, type RankedDoc } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { appRoute } from '@/lib/routes';
import { T, Kicker } from '@/components/T';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/ui';

const SCOPES = Object.keys(MOBILE_SCOPES);

export default function Search() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(params.q ?? '');
  const [scope, setScope] = useState('All');
  const [res, setRes] = useState<RankedDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    const t = setTimeout(async () => {
      const p = parseQuery(q, MOBILE_SCOPES[scope]);
      const r = await search(supabase, p.q, p.kind);
      if (id === seq.current) { setRes(r.results); setTotal(r.total); setLoaded(true); }
    }, q ? 90 : 0);
    return () => clearTimeout(t);
  }, [q, scope]);

  const open = (r?: RankedDoc) => r && router.replace(appRoute(r.route));
  const p = res[0];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 20, paddingRight: 8 }}>
        <T size={26} w={600} color={colors.accent2} lh={1}>›</T>
        <TextInput autoFocus value={q} onChangeText={setQ} onSubmitEditing={() => open(p)} returnKeyType="go" autoCapitalize="none" autoCorrect={false}
          placeholder="dsa pyq, @riya, #placements" placeholderTextColor={colors.neutral700}
          style={{ flex: 1, minWidth: 0, height: 44, fontFamily: fonts.regular, fontSize: 18, color: colors.text }} />
        <T size={12.5} color={colors.neutral700}>{res.length}/{total}</T>
        <Pressable onPress={() => router.back()} style={{ height: 44, justifyContent: 'center', paddingHorizontal: 8 }}><T size={14} w={600} color={colors.accent700}>Cancel</T></Pressable>
      </View>
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 20, paddingVertical: 10 }}>
          {SCOPES.map((s) => (
            <Pressable key={s} onPress={() => setScope(s)} style={{ paddingVertical: 6, paddingHorizontal: 11, borderRadius: 2, backgroundColor: scope === s ? colors.text : 'transparent' }}>
              <T size={13} w={600} color={scope === s ? colors.bg : colors.neutral800}>{s}</T>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 6 }}>
        {res.map((r, i) => (
          <Pressable key={r.route + r.title} onPress={() => open(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingRight: 20, backgroundColor: i === 0 ? colors.accent100 : 'transparent' }}>
            <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: i === 0 ? colors.accent : 'transparent' }} />
            <Icon name={r.icon} size={19} color={colors.neutral700} />
            <T size={15} numberOfLines={1} style={{ flex: 1 }}>{r.segs.map((g, k) => g.hit ? <T key={k} size={15} w={600} color={colors.accent2_700}>{g.text}</T> : g.text)}</T>
            <T size={11} color={colors.neutral700}>{r.kind}</T>
          </Pressable>
        ))}
        {loaded && !res.length && (
          <View style={{ paddingVertical: 28, paddingHorizontal: 20 }}>
            <T size={15} color={colors.neutral700}>Nothing matches. <T size={15} w={600} color={colors.accent700} onPress={() => router.replace({ pathname: '/new', params: { title: q } })}>Ask it as a new thread →</T></T>
          </View>
        )}
        {p && (
          <View style={{ marginTop: 16, marginHorizontal: 20, padding: 16, backgroundColor: colors.surface, borderRadius: 2 }}>
            <Kicker color={colors.accent700}>{p.kind}</Kicker>
            <T size={19} w={600} lh={1.25} style={{ marginTop: 6, marginBottom: 4 }}>{p.title}</T>
            <T size={12.5} color={colors.neutral700}>{p.sub}</T>
            {p.body ? <T size={14} lh={1.5} color={colors.neutral800} style={{ marginTop: 8 }}>{p.body}</T> : null}
          </View>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 18, marginHorizontal: 20, marginBottom: 34 }}>
          {[['@', 'people'], ['#', 'boards'], ['lib:', 'library']].map(([a, b]) => <T key={a} size={12.5} color={colors.neutral700}><T size={12.5} w={600} color={colors.neutral700}>{a}</T> {b}</T>)}
          <T size={12.5} color={colors.neutral700}>Ranked by closeness</T>
        </View>
      </ScrollView>
    </Screen>
  );
}
