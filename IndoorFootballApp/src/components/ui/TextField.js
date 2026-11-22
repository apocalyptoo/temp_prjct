// A text field (docs/DESIGN.md section 6): label above, the field, then an error or a
// helper line under it. Password fields get a show/hide button.
//   <TextField label="Email" value={email} onChangeText={setEmail}
//              keyboardType="email-address" error={emailError} />
//   <TextField label="Password" value={password} onChangeText={setPassword} secure />
//   <TextField label="Search venues" icon="search" value={search} onChangeText={…} />
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Icon from './Icon';
import IconButton from './IconButton';
import Text from './Text';

// label: shown above and read with the field. error: replaces the helper while shown.
// secure: a password field (hidden, with a show/hide button). disabled: not editable.
// icon: optional, one of our Icon names, shown muted at the left inside the field
// (the search field's magnifier). Decorative: the label says what the field is.
// Every other prop (value, onChangeText, placeholder, keyboardType, autoComplete,
// returnKeyType, onSubmitEditing…) goes to React Native's TextInput.
export default function TextField({
  label,
  error,
  helper,
  secure = false,
  disabled = false,
  icon: leadingIcon,
  onFocus,
  onBlur,
  style,
  ...inputProps
}) {
  const { colors, sizes, spacing, radius, opacity, typography, icon } =
    useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const borderColor = error
    ? colors.danger
    : focused
    ? colors.accent
    : colors.border;

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
        style={[
          styles.field,
          {
            minHeight: sizes.field,
            backgroundColor: colors.surface,
            borderColor,
            borderWidth: sizes.border,
            borderRadius: radius.button,
            paddingLeft: spacing.lg,
          },
          leadingIcon ? { gap: spacing.sm } : null,
          // A password field's show/hide button sits flush with the right edge.
          secure ? styles.flushRight : { paddingRight: spacing.lg },
        ]}
      >
        {leadingIcon ? (
          <Icon name={leadingIcon} color={colors.textMuted} />
        ) : null}
        <TextInput
          {...inputProps}
          editable={!disabled}
          secureTextEntry={secure && hidden}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          accessibilityLabel={label}
          accessibilityHint={error || helper}
          accessibilityState={{ disabled }}
          onFocus={event => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={event => {
            setFocused(false);
            onBlur?.(event);
          }}
          // Font and size only: a line height on a TextInput shifts the text on Android.
          style={[
            styles.input,
            {
              fontFamily: typography.body.fontFamily,
              fontSize: typography.body.fontSize,
              color: colors.text,
              paddingVertical: spacing.sm,
            },
          ]}
        />
        {secure ? (
          <IconButton
            icon={hidden ? 'show' : 'hide'}
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden(value => !value)}
            disabled={disabled}
          />
        ) : null}
      </View>

      {error ? (
        <View style={[styles.messageRow, { gap: spacing.xs }]}>
          <Icon name="warning" size={icon.sizeSmall} color={colors.danger} />
          <Text variant="meta" color="danger" style={styles.message}>
            {error}
          </Text>
        </View>
      ) : helper ? (
        <Text variant="meta" color="textMuted">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center' },
  flushRight: { paddingRight: 0 },
  input: { flex: 1 },
  messageRow: { flexDirection: 'row', alignItems: 'center' },
  message: { flexShrink: 1 },
});
