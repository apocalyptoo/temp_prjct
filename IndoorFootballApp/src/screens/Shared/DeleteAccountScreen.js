// Delete account (docs/features/account-deletion.md, section e), for players and venue
// owners. First what will be deleted and what happens to each captained team, from the
// backend's preview (P14); then the password and Delete account, which asks one last
// time (P16). The delete sends the preview's code back, so the backend refuses (409)
// when a team's outcome isn't the one shown here any more; the new outcome is then
// loaded before the user can try again. A wrong password shows under its field and never
// logs out. On success AuthContext clears the login, so this screen simply goes away.
// "Forgot your password?" emails a reset link, as on Change password (P15).
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import api from '../../api/api';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Button,
  Card,
  ConfirmDialog,
  ListRow,
  Screen,
  ScreenHeader,
  SectionHeader,
  Text,
  TextField,
  TextLink,
} from '../../components/ui';
import { useBusyAction } from '../../hooks/useBusyAction';
import { TeamLoadState, showActionError } from '../Team/teamCommon';
import { resetSentText } from './ChangePasswordScreen';
import {
  teamOutcomeIcon,
  teamOutcomeText,
  teamsSummary,
  whatWillBeDeleted,
} from './deletionOutcomes';

export const WRONG_PASSWORD = 'Password is incorrect';
export const PASSWORD_REQUIRED = 'Password is required';
export const LOAD_FAILED = "Couldn't load what will be deleted.";
export const DELETE_FAILED =
  "Couldn't delete your account. Please check your connection and try again.";

export default function DeleteAccountScreen({ navigation }) {
  const { user, deleteAccount } = useContext(AuthContext);
  const { spacing } = useTheme();
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [askingReset, setAskingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  // Delete and Send link share one guard: while either runs, both are blocked.
  const { run, isBusy } = useBusyAction();

  // Loads the preview. When a reload fails, what's shown normally stays (the code guards
  // it); with mustBeFresh the old outcome is known to be wrong, so it's replaced by
  // "Couldn't load…" and Try again. The typed password is kept either way.
  const load = useCallback(async ({ mustBeFresh = false } = {}) => {
    try {
      const res = await api.get('/auth/deletion-preview');
      setPreview(res.data);
      setStatus('ready');
    } catch {
      setStatus(current =>
        current === 'ready' && !mustBeFresh ? 'ready' : 'error',
      );
    }
  }, []);

  useEffect(
    () => navigation.addListener('focus', () => load()),
    [navigation, load],
  );

  const retry = useCallback(() => {
    setStatus('loading');
    load();
  }, [load]);

  const askToDelete = () => {
    if (!password) {
      setPasswordError(PASSWORD_REQUIRED);
      return;
    }
    setConfirming(true);
  };

  const deleteForGood = () =>
    run(async () => {
      try {
        // On success the Login screen replaces this one.
        await deleteAccount(password, preview.previewCode);
      } catch (err) {
        setConfirming(false);
        const code = err.response?.status;
        const message = err.response?.data?.error;
        if (code === 400 && message === WRONG_PASSWORD) {
          setPasswordError(WRONG_PASSWORD);
        } else if (code === 409) {
          showActionError(err, { onStale: () => load({ mustBeFresh: true }) });
        } else if (code !== 401) {
          // 429 and the like have a message of their own. A 401 has already logged the
          // user out, with its own message.
          const readable = code >= 400 && code < 500 && message;
          Alert.alert('Not deleted', readable || DELETE_FAILED);
        }
      }
    }, 'delete');

  const sendReset = () =>
    run(async () => {
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
      }
    }, 'reset');

  const header = (
    <ScreenHeader
      back={{ label: 'Settings', onPress: navigation.goBack }}
      title="Delete account"
    />
  );

  if (status !== 'ready') {
    return (
      <Screen scroll style={{ gap: spacing.xl, paddingBottom: spacing.xxxl }}>
        {header}
        <TeamLoadState
          status={status}
          onRetry={retry}
          errorMessage={LOAD_FAILED}
        />
      </Screen>
    );
  }

  const { captainedTeams } = preview;
  const rows = whatWillBeDeleted(preview, user?.role);
  const question = [teamsSummary(captainedTeams), "This can't be undone."];

  return (
    <Screen
      scroll
      keyboardAware
      style={{ gap: spacing.xl, paddingBottom: spacing.xxxl }}
    >
      {header}
      <Text variant="body" color="textMuted">
        Your account will be deleted straight away. This can't be undone.
      </Text>

      <Card>
        <SectionHeader title="What will be deleted" />
        {rows.map((row, index) => (
          <ListRow
            key={row.name}
            icon={row.icon}
            name={row.name}
            meta={row.meta}
            last={index === rows.length - 1}
          />
        ))}
      </Card>

      {captainedTeams.length > 0 ? (
        <Card>
          <SectionHeader title="Your teams" />
          {captainedTeams.map((team, index) => (
            <ListRow
              key={team.id}
              icon={teamOutcomeIcon(team)}
              name={teamOutcomeText(team)}
              last={index === captainedTeams.length - 1}
            />
          ))}
        </Card>
      ) : null}

      <Text variant="meta" color="textMuted">
        {`We'll email ${user?.email} to confirm that your account was deleted.`}
      </Text>

      <View style={{ gap: spacing.xxs }}>
        <TextField
          label="Password"
          value={password}
          onChangeText={text => {
            setPassword(text);
            setPasswordError(null);
          }}
          error={passwordError}
          secure
          autoComplete="current-password"
        />
        <TextLink
          title="Forgot your password?"
          onPress={() => setAskingReset(true)}
          style={styles.end}
        />
        {resetSent ? (
          <Text
            variant="meta"
            color="textMuted"
            accessibilityLiveRegion="polite"
          >
            {resetSentText(user?.email)}
          </Text>
        ) : null}
      </View>

      <Button
        title="Delete account"
        variant="danger"
        icon="delete"
        onPress={askToDelete}
        loading={isBusy('delete')}
        fullWidth
      />

      <ConfirmDialog
        visible={confirming}
        title="Delete your account?"
        message={question.filter(Boolean).join(' ')}
        confirmTitle="Delete account"
        cancelTitle="Keep account"
        destructive
        loading={isBusy('delete')}
        onConfirm={deleteForGood}
        onCancel={() => setConfirming(false)}
      />
      <ConfirmDialog
        visible={askingReset}
        title="Send a reset link?"
        message={`We'll email a link to ${user?.email} to set a new password.`}
        confirmTitle="Send link"
        loading={isBusy('reset')}
        onConfirm={sendReset}
        onCancel={() => setAskingReset(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  end: { alignSelf: 'flex-end' },
});
