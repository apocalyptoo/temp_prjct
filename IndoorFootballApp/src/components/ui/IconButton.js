// Icon-only buttons (docs/DESIGN.md section 6), 44 x 44.
//   <IconButton variant="approve" accessibilityLabel="Approve Nayeem Islam" onPress={…} />
// variant: approve (lime with a check), reject (outlined, X in textMuted), or plain
// (no background; pass `icon`, for things like back or settings).
// accessibilityLabel is required: without visible text, it's all a screen reader has.
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Icon from './Icon';

const VARIANTS = {
  approve: { icon: 'approve', bg: 'accent', border: null, color: 'onAccent' },
  reject: { icon: 'reject', bg: null, border: 'border', color: 'textMuted' },
  plain: { icon: null, bg: null, border: null, color: 'text' },
};

export default function IconButton({
  variant = 'plain',
  icon,
  onPress,
  accessibilityLabel,
  disabled = false,
  style,
}) {
  const { colors, sizes, radius, opacity, touchTarget } = useTheme();
  const look = VARIANTS[variant] ?? VARIANTS.plain;

  if (__DEV__ && !accessibilityLabel) {
    console.warn(
      `IconButton: accessibilityLabel is required (variant "${variant}")`,
    );
  }

  const handlePress = event => {
    if (disabled) return;
    onPress?.(event);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          width: touchTarget,
          height: touchTarget,
          borderRadius: radius.button,
        },
        look.bg && { backgroundColor: colors[look.bg] },
        look.border && {
          borderWidth: sizes.border,
          borderColor: colors[look.border],
        },
        disabled && { opacity: opacity.disabled },
        pressed && !disabled && { opacity: opacity.pressed },
        style,
      ]}
    >
      <Icon name={icon ?? look.icon} color={colors[look.color]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
