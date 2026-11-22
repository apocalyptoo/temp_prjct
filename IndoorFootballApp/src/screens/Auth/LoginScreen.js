// Log in (docs/features/profiles-and-registration.md, section e, "Login"). The ball logo
// and the name, email and password, then Log in. After "Please verify your email" (403),
// a notice and a Resend verification email button. "Create an account" opens the role
// choice. A successful login needs no navigation: AuthContext sets the user and
// AppNavigator switches to that role's tabs.
import React, { useContext, useRef, useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Button,
  NoticeLine,
  Screen,
  Text,
  TextField,
  TextLink,
} from '../../components/ui';

const LOGO = require('../../../assets/icons/ball.png');

export default function LoginScreen({ navigation }) {
  const { login, resendVerification } = useContext(AuthContext);
  const { spacing, sizes } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loggingIn, setLoggingIn] = useState(false);
  // Shown after a login attempt for an account whose email isn't verified yet.
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  // Stops a second tap from sending a second request before the button shows it's busy.
  const busy = useRef(false);

  const onLogin = async () => {
    if (busy.current) return;
    const found = {
      email: email.trim() === '' ? 'Email is required' : null,
      password: password === '' ? 'Password is required' : null,
    };
    setErrors(found);
    if (found.email || found.password) return;

    busy.current = true;
    setLoggingIn(true);
    try {
      const res = await login(email.trim(), password);
      if (!res.success) {
        setNeedsVerification(Boolean(res.needsVerification));
        Alert.alert(
          'Login failed',
          res.error || 'Check your email and password',
        );
      }
      // On success this screen goes away (AppNavigator shows the role's tabs).
    } finally {
      busy.current = false;
      setLoggingIn(false);
    }
  };

  const onResend = async () => {
    if (busy.current) return;
    busy.current = true;
    setResending(true);
    try {
      const res = await resendVerification(email.trim());
      Alert.alert(
        res.success ? 'Email sent' : 'Not sent',
        res.success ? res.message : res.error,
      );
    } finally {
      busy.current = false;
      setResending(false);
    }
  };

  const onChangeEmail = value => {
    setEmail(value);
    setNeedsVerification(false); // the notice belongs to the email that was checked
    if (errors.email) setErrors({ ...errors, email: null });
  };

  return (
    <Screen
      scroll
      keyboardAware
      style={[
        styles.content,
        { gap: spacing.xl, paddingVertical: spacing.xxxl },
      ]}
    >
      <View style={[styles.brand, { gap: spacing.xs }]}>
        <Image
          source={LOGO}
          style={{ width: sizes.logo, height: sizes.logo }}
          resizeMode="contain"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text variant="display" accessibilityRole="header">
          ConnectArena
        </Text>
        <Text variant="bodySmall" color="textMuted">
          Unleash Your Inner Champion
        </Text>
      </View>

      <TextField
        label="Email"
        value={email}
        onChangeText={onChangeEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!loggingIn}
      />
      <View style={{ gap: spacing.xxs }}>
        <TextField
          label="Password"
          value={password}
          onChangeText={value => {
            setPassword(value);
            if (errors.password) setErrors({ ...errors, password: null });
          }}
          error={errors.password}
          secure
          autoComplete="password"
          editable={!loggingIn}
          onSubmitEditing={onLogin}
        />
        <TextLink
          title="Forgot password?"
          onPress={() => navigation.navigate('ForgotPassword')}
          style={styles.end}
        />
      </View>

      <Button title="Log in" onPress={onLogin} loading={loggingIn} fullWidth />

      {needsVerification ? (
        <View style={{ gap: spacing.md }}>
          <NoticeLine
            strong="Your email isn't verified yet."
            text="Check your inbox for the link."
          />
          <Button
            title="Resend verification email"
            variant="secondary"
            onPress={onResend}
            loading={resending}
            fullWidth
          />
        </View>
      ) : null}

      <View style={[styles.signUpRow, { gap: spacing.xs }]}>
        <Text variant="body" color="textMuted">
          New here?
        </Text>
        <TextLink
          title="Create an account"
          onPress={() => navigation.navigate('RoleSelection')}
        />
      </View>

      {/* Development builds only (the screen isn't registered in release builds). */}
      {__DEV__ ? (
        <TextLink
          title="UI gallery"
          onPress={() => navigation.navigate('UIGallery')}
          style={styles.center}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center' },
  brand: { alignItems: 'center' },
  end: { alignSelf: 'flex-end' },
  center: { alignSelf: 'center' },
  signUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
});
