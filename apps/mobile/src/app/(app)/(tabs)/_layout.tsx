import { Pressable, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@dtour/shared';
import { Icon } from '@/components/Icon';
import { T } from '@/components/T';

const ITEMS: Record<string, { label: string; icon: string }> = {
  index: { label: 'Today', icon: 'sun-horizon' },
  boards: { label: 'Boards', icon: 'squares-four' },
  lounge: { label: 'Lounge', icon: 'chats-circle' },
  you: { label: 'You', icon: 'user-circle' },
};

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={({ state, navigateToTab, emitter }) => (
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 6, paddingHorizontal: 8, paddingBottom: Math.max(insets.bottom, 12) }}>
          {state.routes.map((route, i) => {
            const name = route.name;
            const focused = state.index === i;
            if (name === 'post') {
              return (
                <Pressable key={name} onPress={() => router.push('/new')} accessibilityRole="button" accessibilityLabel="New post"
                  style={{ minWidth: 56, alignItems: 'center', justifyContent: 'center', paddingTop: 2 }}>
                  <View style={{ width: 48, height: 36, borderRadius: 2, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="plus" size={22} color={colors.bg} />
                  </View>
                </Pressable>
              );
            }
            const it = ITEMS[name];
            const color = focused ? colors.accent700 : colors.neutral700;
            return (
              <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={it.label}
                onPress={() => {
                  const ev = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!ev.defaultPrevented) navigateToTab(route.key);
                }}
                style={{ minWidth: 56, minHeight: 44, alignItems: 'center', gap: 2, paddingTop: 4 }}>
                <Icon name={it.icon} size={25} color={color} />
                <T size={11} w={focused ? 600 : 400} color={color}>{it.label}</T>
              </Pressable>
            );
          })}
        </View>
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="boards" />
      <Tabs.Screen name="post" />
      <Tabs.Screen name="lounge" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
