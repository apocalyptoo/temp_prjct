// Edit profile (docs/features/profiles-and-registration.md, section e). Loads the
// player's profile (GET /players/me), then name, phone, position, area (with
// suggestions), height and weight; the email is shown but can't be changed. Every field
// is checked before sending (profileChecks.js) and sent every time (P11), empty optional
// fields as null. On success: back to Profile, with the app's user name updated. No
// "Discard changes?" dialog (P31).
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Alert, View } from 'react-native';
import api from '../../api/api';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Button,
  OptionGroup,
  Screen,
  ScreenHeader,
  SuggestionField,
  TextField,
} from '../../components/ui';
import { POSITIONS } from '../../constants/positions';
import { suggestAreas } from '../../constants/areas';
import { TeamLoadState } from '../Team/teamCommon';
import { PLAYER_NAME, useScrollToFirstError } from '../Auth/signUpCommon';
import { checkProfileEdit, measurementText } from './profileChecks';

export const AREA_HELPER =
  "Your neighbourhood, like Dhanmondi. Don't enter your full address.";
export const EMAIL_LOCKED = "Email can't be changed yet.";

const FIELD_ORDER = ['name', 'phone', 'position', 'area', 'height', 'weight'];

export default function EditProfileScreen({ navigation }) {
  const { setUser } = useContext(AuthContext);
  const { spacing } = useTheme();
  const [status, setStatus] = useState('loading'); // loading | error | ready
  const [email, setEmail] = useState('');
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // Stops a second tap from sending a second request before the button shows it's busy.
  const busy = useRef(false);
  const { scrollRef, onLayoutOf, scrollToFirstError } =
    useScrollToFirstError(FIELD_ORDER);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await api.get('/players/me');
      const profile = res.data.playerProfile;
      setEmail(res.data.email);
      setForm({
        name: profile.name ?? '',
        phone: profile.phone ?? '',
        position: profile.position ?? null,
        area: profile.area ?? '',
        height: measurementText(profile.height),
        weight: measurementText(profile.weight),
      });
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Changing a field clears its error.
  const set = key => value => {
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current =>
      current[key] ? { ...current, [key]: null } : current,
    );
  };

  const save = async () => {
    if (busy.current) return;
    const { ok, errors: found, body } = checkProfileEdit(form);
    setErrors(found);
    if (!ok) {
      scrollToFirstError(found);
      return;
    }

    busy.current = true;
    setSaving(true);
    try {
      const res = await api.patch('/players/me', body);
      const name = res.data?.playerProfile?.name ?? body.name;
      // The new name shows everywhere the app uses the logged-in user's name.
      setUser(current => (current ? { ...current, name } : current));
      navigation.goBack(); // Profile reloads when it comes back into view.
    } catch (err) {
      Alert.alert(
        'Not saved',
        err.response?.data?.error ||
          "Couldn't save your profile. Please check your connection and try again.",
      );
      busy.current = false;
      setSaving(false);
    }
  };

  const field = (key, element) => (
    <View onLayout={onLayoutOf(key)}>{element}</View>
  );

  return (
    <Screen
      scroll
      keyboardAware
      scrollRef={scrollRef}
      style={{ gap: spacing.xl, paddingBottom: spacing.xxxl }}
    >
      <ScreenHeader
        back={{ label: 'Profile', onPress: navigation.goBack }}
        title="Edit profile"
      />
      {status !== 'ready' ? (
        <TeamLoadState
          status={status}
          onRetry={load}
          errorMessage="Couldn't load your profile."
        />
      ) : (
        <>
          {field(
            'name',
            <TextField
              label="Name"
              value={form.name}
              onChangeText={set('name')}
              error={errors.name}
              helper={`${PLAYER_NAME.min}–${PLAYER_NAME.max} characters`}
              autoCapitalize="words"
              editable={!saving}
            />,
          )}
          {field(
            'phone',
            <TextField
              label="Phone"
              value={form.phone}
              onChangeText={set('phone')}
              error={errors.phone}
              helper="Bangladeshi mobile number, like 01712345678. Your teammates use it to reach you."
              keyboardType="phone-pad"
              autoComplete="tel"
              editable={!saving}
            />,
          )}
          {field(
            'position',
            <OptionGroup
              label="Position"
              options={POSITIONS}
              value={form.position}
              onChange={set('position')}
              error={errors.position}
              disabled={saving}
            />,
          )}
          {field(
            'area',
            <SuggestionField
              label="Area (optional)"
              value={form.area}
              onChangeText={set('area')}
              getSuggestions={suggestAreas}
              error={errors.area}
              helper={AREA_HELPER}
              autoCapitalize="words"
              disabled={saving}
            />,
          )}
          {field(
            'height',
            <TextField
              label="Height in cm (optional)"
              value={form.height}
              onChangeText={set('height')}
              error={errors.height}
              keyboardType="decimal-pad"
              editable={!saving}
            />,
          )}
          {field(
            'weight',
            <TextField
              label="Weight in kg (optional)"
              value={form.weight}
              onChangeText={set('weight')}
              error={errors.weight}
              keyboardType="decimal-pad"
              editable={!saving}
            />,
          )}
          <TextField
            label="Email"
            value={email}
            helper={EMAIL_LOCKED}
            disabled
          />
          <Button
            title="Save changes"
            onPress={save}
            loading={saving}
            fullWidth
          />
        </>
      )}
    </Screen>
  );
}
