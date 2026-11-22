// A checkbox (docs/DESIGN.md section 6): a 24×24 box inside a 44×44 touch target, with
// its label beside it. Unticked: surface with a border line. Ticked: accent with a check
// in onAccent. Tapping the box or the label toggles it.
//   <Checkbox checked={agreed} onChange={setAgreed}
//             label="I agree to the Terms of Use and Privacy Policy." error={termsError}>
//     <TextLink title="Terms of Use" onPress={openTerms} />
//   </Checkbox>
// children: extra content under the label (for example links), which stays separately
// tappable: a link can't sit inside a wrapped sentence and still be 44 tall.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Icon from './Icon';
import Text from './Text';

// checked: ticked or not. onChange(next): called with the new value.
// label: the sentence beside the box (read with it). error: a message under it, with the
// warning icon, like TextField. disabled: dimmed and not tappable. style: layout only.
export default function Checkbox({
  checked,
  onChange,
  label,
  error,
  disabled = false,
  children,
  style,
}) {
  const { colors, sizes, spacing, radius, opacity, icon, touchTarget } =
    useTheme();
  const box = icon.size; // the box is the size of an icon (24)

  return (
    <View
      style={[
        { gap: spacing.xxs },
        disabled && { opacity: opacity.disabled },
        style,
      ]}
    >
      <Pressable
        onPress={() => {
          if (!disabled) onChange?.(!checked);
        }}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked: Boolean(checked), disabled }}
        accessibilityHint={error || undefined}
        style={({ pressed }) => [
          styles.row,
          { minHeight: touchTarget, gap: spacing.sm },
          pressed && !disabled && { opacity: opacity.pressed },
        ]}
      >
        <View
          style={[styles.target, { width: touchTarget, height: touchTarget }]}
        >
          <View
            style={[
              styles.box,
              {
                width: box,
                height: box,
                borderRadius: radius.small,
                borderWidth: sizes.border,
                borderColor: error
                  ? colors.danger
                  : checked
                  ? colors.accent
                  : colors.border,
                backgroundColor: checked ? colors.accent : colors.surface,
              },
            ]}
          >
            {checked ? (
              <Icon
                name="approve"
                size={icon.sizeSmall}
                color={colors.onAccent}
              />
            ) : null}
          </View>
        </View>
        <Text variant="body" style={styles.label}>
          {label}
        </Text>
      </Pressable>

      {children ? (
        <View style={{ paddingLeft: touchTarget + spacing.sm }}>
          {children}
        </View>
      ) : null}

      {error ? (
        <View style={[styles.messageRow, { gap: spacing.xs }]}>
          <Icon name="warning" size={icon.sizeSmall} color={colors.danger} />
          <Text variant="meta" color="danger" style={styles.label}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  target: { alignItems: 'center', justifyContent: 'center' },
  box: { alignItems: 'center', justifyContent: 'center' },
  label: { flexShrink: 1 },
  messageRow: { flexDirection: 'row', alignItems: 'center' },
});
