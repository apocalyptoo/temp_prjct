// Pick one of a few options (docs/DESIGN.md section 6), shown as chips in a wrapping row.
// The chosen chip is accent with onAccent text; the others are surface with a border
// line. Used for the position picker.
//   <OptionGroup label="Position" options={POSITIONS} value={position}
//                onChange={setPosition} error={positionError} />
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Icon from './Icon';
import Text from './Text';

// options: the choices, as text (shown and returned as they are) or { value, label }.
// value: the chosen value, or null. onChange(value): called with the tapped option.
// label: shown above and read as the group's name. error: a message under it, with the
// warning icon, like TextField. disabled: dimmed and not tappable. style: layout only.
export default function OptionGroup({
  label,
  options,
  value,
  onChange,
  error,
  disabled = false,
  style,
}) {
  const { colors, sizes, spacing, radius, opacity, icon, touchTarget } =
    useTheme();
  const items = options.map(option =>
    typeof option === 'string' ? { value: option, label: option } : option,
  );

  return (
    <View
      style={[
        { gap: spacing.xs },
        disabled && { opacity: opacity.disabled },
        style,
      ]}
    >
      {label ? (
        <Text variant="bodySmall" color="textMuted">
          {label}
        </Text>
      ) : null}

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={[styles.row, { gap: spacing.xs }]}
      >
        {items.map(item => {
          const selected = item.value === value;
          return (
            <Pressable
              key={item.value}
              onPress={() => {
                if (!disabled) onChange?.(item.value);
              }}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityLabel={item.label}
              accessibilityState={{ selected, checked: selected, disabled }}
              style={({ pressed }) => [
                styles.chip,
                {
                  minHeight: touchTarget,
                  minWidth: touchTarget,
                  paddingHorizontal: spacing.lg,
                  borderRadius: radius.button,
                  borderWidth: sizes.border,
                  borderColor: selected
                    ? colors.accent
                    : error
                    ? colors.danger
                    : colors.border,
                  backgroundColor: selected ? colors.accent : colors.surface,
                },
                pressed && !disabled && { opacity: opacity.pressed },
              ]}
            >
              <Text
                variant={selected ? 'button' : 'buttonSecondary'}
                color={selected ? 'onAccent' : 'text'}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <View style={[styles.messageRow, { gap: spacing.xs }]}>
          <Icon name="warning" size={icon.sizeSmall} color={colors.danger} />
          <Text variant="meta" color="danger" style={styles.message}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { alignItems: 'center', justifyContent: 'center' },
  messageRow: { flexDirection: 'row', alignItems: 'center' },
  message: { flexShrink: 1 },
});
