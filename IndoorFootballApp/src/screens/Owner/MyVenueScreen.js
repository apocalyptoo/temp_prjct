// My Venue, the venue owner's first tab (docs/features/profiles-and-registration.md,
// section e, and docs/features/venues.md, section e, "My Venue"): the venue name with its
// review status ("Live" or "Pending review", P17), then, while pending, the admin's note
// (when there is one) and the checklist of what the venue needs before it can go live
// (from the backend's missingFields, P8), then the listing (phone, address, area,
// website, opening hours, pricing info, description). An empty row says "Not added"
// (P26), so the owner sees what's left to fill in. The website is a link only when it's
// a real http(s) link (isWebLink, D3); otherwise it's plain text. Edit venue opens the
// form. Loads GET /owners/me whenever the screen comes into view, and on pull to refresh.
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Button,
  Card,
  Icon,
  ListRow,
  Pill,
  Screen,
  ScreenHeader,
  SectionHeader,
  Text,
} from '../../components/ui';
import { WebsiteRow } from '../Venue/venueCommon';
import { TeamLoadState } from '../Team/teamCommon';
import { NOT_ADDED } from '../Player/PlayerProfileScreen';

// The fields a venue needs before the admin can approve it, in the backend's order.
export const CHECKLIST = [
  { field: 'address', name: 'Address' },
  { field: 'area', name: 'Area' },
  { field: 'phone', name: 'Phone' },
];
export const CHECKLIST_TITLE = 'Before your venue can go live';
export const CHECKLIST_COMPLETE =
  'Your listing is complete. The admin will review it soon.';
export const NOTE_TITLE = 'Note from the admin';

// "✓ Added" in accent, or "⚠ Missing" muted: the word carries the meaning, not the colour.
function ChecklistState({ added }) {
  const { colors, spacing, icon } = useTheme();
  const color = added ? 'accent' : 'textMuted';
  return (
    <View style={[styles.row, { gap: spacing.xxs }]}>
      <Icon
        name={added ? 'success' : 'warning'}
        size={icon.sizeSmall}
        color={colors[color]}
      />
      <Text variant="buttonSecondary" color={color}>
        {added ? 'Added' : 'Missing'}
      </Text>
    </View>
  );
}

// Address, Area and Phone, each Added or Missing, from the backend's missingFields.
function ChecklistCard({ missingFields }) {
  const { spacing } = useTheme();
  const missing = missingFields ?? [];
  return (
    <Card>
      <SectionHeader title={CHECKLIST_TITLE} />
      {CHECKLIST.map(({ field, name }, index) => (
        <ListRow
          key={field}
          name={name}
          icon={field === 'phone' ? 'phone' : 'area'}
          trailing={<ChecklistState added={!missing.includes(field)} />}
          last={index === CHECKLIST.length - 1 && missing.length > 0}
        />
      ))}
      {missing.length === 0 ? (
        <Text
          variant="body"
          color="textMuted"
          style={{ marginTop: spacing.md }}
        >
          {CHECKLIST_COMPLETE}
        </Text>
      ) : null}
    </Card>
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
  // Live = approved by the admin; no approval date means "Pending review" (spec P4).
  const live = Boolean(venue?.approvedAt);

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
            <View style={{ gap: spacing.sm }}>
              <Text variant="title">{venue.indoorName}</Text>
              {live ? (
                <Pill label="Live" variant="strong" />
              ) : (
                <Pill label="Pending review" variant="soft" />
              )}
            </View>

            {!live && venue.reviewNote ? (
              <Card style={{ gap: spacing.sm }}>
                <SectionHeader title={NOTE_TITLE} />
                <Text variant="body">{venue.reviewNote}</Text>
              </Card>
            ) : null}

            {!live ? (
              <ChecklistCard missingFields={venue.missingFields} />
            ) : null}

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
              <ListRow icon="area" name="Area" meta={venue.area || NOT_ADDED} />
              <WebsiteRow website={venue.website} />
              <ListRow
                icon="time"
                name="Opening hours"
                meta={venue.openingHours || NOT_ADDED}
              />
              <ListRow
                icon="price"
                name="Pricing info"
                meta={venue.pricingInfo || NOT_ADDED}
              />
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
});
