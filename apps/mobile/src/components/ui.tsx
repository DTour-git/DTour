import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, initials, tagTone, tint, tone as toneMap, flair, type Tint, type Tone, type TagTone, type SocietyLite } from '@dtour/shared';
import { T } from './T';
import { Icon } from './Icon';

export const hair = StyleSheet.hairlineWidth;

/** Two overlapping speech bubbles (cyan + magenta, multiply). */
export function LogoMark({ size = 24 }: { size?: number }) {
  const off = Math.round(size * 0.125);
  const b = (bg: string, x: number, y: number): ViewStyle => ({
    position: 'absolute', left: x, top: y, width: size, height: size, backgroundColor: bg,
    borderTopLeftRadius: size / 2, borderTopRightRadius: size / 2, borderBottomRightRadius: size / 2, borderBottomLeftRadius: 0,
    mixBlendMode: 'multiply',
  });
  return (
    <View style={{ width: size + off + 2, height: size + off + 1, isolation: 'isolate' }}>
      <View style={b(colors.accent, 0, 0)} />
      <View style={b(colors.accent2, off, Math.round(off * 0.7))} />
    </View>
  );
}

export function Avatar({ person, society, size = 32, label, ring }: {
  person?: { handle: string; tint: string } | null; society?: SocietyLite | null; size?: number; label?: string; ring?: string;
}) {
  const base: ViewStyle = { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: ring ? 2 : 0, borderColor: ring };
  if (society) {
    const t = society.tint === 'accent2' ? { bg: colors.accent2_100, fg: colors.accent2_800 } : { bg: colors.accent100, fg: colors.accent800 };
    return <View style={[base, { backgroundColor: t.bg }]}><Icon name={society.icon} size={size * 0.5} color={t.fg} /></View>;
  }
  const t = tint[(person?.tint as Tint) ?? 'neutral'] ?? tint.neutral;
  return (
    <View style={[base, { backgroundColor: t.bg }]}>
      <T size={Math.max(9, size * 0.36)} w={600} color={t.fg}>{label ?? initials(person?.handle ?? '?')}</T>
    </View>
  );
}

export function Tag({ tone = 'neutral', children, size = 11 }: { tone?: TagTone; children: ReactNode; size?: number }) {
  const t = tagTone[tone];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: 1.5, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <T size={size} color={t.fg} ls={0.02}>{children}</T>
    </View>
  );
}

export function FlairTag({ person }: { person: { branch_code: string | null; grad_year: number | null } }) {
  const f = flair(person.branch_code, person.grad_year);
  return f ? <Tag>{f}</Tag> : null;
}

/** Misregistered C/M/Y plate numeral (three multiplied text plates). */
export function CmykNum({ children, size, tracking = -0.04 }: { children: string; size: number; tracking?: number }) {
  const plate = (color: string, dx: number, dy: number) => (
    <T size={size} w={600} ls={tracking} lh={0.9} color={color}
      style={{ position: 'absolute', left: dx * size, top: dy * size, mixBlendMode: 'multiply' } as never}>{children}</T>
  );
  return (
    <View style={{ backgroundColor: colors.bg, isolation: 'isolate' } as ViewStyle} accessible accessibilityLabel={children}>
      <T size={size} w={600} ls={tracking} lh={0.9} color={colors.bg}>{children}</T>
      {plate(colors.accent, 0, 0)}
      {plate(colors.accent2, 0.036, 0.025)}
      {plate(colors.processYellow, -0.031, -0.023)}
    </View>
  );
}

/** Striped placeholder with the 3px halftone dot screen. */
export function Halftone({ height, label, src, style }: { height: number; label?: string | null; src?: string | null; style?: ViewStyle }) {
  return (
    <View style={[{ height, overflow: 'hidden', justifyContent: 'flex-end', padding: 8 }, style]}>
      {src ? <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={label ?? 'Photo'} /> : null}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern id="stripes" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Rect width="8" height="16" fill={colors.neutral200} />
            <Rect x="8" width="8" height="16" fill={colors.neutral300} />
          </Pattern>
          <Pattern id="dots" width="3" height="3" patternUnits="userSpaceOnUse">
            <Circle cx="1.5" cy="1.5" r="0.7" fill="#000" fillOpacity={0.22} />
          </Pattern>
        </Defs>
        {!src && <Rect width="100%" height="100%" fill="url(#stripes)" />}
        <Rect width="100%" height="100%" fill="url(#dots)" />
      </Svg>
      {!src && label ? <T size={10.5} color={colors.neutral700} style={{ fontFamily: 'Menlo' }}>{label}</T> : null}
    </View>
  );
}

export function Seal({ size = 14 }: { size?: number }) {
  return <Icon name="seal-check" size={size} color={colors.accent} />;
}

export function IconBtn({ name, onPress, color, size = 24, label, weight }: { name: string; onPress?: () => void; color?: string; size?: number; label?: string; weight?: 'duotone' | 'fill' }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} accessibilityRole="button" accessibilityLabel={label ?? name}
      style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Icon name={name} size={size} color={color} weight={weight} />
    </Pressable>
  );
}

/** Back · title + subtitle · up to two actions. */
export function AppBar({ title, subtitle, right, back = true, close }: { title?: string; subtitle?: string | null; right?: ReactNode; back?: boolean; close?: boolean }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 6, paddingRight: 8, paddingBottom: 4 }}>
      {back && <IconBtn name={close ? 'x' : 'caret-left'} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        {title ? <T size={16} w={600} numberOfLines={1}>{title}</T> : null}
        {subtitle ? <T size={12} color={colors.neutral700} numberOfLines={1}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
}

/** Screen with status-bar inset and the bg ground. */
export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  return <View style={[{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }, style]}>{children}</View>;
}

export function Pill({ label, active, onPress, tone }: { label: string; active?: boolean; onPress?: () => void; tone?: 'accent' | 'accent2' | 'neutral' | 'surface' }) {
  const t = tone === 'accent' ? { bg: colors.accent100, fg: colors.accent800 }
    : tone === 'accent2' ? { bg: colors.accent2_100, fg: colors.accent2_800 }
    : tone === 'neutral' ? { bg: colors.neutral200, fg: colors.neutral800 }
    : { bg: colors.surface, fg: colors.neutral800 };
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={{ height: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 2, backgroundColor: active ? colors.text : t.bg }}>
      <T size={13.5} w={600} color={active ? colors.bg : t.fg}>{label}</T>
    </Pressable>
  );
}

export function PillRow({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={[{ gap: 8, paddingHorizontal: 20 }, style]}>
      {children}
    </ScrollView>
  );
}

export function SectionRule({ num, title, tone = 'accent', right, numSize = 24, titleSize = 19, titleColor }: {
  num: string; title: string; tone?: Tone | 'neutral'; right?: ReactNode; numSize?: number; titleSize?: number; titleColor?: string;
}) {
  const t = tone === 'neutral' ? { main: colors.neutral500, strong: colors.neutral700 } : toneMap[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, borderBottomWidth: 3, borderBottomColor: t.main, paddingBottom: 7 }}>
      <T size={numSize} w={600} lh={0.9} color={t.strong}>{num}</T>
      <T size={titleSize} w={600} color={titleColor}>{title}</T>
      {right ? <View style={{ marginLeft: 'auto' }}>{right}</View> : null}
    </View>
  );
}

export const rowRule: ViewStyle = { borderBottomWidth: 1, borderBottomColor: colors.rule };

export function PrimaryBtn({ label, icon, onPress, secondary, height = 44, style, disabled }: { label: string; icon?: string; onPress?: () => void; secondary?: boolean; height?: number; style?: ViewStyle; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={({ pressed }) => [{
        height, paddingHorizontal: 16, borderRadius: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: secondary ? 'transparent' : pressed ? colors.accent700 : colors.accent,
        borderWidth: secondary ? 1 : 0, borderColor: colors.divider, opacity: disabled ? 0.45 : 1,
      }, secondary && pressed ? { backgroundColor: 'rgba(32,30,29,0.07)' } : null, style]}>
      {icon ? <Icon name={icon} size={17} color={secondary ? colors.text : colors.bg} /> : null}
      <T size={14} w={600} color={secondary ? colors.text : colors.bg}>{label}</T>
    </Pressable>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <T size={15} i color={colors.neutral700} style={{ paddingVertical: 20 }}>{children}</T>;
}
