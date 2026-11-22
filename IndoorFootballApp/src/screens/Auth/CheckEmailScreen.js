// Check your email (docs/features/profiles-and-registration.md, section e, P22): shown
// after a successful sign-up, in place of the form. It says where the verification link
// went (or that it couldn't be sent), with Resend email and Back to log in.
// Params: { email, sendFailed }. Log in sits underneath it in the stack (signUpCommon's
// showCheckEmail), so Back and "Back to log in" both go there.
import React, { useContext, useState } from 'react';
import { Alert, View } from 'react-native';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Screen, ScreenHeader, Text } from '../../components/ui';
import { useBusyAction } from '../../hooks/useBusyAction';

export const sentText = email =>
  `We've sent a link to ${email}. Open it to verify your account, then log in. The link works for 24 hours.`;
export const SEND_FAILED_TEXT =
  "Your account is ready, but we couldn't send the email. Tap Resend to try again.";

export default function CheckEmailScreen({ route, navigation }) {
  const { email, sendFailed } = route.params ?? {};
  const { resendVerification } = useContext(AuthContext);
  const { spacing } = useTheme();
  const [resendReply, setResendReply] = useState(null);
  const { run, isBusy } = useBusyAction();

  const resend = () =>
    run(async () => {
      const res = await resendVerification(email);
      if (res.success) setResendReply(res.message);
      else Alert.alert('Not sent', res.error);
    });

  const backToLogIn = () => navigation.navigate('Login');

  return (
    <Screen scroll style={{ gap: spacing.xl, paddingBottom: spacing.xxxl }}>
      <ScreenHeader
        back={{ label: 'Log in', onPress: backToLogIn }}
        title="Check your email"
      />
      <Text variant="body">
        {sendFailed ? SEND_FAILED_TEXT : sentText(email)}
      </Text>
      <View style={{ gap: spacing.xs }}>
        <Button
          title="Resend email"
          variant="secondary"
          onPress={resend}
          loading={isBusy()}
          fullWidth
        />
        {resendReply ? (
          <Text
            variant="meta"
            color="textMuted"
            accessibilityLiveRegion="polite"
          >
            {resendReply}
          </Text>
        ) : null}
      </View>
      <Button title="Back to log in" onPress={backToLogIn} fullWidth />
    </Screen>
  );
}
