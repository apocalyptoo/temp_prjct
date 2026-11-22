// A text field that suggests values as you type (docs/DESIGN.md section 6), shown in a
// short list right under it (inline, not a pop-up). Tapping a suggestion fills the
// field. Any other text is still allowed. Used for the player's Area.
//   <SuggestionField label="Area" value={area} onChangeText={setArea}
//                    getSuggestions={suggestAreas} helper="Your neighbourhood…" />
// getSuggestions(text) returns the suggestions for what's typed (an empty list hides
// the list). The list shows only while the field is focused. onSuggestionPress(name),
// optional, is called after a tapped suggestion has filled the field (the venue list
// searches at once then, instead of waiting for typing to stop). Every other prop goes
// to TextField (label, error, helper, placeholder, disabled…).
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Divider from './Divider';
import Icon from './Icon';
import Text from './Text';
import TextField from './TextField';

export default function SuggestionField({
  value,
  onChangeText,
  getSuggestions,
  onSuggestionPress,
  onFocus,
  onBlur,
  disabled = false,
  style,
  ...fieldProps
}) {
  const { colors, sizes, spacing, radius, opacity, icon, touchTarget } =
    useTheme();
  const [focused, setFocused] = useState(false);
  const suggestions =
    focused && !disabled && getSuggestions ? getSuggestions(value ?? '') : [];

  return (
    <View style={[{ gap: spacing.xs }, style]}>
      <TextField
        {...fieldProps}
        value={value}
        onChangeText={onChangeText}
        disabled={disabled}
        onFocus={event => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={event => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
      {suggestions.length > 0 ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: sizes.border,
            borderRadius: radius.button,
            paddingHorizontal: spacing.md,
          }}
        >
          {suggestions.map((name, index) => (
            <View key={name}>
              <Pressable
                onPress={() => {
                  onChangeText?.(name);
                  onSuggestionPress?.(name);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Suggestion: ${name}`}
                style={({ pressed }) => [
                  styles.row,
                  { minHeight: touchTarget, gap: spacing.sm },
                  pressed && { opacity: opacity.pressed },
                ]}
              >
                <Icon
                  name="area"
                  size={icon.sizeSmall}
                  color={colors.textMuted}
                />
                <Text variant="body" style={styles.name}>
                  {name}
                </Text>
              </Pressable>
              {index < suggestions.length - 1 ? <Divider /> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { flexShrink: 1 },
});
