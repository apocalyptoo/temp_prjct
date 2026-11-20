// Every piece of text in a screen (docs/DESIGN.md section 6). Screens never set fonts
// by hand: they pick a typography token and a colour meaning.
//   <Text variant="bodySmall" color="textMuted">Weekend 5-a-side crew</Text>
import React from 'react';
import { Text as NativeText } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

// variant: any typography token (display, title, body, meta…), default body.
// color: any colour meaning (text, textMuted, accent, danger…), default text.
// Any other prop (numberOfLines, onPress, accessibility props…) goes to React Native's Text.
export default function Text({
  variant = 'body',
  color = 'text',
  style,
  ...rest
}) {
  const { typography, colors } = useTheme();

  if (__DEV__) {
    if (!typography[variant])
      console.warn(`Text: unknown variant "${variant}"`);
    if (!colors[color]) console.warn(`Text: unknown color "${color}"`);
  }

  return (
    <NativeText
      style={[typography[variant], { color: colors[color] }, style]}
      {...rest}
    />
  );
}
