// Edit venue (docs/features/profiles-and-registration.md, section e). Loads the listing
// (GET /owners/me), then venue name, phone, address, website and description. Every
// field is checked before sending (venueChecks.js, with the backend's messages) and sent
// every time (P11), empty optional fields as null. On success: back to where it was
// opened from, with the app's user name (the venue name) updated. Opened from My Venue,
// or from Settings ({ from: 'Settings' }), which only changes the back link's label.
// No "Discard changes?" dialog (P31).
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import api from '../../api/api';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Screen, ScreenHeader, TextField } from '../../components/ui';
import { useBusyAction } from '../../hooks/useBusyAction';
import { TeamLoadState } from '../Team/teamCommon';
import { useScrollToFirstError, VENUE_NAME } from '../Auth/signUpCommon';
import { checkVenueEdit, descriptionCount } from './venueChecks';

export const PHONE_HELPER = 'Bangladeshi mobile number, like 01712345678.';
export const ADDRESS_HELPER = 'So players can find you.';
export const WEBSITE_HELPER = 'Starts with https://';

const FIELD_ORDER = [
  'indoorName',
  'phone',
  'address',
  'website',
  'description',
];

export default function EditVenueScreen({ navigation, route }) {
  const { setUser } = useContext(AuthContext);
  const { spacing } = useTheme();
  const [status, setStatus] = useState('loading'); // loading | error | ready
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const { run, busy: saving } = useBusyAction();
  const { scrollRef, onLayoutOf, scrollToFirstError } =
    useScrollToFirstError(FIELD_ORDER);
  const backLabel =
    route?.params?.from === 'Settings' ? 'Settings' : 'My Venue';

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await api.get('/owners/me');
      const venue = res.data.ownerProfile;
      setForm({
        indoorName: venue.indoorName ?? '',
        phone: venue.phone ?? '',
        address: venue.address ?? '',
        website: venue.website ?? '',
        description: venue.description ?? '',
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

  const save = () =>
    run(async () => {
      const { ok, errors: found, body } = checkVenueEdit(form);
      setErrors(found);
      if (!ok) {
        scrollToFirstError(found);
        return;
      }

      try {
        const res = await api.patch('/owners/me', body);
        const name = res.data?.ownerProfile?.indoorName ?? body.indoorName;
        // A venue owner's name in the app is the venue name.
        setUser(current => (current ? { ...current, name } : current));
        navigation.goBack(); // My Venue reloads when it comes back into view.
      } catch (err) {
        Alert.alert(
          'Not saved',
          err.response?.data?.error ||
            "Couldn't save your venue. Please check your connection and try again.",
        );
      }
    });

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
        back={{ label: backLabel, onPress: navigation.goBack }}
        title="Edit venue"
      />
      {status !== 'ready' ? (
        <TeamLoadState
          status={status}
          onRetry={load}
          errorMessage="Couldn't load your venue."
        />
      ) : (
        <>
          {field(
            'indoorName',
            <TextField
              label="Venue name"
              value={form.indoorName}
              onChangeText={set('indoorName')}
              error={errors.indoorName}
              helper={`${VENUE_NAME.min}–${VENUE_NAME.max} characters`}
              autoCapitalize="words"
              editable={!saving}
            />,
          )}
          {field(
            'phone',
            <TextField
              label="Phone (optional)"
              value={form.phone}
              onChangeText={set('phone')}
              error={errors.phone}
              helper={PHONE_HELPER}
              keyboardType="phone-pad"
              autoComplete="tel"
              editable={!saving}
            />,
          )}
          {field(
            'address',
            <TextField
              label="Address (optional)"
              value={form.address}
              onChangeText={set('address')}
              error={errors.address}
              helper={ADDRESS_HELPER}
              multiline
              editable={!saving}
            />,
          )}
          {field(
            'website',
            <TextField
              label="Website (optional)"
              value={form.website}
              onChangeText={set('website')}
              error={errors.website}
              helper={WEBSITE_HELPER}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="url"
              editable={!saving}
            />,
          )}
          {field(
            'description',
            <TextField
              label="Description (optional)"
              value={form.description}
              onChangeText={set('description')}
              error={errors.description}
              helper={descriptionCount(form.description)}
              multiline
              editable={!saving}
            />,
          )}
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
