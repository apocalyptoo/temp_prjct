// Player sign-up (docs/features/profiles-and-registration.md, section e). The short
// form: name, email, phone, position, password twice and the Terms box. Every field is
// checked before sending (signUpCommon.js), with the problem under its field; the
// backend's refusal (for example "Email already registered") shows in an alert. On
// success, Check your email takes the form's place.
import React, { useContext, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Button,
  OptionGroup,
  Screen,
  ScreenHeader,
  TextField,
} from '../../components/ui';
import { POSITIONS } from '../../constants/positions';
import { cleanPhone } from '../../utils/phone';
import { PASSWORD_HELPER } from '../../utils/password';
import {
  checkPlayerSignUp,
  PLAYER_NAME,
  showCheckEmail,
  TermsAgreement,
} from './signUpCommon';

export default function PlayerRegisterScreen({ navigation }) {
  const { register } = useContext(AuthContext);
  const { spacing } = useTheme();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    position: null,
    password: '',
    confirm: '',
    agreed: false,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // Stops a second tap from sending a second request before the button shows it's busy.
  const busy = useRef(false);

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
    const { ok, errors: found } = checkPlayerSignUp(form);
    setErrors(found);
    if (!ok) return;

    busy.current = true;
    setSaving(true);
    const email = form.email.trim();
    try {
      const reply = await register({
        name: form.name.trim(),
        email,
        password: form.password,
        role: 'PLAYER',
        profileData: { phone: cleanPhone(form.phone), position: form.position },
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
      style={{ gap: spacing.xl, paddingBottom: spacing.xxxl }}
    >
      <ScreenHeader
        back={{ label: 'Back', onPress: navigation.goBack }}
        title="Player sign-up"
      />
      <TextField
        label="Name"
        value={form.name}
        onChangeText={set('name')}
        error={errors.name}
        helper={`${PLAYER_NAME.min}–${PLAYER_NAME.max} characters`}
        autoCapitalize="words"
        autoComplete="name"
        editable={!saving}
      />
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
      <TextField
        label="Phone"
        value={form.phone}
        onChangeText={set('phone')}
        error={errors.phone}
        helper="Bangladeshi mobile number, like 01712345678. Your teammates use it to reach you."
        keyboardType="phone-pad"
        autoComplete="tel"
        editable={!saving}
      />
      <OptionGroup
        label="Position"
        options={POSITIONS}
        value={form.position}
        onChange={set('position')}
        error={errors.position}
        disabled={saving}
      />
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
      <TextField
        label="Confirm password"
        value={form.confirm}
        onChangeText={set('confirm')}
        error={errors.confirm}
        secure
        autoComplete="new-password"
        editable={!saving}
      />
      <TermsAgreement
        agreed={form.agreed}
        onChange={set('agreed')}
        error={errors.terms}
        disabled={saving}
      />
      <Button
        title="Create account"
        onPress={create}
        loading={saving}
        fullWidth
      />
    </Screen>
  );
}
