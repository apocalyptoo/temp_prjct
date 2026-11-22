// Change password (docs/features/profiles-and-registration.md, section e). Current, new
// and confirm, checked before sending with the same rule as sign-up (P21). The backend
// logs out every other phone and replies with a fresh token, which AuthContext saves
// before anything else, so this phone stays logged in; then one "Password changed"
// alert (P27). A wrong current password shows under its field and never logs out.
// "Forgot your current password?" emails a reset link to the account (P28).
import React, { useContext, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import api from '../../api/api';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Button,
  ConfirmDialog,
  Screen,
  ScreenHeader,
  Text,
  TextField,
  TextLink,
} from '../../components/ui';
import { newPasswordProblem, PASSWORD_HELPER } from '../../utils/password';
import { confirmProblem } from '../Auth/signUpCommon';

export const WRONG_CURRENT = 'Current password is incorrect';
export const SAME_PASSWORD =
  'Your new password must be different from your current one';
export const CHANGED_MESSAGE =
  "You're still logged in on this phone. Any other phones have been logged out.";
export const resetSentText = email =>
  `We've sent a reset link to ${email}. It works for 1 hour.`;

// Every field's first problem (null when fine), and whether there's any.
export function checkPasswordChange({ current, next, confirm }) {
  const errors = {
    current: current ? null : 'Current password is required',
    next: !next
      ? 'New password is required'
      : newPasswordProblem(next) ?? (next === current ? SAME_PASSWORD : null),
    confirm: confirmProblem(next, confirm),
  };
  return {
    errors,
    ok: Object.values(errors).every(problem => problem === null),
  };
}

export default function ChangePasswordScreen({ navigation }) {
  const { user, changePassword } = useContext(AuthContext);
  const { spacing } = useTheme();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [askingReset, setAskingReset] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  // Stops a second tap from sending a second request before the button shows it's busy.
  const busy = useRef(false);

  // Changing a field clears its error.
  const set = key => value => {
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current =>
      current[key] ? { ...current, [key]: null } : current,
    );
  };

  const save = async () => {
    if (busy.current) return;
    const { ok, errors: found } = checkPasswordChange(form);
    setErrors(found);
    if (!ok) return;

    busy.current = true;
    setSaving(true);
    try {
      await changePassword(form.current, form.next);
      Alert.alert('Password changed', CHANGED_MESSAGE);
      navigation.goBack();
    } catch (err) {
      const message = err.response?.data?.error;
      if (err.response?.status === 400 && message === WRONG_CURRENT) {
        setErrors(current => ({ ...current, current: WRONG_CURRENT }));
      } else {
        // For example "Too many attempts to change your password…" (429).
        Alert.alert(
          'Not changed',
          message ||
            "Couldn't change your password. Please check your connection and try again.",
        );
      }
      busy.current = false;
      setSaving(false);
    }
  };

  const sendReset = async () => {
    if (busy.current) return;
    busy.current = true;
    setSendingReset(true);
    try {
      await api.post('/auth/forgot', { email: user.email });
      setAskingReset(false);
      setResetSent(true);
    } catch (err) {
      setAskingReset(false);
      Alert.alert(
        'Not sent',
        err.response?.data?.error ||
          "Couldn't send the email. Please check your connection and try again.",
      );
    } finally {
      busy.current = false;
      setSendingReset(false);
    }
  };

  return (
    <Screen
      scroll
      keyboardAware
      style={{ gap: spacing.xl, paddingBottom: spacing.xxxl }}
    >
      <ScreenHeader
        back={{ label: 'Settings', onPress: navigation.goBack }}
        title="Change password"
      />
      <Text variant="body" color="textMuted">
        You'll stay logged in on this phone. Any other phones will be logged
        out, and we'll email you to let you know.
      </Text>
      <View style={{ gap: spacing.xxs }}>
        <TextField
          label="Current password"
          value={form.current}
          onChangeText={set('current')}
          error={errors.current}
          secure
          autoComplete="current-password"
        />
        <TextLink
          title="Forgot your current password?"
          onPress={() => setAskingReset(true)}
          style={styles.end}
        />
        {resetSent ? (
          <Text
            variant="meta"
            color="textMuted"
            accessibilityLiveRegion="polite"
          >
            {resetSentText(user.email)}
          </Text>
        ) : null}
      </View>
      <TextField
        label="New password"
        value={form.next}
        onChangeText={set('next')}
        error={errors.next}
        helper={PASSWORD_HELPER}
        secure
        autoComplete="new-password"
      />
      <TextField
        label="Confirm new password"
        value={form.confirm}
        onChangeText={set('confirm')}
        error={errors.confirm}
        secure
        autoComplete="new-password"
      />
      <Button
        title="Change password"
        onPress={save}
        loading={saving}
        fullWidth
      />
      <ConfirmDialog
        visible={askingReset}
        title="Send a reset link?"
        message={`We'll email a link to ${user?.email} to set a new password.`}
        confirmTitle="Send link"
        loading={sendingReset}
        onConfirm={sendReset}
        onCancel={() => setAskingReset(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  end: { alignSelf: 'flex-end' },
});
