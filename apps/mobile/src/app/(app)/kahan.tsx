import { useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { colors, dayNum, getPlaces, toggleHeart, weekdayCaps } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useMe, useRequireMe } from '@/lib/auth';
import { useData } from '@/lib/useData';
import { T } from '@/components/T';
import { Icon } from '@/components/Icon';
import { AppBar, Halftone, IconBtn, Pill, PillRow, Screen, SectionRule, rowRule } from '@/components/ui';

const FILTERS: [string, string, 'accent' | 'accent2' | undefined][] = [['all', 'Everything', undefined], ['campus', 'On campus', 'accent2'], ['nearby', 'Khaana nearby', 'accent'], ['delhi', 'Delhi events', 'accent'], ['cheap', 'Under ₹100', undefined]];
const k = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(x));

export default function Kahan() {
  const me = useMe();
  const requireMe = useRequireMe();
  const [f, setF] = useState('all');
  const { data, setData, refreshing, refresh } = useData(() => getPlaces(supabase, me?.id ?? null));
  const keep = <P extends { under_100: boolean; on_campus: boolean }>(xs: P[]) => xs.filter((x) => (f !== 'cheap' || x.under_100) && (f !== 'campus' || x.on_campus));
  const show = (s: string) => f === 'all' || f === 'cheap' || f === s || (f === 'campus' && (s === 'canteen' || s === 'chill'));

  const heart = async (id: number) => {
    if (!data || !requireMe()) return;
    const h = new Set(data.myHearts); const had = h.has(id); if (had) h.delete(id); else h.add(id);
    setData({ ...data, myHearts: h, canteen: data.canteen.map((p) => p.id === id ? { ...p, hearts: p.hearts + (had ? -1 : 1) } : p) });
    await toggleHeart(supabase, id).catch(refresh);
  };

  return (
    <Screen>
      <AppBar title="Kahan chalein?" subtitle="Recommended by students" right={<IconBtn name="map-trifold" label="Open map" onPress={() => Linking.openURL('https://www.google.com/maps/search/food+near+Delhi+Technological+University')} />} />
      <PillRow>{FILTERS.map(([key, l, t]) => <Pill key={key} label={l} tone={t ?? 'surface'} active={f === key} onPress={() => setF(key)} />)}</PillRow>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}>
        {data && show('canteen') && keep(data.canteen).length > 0 && (
          <View style={{ marginTop: 22 }}>
            <View style={{ paddingHorizontal: 20 }}><SectionRule num="01" title="Canteen favourites" tone="accent2" /></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 }}>
              {keep(data.canteen).map((p) => (
                <View key={p.id} style={{ width: 140 }}>
                  <T size={16.5} w={600} lh={1.25}>{p.name}</T>
                  <T size={12.5} color={colors.neutral700} style={{ marginTop: 2 }}>{p.short_where ?? p.where_label}</T>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, alignItems: 'center' }}>
                    <T size={13} w={600}>{p.price_label === 'included' ? 'incl.' : p.price_label}</T>
                    <Pressable onPress={() => heart(p.id)} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Icon name="heart" size={14} color={colors.accent700} weight={data.myHearts.has(p.id) ? 'fill' : 'duotone'} /><T size={13} color={colors.accent700}>{k(p.hearts)}</T>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
        {data && show('nearby') && keep(data.nearby).length > 0 && (
          <View style={{ marginTop: 22 }}>
            <View style={{ paddingHorizontal: 20 }}><SectionRule num="02" title="Khaana nearby" tone="accent" /></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 }}>
              {keep(data.nearby).map((p) => (
                <View key={p.id} style={{ width: 200 }}>
                  <Halftone height={110} label="photo" />
                  <T size={16} w={600} style={{ marginTop: 8 }}>{p.short_name ?? p.name}</T>
                  <T size={12.5} color={colors.neutral700}>{[p.distance_km && `${p.distance_km} km`, p.price_label, p.recs ? `${p.recs} recs` : p.tags[0]].filter(Boolean).join(' · ')}</T>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
        <View style={{ paddingHorizontal: 20 }}>
          {data && show('delhi') && keep(data.delhi).length > 0 && (
            <View style={{ marginTop: 22 }}>
              <SectionRule num="03" title="This week in Delhi" tone="accent" />
              {keep(data.delhi).map((p, i) => (
                <View key={p.id} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, rowRule]}>
                  <View style={{ width: 44 }}>
                    <T size={22} w={600} lh={1} color={i === 0 ? colors.accent2_700 : colors.text}>{p.event_on ? dayNum(p.event_on + 'T12:00:00+05:30') : ''}</T>
                    <T size={10.5} ls={0.1} color={colors.neutral700}>{p.event_on ? weekdayCaps(p.event_on + 'T12:00:00+05:30') : ''}</T>
                  </View>
                  <View style={{ flex: 1 }}><T size={16} w={600}>{p.short_name ?? p.name}</T><T size={12.5} color={colors.neutral700}>{p.short_where ?? p.where_label}</T></View>
                  {p.metro_minutes ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="train-simple" size={15} color={colors.accent} /><T size={12} color={colors.neutral700}>{p.metro_minutes}m</T></View> : null}
                </View>
              ))}
            </View>
          )}
          {data && show('chill') && keep(data.chill).length > 0 && (
            <View style={{ marginTop: 22 }}>
              <SectionRule num="04" title="Chill spots" tone="neutral" />
              <View style={{ gap: 14, marginTop: 14 }}>
                {keep(data.chill).map((p) => (
                  <View key={p.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <Icon name={p.icon ?? 'map-pin'} size={24} color={colors.accent} />
                    <View><T size={16} w={600}>{p.name}</T><T size={12.5} color={colors.neutral700}>{p.short_where ?? p.where_label}</T></View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
