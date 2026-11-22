// The venue owner's Profile tab (docs/features/profiles-and-registration.md, section e,
// "Owner Profile tab", P32): the account, not the listing. A card with the venue's
// initials, the venue name, "Venue owner" and the email (only the owner sees it, and it
// can't be changed yet), then a row to the listing on the My Venue tab. The gear opens
// Settings. Loads GET /owners/me whenever the screen comes into view, and on pull to
// refresh, so a venue name changed on another phone shows here too.
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Avatar,
  Card,
  Divider,
  Icon,
  IconButton,
  ListRow,
  Pill,
  Screen,
  ScreenHeader,
  Text,
} from '../../components/ui';
import { TeamLoadState } from '../Team/teamCommon';
import { EMAIL_HINT } from '../Player/PlayerProfileScreen';
import { EMAIL_LOCKED } from '../Player/EditProfileScreen';

export const OWNER_ROLE_LABEL = 'Venue owner';
export const LISTING_ROW = 'Your venue listing';

export default function OwnerProfileScreen({ navigation }) {
  const { colors, spacing } = useTheme();
  const [me, setMe] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | error | ready
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/owners/me');
      setMe(res.data);
      setStatus('ready');
    } catch {
      // A failed reload keeps what's shown; only a failed first load shows the error.
      setStatus(current => (current === 'ready' ? current : 'error'));
    }
  }, []);

  useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const retry = () => {
    setStatus('loading');
    load();
  };

  const venueName = me?.ownerProfile?.indoorName;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          gap: spacing.detailGap,
          paddingBottom: spacing.xxxl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <ScreenHeader
          title="Profile"
          action={
            <IconButton
              icon="settings"
              accessibilityLabel="Settings"
              onPress={() => navigation.navigate('Settings')}
            />
          }
        />

        {status !== 'ready' || !venueName ? (
          <TeamLoadState
            status={status}
            onRetry={retry}
            errorMessage="Couldn't load your profile."
          />
        ) : (
          <>
            <Card>
              <View style={[styles.row, { gap: spacing.md }]}>
                <Avatar name={venueName} size="large" />
                <View style={[styles.words, { gap: spacing.xxs }]}>
                  <Text variant="cardTitle">{venueName}</Text>
                  <Pill label={OWNER_ROLE_LABEL} />
                </View>
              </View>
              <Divider style={{ marginTop: spacing.md }} />
              <ListRow
                icon="email"
                name="Email"
                meta={me.email}
                hint={`${EMAIL_HINT}. ${EMAIL_LOCKED}`}
                last
              />
            </Card>

            <Card>
              <ListRow
                icon="venue"
                name={LISTING_ROW}
                onPress={() =>
                  navigation.navigate('MyVenueTab', { screen: 'MyVenue' })
                }
                trailing={<Icon name="forward" color={colors.textMuted} />}
                last
              />
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  words: { flex: 1 },
});
