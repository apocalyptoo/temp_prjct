// Venue detail (docs/features/venues.md, section e, "Venue detail"): one live venue for
// players and venue owners, from GET /owners/:userId. The venue name, its area as a soft
// pill, then a "Listing" card: Address, Phone, Website, Opening hours, Pricing info,
// Description, leaving out the ones that are empty (P21). Tapping the phone opens the
// dialler; the website opens only when it's a real http(s) link (isWebLink).
// A 404 means the venue was deleted or moved back to review: "This venue isn't available
// any more." with a way back. Loads whenever it comes into view, and on pull to refresh.
// Route params: { userId, venueName } (the name shows while the venue loads).
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import {
  BackLink,
  Card,
  EmptyState,
  ListRow,
  Pill,
  Screen,
  SectionHeader,
  Text,
} from '../../components/ui';
import { TeamLoadState } from '../Team/teamCommon';
import { openDialler, WebsiteRow } from './venueCommon';

export const GONE_MESSAGE = "This venue isn't available any more.";

// The listing rows that have something to show, in order.
function listingRows(venue) {
  const rows = [];
  if (venue.address) {
    rows.push({
      key: 'address',
      icon: 'area',
      name: 'Address',
      meta: venue.address,
    });
  }
  if (venue.phone) {
    rows.push({
      key: 'phone',
      icon: 'phone',
      name: 'Phone',
      meta: venue.phone,
      onPress: () => openDialler(venue.phone),
      accessibilityLabel: `Call ${venue.indoorName}`,
    });
  }
  if (venue.website) rows.push({ key: 'website', website: venue.website });
  if (venue.openingHours) {
    rows.push({
      key: 'hours',
      icon: 'time',
      name: 'Opening hours',
      meta: venue.openingHours,
    });
  }
  if (venue.pricingInfo) {
    rows.push({
      key: 'price',
      icon: 'price',
      name: 'Pricing info',
      meta: venue.pricingInfo,
    });
  }
  if (venue.description) {
    rows.push({
      key: 'description',
      icon: 'description',
      name: 'Description',
      meta: venue.description,
    });
  }
  return rows;
}

export default function VenueDetailScreen({ navigation, route }) {
  const { userId, venueName } = route.params;
  const { colors, spacing } = useTheme();
  const [venue, setVenue] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error | gone
  const [refreshing, setRefreshing] = useState(false);

  // A 404 (even after it was shown) means the venue is gone. Any other failure keeps
  // what's shown; only a failed first load shows the error.
  const load = useCallback(async () => {
    try {
      const res = await api.get(`/owners/${userId}`);
      setVenue(res.data);
      setStatus('ready');
    } catch (err) {
      if (err?.response?.status === 404) {
        setStatus('gone');
        return;
      }
      setStatus(current => (current === 'ready' ? 'ready' : 'error'));
    }
  }, [userId]);

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

  let body;
  if (status === 'gone') {
    body = (
      <EmptyState
        message={GONE_MESSAGE}
        actionTitle="Back to venues"
        onAction={navigation.goBack}
      />
    );
  } else if (status !== 'ready') {
    body = (
      <TeamLoadState
        status={status}
        onRetry={retry}
        errorMessage="Couldn't load this venue."
      />
    );
  } else {
    const rows = listingRows(venue);
    body = (
      <Card>
        <SectionHeader title="Listing" />
        {rows.map((row, index) => {
          const last = index === rows.length - 1;
          return row.website ? (
            <WebsiteRow key={row.key} website={row.website} last={last} />
          ) : (
            <ListRow
              key={row.key}
              icon={row.icon}
              name={row.name}
              meta={row.meta}
              onPress={row.onPress}
              accessibilityLabel={row.accessibilityLabel}
              last={last}
            />
          );
        })}
      </Card>
    );
  }

  const name = venue?.indoorName ?? venueName;

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
        <BackLink label="Venues" onPress={navigation.goBack} />
        {name ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="title">{name}</Text>
            {status === 'ready' && venue.area ? (
              <Pill label={venue.area} variant="soft" />
            ) : null}
          </View>
        ) : null}
        {body}
      </ScrollView>
    </Screen>
  );
}
