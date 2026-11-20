// Buttons (docs/DESIGN.md section 6).
//   <Button title="Create team" icon="add" onPress={create} loading={saving} />
// variant: primary (lime, the one main action on a screen), secondary (outlined) or
// danger (red text, for destructive actions; always confirm first).
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Icon from './Icon';
import Text from './Text';

// How each variant looks: background, border, label colour and text style.
const VARIANTS = {
  primary: { bg: 'accent', border: null, label: 'onAccent', text: 'button' },
  secondary: {
    bg: 'surface',
    border: 'border',
    label: 'text',
    text: 'buttonSecondary',
  },
  danger: {
    bg: 'surface',
    border: 'border',
    label: 'danger',
    text: 'buttonSecondary',
  },
};

// title: the label. icon: optional leading icon (one of our Icon names).
// loading: while a request runs, a spinner in the label's colour replaces the label,
//   the button keeps its exact size and further taps are ignored.
// disabled: dimmed and not tappable. fullWidth: stretch across the parent.
// accessibilityLabel: only when the title alone isn't clear enough.
// style: layout only (margins, flex), never colours or fonts.
export default function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityLabel,
  style,
}) {
  const theme = useTheme();
  const { colors, sizes, spacing, radius, opacity, touchTarget } = theme;
  const look = VARIANTS[variant] ?? VARIANTS.primary;
  const labelColor = colors[look.label];
  const blocked = disabled || loading;

  // Guarded here too, not only by Pressable's `disabled`, so a press can never get
  // through while the request runs.
  const handlePress = event => {
    if (blocked) return;
    onPress?.(event);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: sizes.button,
          minWidth: touchTarget,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radius.button,
          backgroundColor: colors[look.bg],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        look.border && {
          borderWidth: sizes.border,
          borderColor: colors[look.border],
        },
        disabled && { opacity: opacity.disabled },
        pressed && !blocked && { opacity: opacity.pressed },
        style,
      ]}
    >
      {/* The label stays in place (invisible) while loading, so the size never changes. */}
      <View
        style={[styles.content, { gap: spacing.xs }, loading && styles.hidden]}
      >
        {icon ? <Icon name={icon} color={labelColor} /> : null}
        <Text variant={look.text} color={look.label} style={styles.label}>
          {title}
        </Text>
      </View>
      {loading ? (
        <View style={styles.spinner} pointerEvents="none">
          <ActivityIndicator size="small" color={labelColor} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  label: { textAlign: 'center', flexShrink: 1 },
  hidden: { opacity: 0 },
  spinner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
