import { useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { ago, colors, getNotifications, markNotificationsRead, NOTIFICATION_ICON } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { useMe } from '@/lib/auth';
import { useData } from '@/lib/useData';
import { useNotifications } from '@/lib/notifications';
import { appRoute } from '@/lib/routes';
import { T } from '@/components/T';
import { Icon } from '@/components/Icon';
import { AppBar, Avatar, Screen, rowRule } from '@/components/ui';

export default function Notifications() {
  const me = useMe();
  const router = useRouter();
  const { setUnread, version } = useNotifications();
  const { data, refreshing, refresh } = useData(() => getNotifications(supabase), [version]);
  useEffect(() => { if (data?.some((n) => !n.read_at)) markNotificationsRead(supabase).then(() => setUnread(0)); }, [data, setUnread]);
  if (!me) return <Redirect href="/login" />;
  return (
    <Screen>
      <AppBar title="Notifications" />
      <FlatList
        data={data ?? []}
        keyExtractor={(n) => String(n.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
        ListEmptyComponent={data ? <T size={15} i lh={1.5} color={colors.neutral700} style={{ padding: 20 }}>Nothing yet. Replies, Lounge mentions, upvotes and accepted answers show up here.</T> : undefined}
        renderItem={({ item: n }) => (
          <Pressable onPress={() => router.push(appRoute(n.route))} style={[{ flexDirection: 'row', gap: 12, paddingVertical: 14, paddingHorizontal: 20, backgroundColor: n.read_at ? 'transparent' : colors.accent100 }, rowRule]}>
            <View>
              {n.actor ? <Avatar person={n.actor} size={36} /> : <Avatar person={{ handle: '?', tint: 'neutral' }} size={36} />}
              <View style={{ position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={NOTIFICATION_ICON[n.kind] ?? 'bell'} size={14} color={n.kind === 'upvote' || n.kind === 'accepted' ? colors.accent : colors.accent2} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <T size={14.5} lh={1.4}><T size={14.5} w={600}>@{n.actor?.handle ?? 'someone'}</T> {n.text}</T>
              {n.snippet ? <T size={13} color={colors.neutral700} numberOfLines={1} style={{ marginTop: 2 }}>{n.snippet}</T> : null}
              <T size={12} color={colors.neutral700} style={{ marginTop: 2 }}>{ago(n.created_at)}</T>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}
