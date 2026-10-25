import { View } from 'react-native';
import { colors } from '@dtour/shared';
import type { useHandleCheck } from '@/lib/useHandleCheck';
import { T } from './T';
import { Icon } from './Icon';

/** One line under a handle field: available, taken, reserved… */
export function HandleHint({ check }: { check: ReturnType<typeof useHandleCheck> }) {
  if (!check.message) return null;
  const good = check.status === 'available' || check.status === 'yours';
  const color = good ? colors.accent700 : check.status === 'checking' ? colors.neutral700 : colors.accent2_700;
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
      {check.status !== 'checking' && <Icon name={good ? 'check-circle' : 'warning'} size={16} color={color} />}
      <T size={13} color={color} style={{ flex: 1 }}>{check.message}</T>
    </View>
  );
}
