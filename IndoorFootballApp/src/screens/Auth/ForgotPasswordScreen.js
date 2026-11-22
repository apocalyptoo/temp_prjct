// Forgot password (docs/features/profiles-and-registration.md, section e). The email,
// then Send reset link. The backend gives the same reply whether or not the email has an
// account, so after sending, the form is replaced by that confirmation and a way back to
// Log in (P24: no success alert).
import React, { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Button,
  Screen,
  ScreenHeader,
  Text,
  TextField,
} from '../../components/ui';

export const RESET_SENT_TEXT =
  "If that email has an account, we've sent a reset link. It works for 1 hour.";

export default function ForgotPasswordScreen({ navigation }) {
  const { spacing } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  // Stops a second tap from sending a second request before the button shows it's busy.
  const busy = useRef(false);

  const send = async () => {
    if (busy.current) return;
    if (email.trim() === '') {
      setError('Email is required');
      return;
    }
    busy.current = true;
    setSending(true);
    try {
      await api.post('/auth/forgot', { email: email.trim() });
      setSent(true);
    } catch (err) {
      // For example "Too many password reset requests…" (429) or no connection.
      Alert.alert(
        'Not sent',
        err.response?.data?.error ||
          "Couldn't send the email. Please check your connection and try again.",
      );
    } finally {
      busy.current = false;
      setSending(false);
    }
  };

  return (
    <Screen
      scroll
      keyboardAware
      style={{ gap: spacing.xl, paddingBottom: spacing.xxxl }}
    >
      <ScreenHeader
        back={{ label: 'Log in', onPress: navigation.goBack }}
        title="Forgot password"
      />
      {sent ? (
        <View style={{ gap: spacing.xl }}>
          <Text variant="body" accessibilityLiveRegion="polite">
            {RESET_SENT_TEXT}
          </Text>
          <Button
            title="Back to log in"
            onPress={navigation.goBack}
            fullWidth
          />
        </View>
      ) : (
        <View style={{ gap: spacing.xl }}>
          <Text variant="body" color="textMuted">
            Enter your email and we'll send you a link to set a new password.
          </Text>
          <TextField
            label="Email"
            value={email}
            onChangeText={value => {
              setEmail(value);
              if (error) setError(null);
            }}
            error={error}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!sending}
            onSubmitEditing={send}
          />
          <Button
            title="Send reset link"
            onPress={send}
            loading={sending}
            fullWidth
          />
        </View>
      )}
    </Screen>
  );
}
