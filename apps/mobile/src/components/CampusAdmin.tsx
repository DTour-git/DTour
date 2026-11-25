import { useState } from 'react';
import { Alert, Switch, TextInput, View } from 'react-native';
import { CAMPUS_SECTIONS, colors, deleteCampusItem, fonts, saveCampusItem, type CampusItem, type CampusKind } from '@dtour/shared';
import { supabase } from '@/lib/supabase';
import { T } from './T';
import { PrimaryBtn, rowRule } from './ui';

/** Plain forms for the content behind Today, the exam countdown, Team Up deadlines and the Lounge rooms. */
export function CampusAdmin({ data, isAdmin, reload }: { data: Record<CampusKind, CampusItem[]>; isAdmin: boolean; reload: () => void }) {
  const kinds: CampusKind[] = isAdmin ? ['event', 'exam', 'deadline', 'room'] : ['event', 'exam', 'deadline'];
  return (
    <View>
      <T size={26} w={600} style={{ marginTop: 40 }}>
        Campus content
      </T>
      <T size={14} i color={colors.neutral800}>
        What Today, the exam countdown, Team Up deadlines and Lounge rooms show. Times are in IST.
      </T>
      {kinds.map((kind) => (
        <View key={kind}>
          <T size={19} w={600} style={{ marginTop: 24, marginBottom: 4 }}>
            {CAMPUS_SECTIONS[kind].title} · {data[kind].length}
          </T>
          {data[kind].map((item) => (
            <ItemForm key={item.id} kind={kind} item={item} reload={reload} />
          ))}
          <ItemForm kind={kind} item={null} reload={reload} />
        </View>
      ))}
    </View>
  );
}

function ItemForm({ kind, item, reload }: { kind: CampusKind; item: CampusItem | null; reload: () => void }) {
  const [v, setV] = useState<Record<string, string>>(item?.values ?? {});
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setBusy(true);
    try {
      await fn();
      after?.();
      reload();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    }
    setBusy(false);
  };
  return (
    <View style={[{ paddingVertical: 14 }, rowRule]}>
      {!item && (
        <T size={13} i color={colors.neutral700}>
          Add new
        </T>
      )}
      {CAMPUS_SECTIONS[kind].fields.map((f) => (
        <View key={f.key} style={{ marginTop: 8 }}>
          <T size={12} color={colors.neutral700}>
            {f.label}
          </T>
          {f.type === 'bool' ? (
            <Switch
              value={v[f.key] === 'true'}
              onValueChange={(on) => setV({ ...v, [f.key]: on ? 'true' : '' })}
              trackColor={{ true: colors.accent }}
            />
          ) : (
            <TextInput
              value={f.type === 'datetime' ? (v[f.key] ?? '').replace('T', ' ') : (v[f.key] ?? '')}
              onChangeText={(t) => setV({ ...v, [f.key]: t })}
              placeholder={f.hint}
              placeholderTextColor={colors.neutral700}
              keyboardType={f.type === 'number' ? 'number-pad' : 'default'}
              autoCapitalize="none"
              editable={!(kind === 'room' && f.key === 'slug' && item)}
              accessibilityLabel={f.label}
              style={{
                height: 40,
                paddingHorizontal: 12,
                backgroundColor: colors.surface,
                borderRadius: 2,
                fontFamily: fonts.regular,
                fontSize: 14,
                color: colors.text,
              }}
            />
          )}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        {item && kind !== 'room' && (
          <PrimaryBtn
            label="Delete"
            secondary
            height={40}
            disabled={busy}
            style={{ flex: 1 }}
            onPress={() =>
              Alert.alert('Delete this?', 'It disappears for everyone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => run(() => deleteCampusItem(supabase, kind, item.id)) },
              ])
            }
          />
        )}
        <PrimaryBtn
          label={item ? 'Save' : 'Add'}
          height={40}
          disabled={busy}
          style={{ flex: 1 }}
          onPress={() =>
            run(
              () => saveCampusItem(supabase, kind, item?.id ?? null, v),
              () => !item && setV({}),
            )
          }
        />
      </View>
    </View>
  );
}
