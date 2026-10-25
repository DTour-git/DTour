import type { useHandleCheck } from '@/lib/useHandleCheck';
import { Icon } from './Icon';

/** One line under a handle field: available, taken, reserved… */
export function HandleHint({ check }: { check: ReturnType<typeof useHandleCheck> }) {
  if (!check.message) return null;
  const good = check.status === 'available' || check.status === 'yours';
  const color = good ? 'var(--color-accent-700)' : check.status === 'checking' ? 'var(--color-neutral-700)' : 'var(--color-accent-2-700)';
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color, marginTop: 6 }}>
      {check.status !== 'checking' && <Icon name={good ? 'check-circle' : 'warning'} size={16} color={color} />}
      {check.message}
    </div>
  );
}
