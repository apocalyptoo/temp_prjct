// My Venue, the venue owner's first tab (docs/features/profiles-and-registration.md,
// section e, "My Venue"): the venue name, then the listing (phone, address, website,
// description). An empty row says "Not added" (P26), so a new owner sees what's left to
// fill in. The website is a link only when it's a real http(s) link (isWebLink, D3);
// otherwise it's plain text. Edit venue opens the form. Loads GET /owners/me whenever
// the screen comes into view, and on pull to refresh. Feature 3 adds the review status,
// the missing-fields checklist, area, opening hours and pricing info.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Button,
  Card,
  Divider,
  Icon,
  ListRow,
  Screen,
  ScreenHeader,
  SectionHeader,
  Text,
  TextLink,
} from '../../components/ui';
import { isWebLink } from '../../utils/links';
import { TeamLoadState } from '../Team/teamCommon';
import { NOT_ADDED } from '../Player/PlayerProfileScreen';

// Opens a website that passed isWebLink in the phone's browser.
export async function openWebsite(website) {
  try {
    await Linking.openURL(website);
  } catch {
    Alert.alert("Couldn't open the link", 'Please try again.');
  }
}

// The Website row: like the other rows, but a real link is a TextLink.
function WebsiteRow({ website }) {
  const { colors, spacing, touchTarget } = useTheme();
  if (!website || !isWebLink(website)) {
    return (
      <ListRow icon="website" name="Website" meta={website || NOT_ADDED} />
    );
  }
  return (
    <View>
      <View
        style={[
          styles.row,
          {
            minHeight: touchTarget,
            paddingVertical: spacing.md,
            gap: spacing.md,
          },
        ]}
      >
        <Icon name="website" color={colors.textMuted} />
        <View style={styles.middle}>
          <Text variant="bodyStrong">Website</Text>
          <TextLink
            title={website}
            onPress={() => openWebsite(website)}
            accessibilityLabel={`Website, ${website}`}
            style={styles.linkStart}
          />
        </View>
      </View>
      <Divider />
    </View>
  );
}

export default function MyVenueScreen({ navigation }) {
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

  const venue = me?.ownerProfile;

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
        <ScreenHeader title="My Venue" />

        {status !== 'ready' || !venue ? (
          <TeamLoadState
            status={status}
            onRetry={retry}
            errorMessage="Couldn't load your venue."
          />
        ) : (
          <>
            <Text variant="title">{venue.indoorName}</Text>

            <Card>
              <SectionHeader title="Listing" />
              <ListRow
                icon="phone"
                name="Phone"
                meta={venue.phone || NOT_ADDED}
              />
              <ListRow
                icon="area"
                name="Address"
                meta={venue.address || NOT_ADDED}
              />
              <WebsiteRow website={venue.website} />
              <ListRow
                icon="description"
                name="Description"
                meta={venue.description || NOT_ADDED}
                last
              />
            </Card>

            <Button
              title="Edit venue"
              icon="edit"
              onPress={() => navigation.navigate('EditVenue')}
              fullWidth
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  middle: { flex: 1 },
  linkStart: { alignItems: 'flex-start' },
});
