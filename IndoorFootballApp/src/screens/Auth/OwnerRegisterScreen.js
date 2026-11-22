// Venue owner sign-up (docs/features/profiles-and-registration.md, section e). The short
// form: venue name, email, password twice and the Terms box; the rest of the listing is
// filled in on My Venue after logging in. Checked before sending (signUpCommon.js), with
// the problem under its field; the backend's refusal shows in an alert. On success,
// Check your email takes the form's place.
import React, { useContext, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Button,
  Screen,
  ScreenHeader,
  Text,
  TextField,
} from '../../components/ui';
import { PASSWORD_HELPER } from '../../utils/password';
import {
  checkOwnerSignUp,
  showCheckEmail,
  TermsAgreement,
  useScrollToFirstError,
  VENUE_NAME,
} from './signUpCommon';

export default function OwnerRegisterScreen({ navigation }) {
  const { register } = useContext(AuthContext);
  const { spacing } = useTheme();
  const [form, setForm] = useState({
    venueName: '',
    email: '',
    password: '',
    confirm: '',
    agreed: false,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // Stops a second tap from sending a second request before the button shows it's busy.
  const busy = useRef(false);
  // The fields in the order they appear, so a problem near the top isn't missed.
  const { scrollRef, onLayoutOf, scrollToFirstError } = useScrollToFirstError([
    'venueName',
    'email',
    'password',
    'confirm',
    'terms',
  ]);

  // Changing a field clears its error (the Terms box's error is called "terms").
  const set = key => value => {
    const errorKey = key === 'agreed' ? 'terms' : key;
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current =>
      current[errorKey] ? { ...current, [errorKey]: null } : current,
    );
  };

  const create = async () => {
    if (busy.current) return;
    const { ok, errors: found } = checkOwnerSignUp(form);
    setErrors(found);
    if (!ok) {
      scrollToFirstError(found);
      return;
    }

    busy.current = true;
    setSaving(true);
    const email = form.email.trim();
    try {
      const reply = await register({
        email,
        password: form.password,
        role: 'OWNER',
        profileData: { indoorName: form.venueName.trim() },
        acceptedTerms: form.agreed,
      });
      showCheckEmail(navigation, email, reply);
    } catch (err) {
      Alert.alert('Sign-up failed', err.message);
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen
      scroll
      keyboardAware
      scrollRef={scrollRef}
      style={{ gap: spacing.xl, paddingBottom: spacing.xxxl }}
    >
      <ScreenHeader
        back={{ label: 'Back', onPress: navigation.goBack }}
        title="Venue sign-up"
      />
      <Text variant="body" color="textMuted">
        You'll add your venue's address, phone and other details after you log
        in.
      </Text>
      <View onLayout={onLayoutOf('venueName')}>
        <TextField
          label="Venue name"
          value={form.venueName}
          onChangeText={set('venueName')}
          error={errors.venueName}
          helper={`${VENUE_NAME.min}–${VENUE_NAME.max} characters`}
          autoCapitalize="words"
          editable={!saving}
        />
      </View>
      <View onLayout={onLayoutOf('email')}>
        <TextField
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!saving}
        />
      </View>
      <View onLayout={onLayoutOf('password')}>
        <TextField
          label="Password"
          value={form.password}
          onChangeText={set('password')}
          error={errors.password}
          helper={PASSWORD_HELPER}
          secure
          autoComplete="new-password"
          editable={!saving}
        />
      </View>
      <View onLayout={onLayoutOf('confirm')}>
        <TextField
          label="Confirm password"
          value={form.confirm}
          onChangeText={set('confirm')}
          error={errors.confirm}
          secure
          autoComplete="new-password"
          editable={!saving}
        />
      </View>
      <View onLayout={onLayoutOf('terms')}>
        <TermsAgreement
          agreed={form.agreed}
          onChange={set('agreed')}
          error={errors.terms}
          disabled={saving}
        />
      </View>
      <Button
        title="Create account"
        onPress={create}
        loading={saving}
        fullWidth
      />
    </Screen>
  );
}
