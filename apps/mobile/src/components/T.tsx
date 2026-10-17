import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts } from '@dtour/shared';

type Props = TextProps & {
  size?: number; w?: 400 | 600; i?: boolean; color?: string; lh?: number;
  /** letter-spacing in em, like the CSS (-.03 → -0.03em) */
  ls?: number; caps?: boolean; align?: TextStyle['textAlign']; style?: TextStyle | TextStyle[];
};

/** Source Serif 4 text with the prototype's shorthand: size, weight, italic, line-height multiplier, em tracking. */
export function T({ size = 15, w = 400, i, color = colors.text, lh, ls, caps, align, style, ...rest }: Props) {
  const fontFamily = w === 600 ? fonts.semibold : i ? fonts.italic : fonts.regular;
  return (
    <Text
      {...rest}
      allowFontScaling
      maxFontSizeMultiplier={1.4}
      style={[{
        fontFamily, fontSize: size, color,
        lineHeight: lh ? Math.round(size * lh) : undefined,
        letterSpacing: ls != null ? ls * size : undefined,
        textTransform: caps ? 'uppercase' : undefined,
        textAlign: align,
        fontStyle: i && w === 600 ? 'italic' : undefined,
      }, style as TextStyle]}
    />
  );
}

/** 10.5px caps kicker with .12em tracking. */
export function Kicker({ children, color = colors.accent2_700, style }: { children: React.ReactNode; color?: string; style?: TextStyle }) {
  return <T size={10.5} w={600} ls={0.12} caps color={color} style={style}>{children}</T>;
}
