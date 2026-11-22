// The admin's Venues tab (docs/features/venues.md, section e, D2, P22): every venue from
// GET /admin/indoors, which sends pending venues first, oldest waiting first, then live
// venues by name (P13). "Waiting for review" with its count, one card per pending venue
// (name, area, the owner's email, "Unverified" when they haven't verified their email,
// and what's missing or "Complete"), then "Live (n)" with one row per live venue. Each
// opens the review screen (AdminVenue). Reloads whenever it comes into view, and on pull
// to refresh.
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Card,
  EmptyState,
  Icon,
  ListRow,
  Pill,
  Screen,
  ScreenHeader,
  SectionHeader,
  Text,
} from '../../components/ui';
import { TeamLoadState } from '../Team/teamCommon';
import { isLive, missingText } from './adminVenueCommon';

export const WAITING_TITLE = 'Waiting for review';
export const NO_VENUES = 'No venues yet.';

// "owner@gmail.com · Unverified" for an owner who hasn't verified their email.
export const ownerLine = venue =>
  venue.verified ? venue.email : `${venue.email} · Unverified`;

export default function AdminVenuesScreen({ navigation }) {
  const { colors, spacing } = useTheme();
  const [venues, setVenues] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [refreshing, setRefreshing] = useState(false);

  // A failed reload keeps what's shown; only a failed first load shows the error.
  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/indoors');
      setVenues(res.data);
      setStatus('ready');
    } catch {
      setStatus(current => (current === 'ready' ? 'ready' : 'error'));
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

  const openVenue = venue =>
    navigation.navigate('AdminVenue', {
      userId: venue.userId,
      venueName: venue.indoorName,
    });

  // The backend's order is kept: it already sorts each group.
  const pending = venues.filter(venue => !isLive(venue));
  const live = venues.filter(isLive);

  let body;
  if (status !== 'ready') {
    body = (
      <TeamLoadState
        status={status}
        onRetry={retry}
        errorMessage="Couldn't load venues."
      />
    );
  } else if (venues.length === 0) {
    body = <EmptyState message={NO_VENUES} />;
  } else {
    body = (
      <>
        {pending.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            <SectionHeader
              title={WAITING_TITLE}
              right={<Pill label={String(pending.length)} variant="soft" />}
            />
            {pending.map(venue => (
              <PendingCard
                key={venue.userId}
                venue={venue}
                onPress={() => openVenue(venue)}
              />
            ))}
          </View>
        ) : null}
        {live.length > 0 ? (
          <Card>
            <SectionHeader title={`Live (${live.length})`} />
            {live.map((venue, index) => (
              <ListRow
                key={venue.userId}
                icon="venue"
                name={venue.indoorName}
                meta={venue.area}
                onPress={() => openVenue(venue)}
                trailing={<Icon name="forward" color={colors.textMuted} />}
                last={index === live.length - 1}
              />
            ))}
          </Card>
        ) : null}
      </>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          gap: spacing.listGap,
          paddingTop: spacing.lg,
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
        <ScreenHeader title="Venues" />
        {body}
      </ScrollView>
    </Screen>
  );
}

// A venue waiting for review: what the admin needs at a glance.
function PendingCard({ venue, onPress }) {
  const { colors, spacing, icon } = useTheme();
  const complete = venue.missingFields.length === 0;
  const state = missingText(venue.missingFields);
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${venue.indoorName}, ${state}`}
      style={{ gap: spacing.xs }}
    >
      <Text variant="cardTitle">{venue.indoorName}</Text>
      {venue.area ? (
        <View style={[styles.row, { gap: spacing.xs }]}>
          <Icon name="area" size={icon.sizeSmall} color={colors.textMuted} />
          <Text variant="meta" color="textMuted" style={styles.shrink}>
            {venue.area}
          </Text>
        </View>
      ) : null}
      <Text variant="meta" color="textMuted">
        {ownerLine(venue)}
      </Text>
      <View style={[styles.row, { gap: spacing.xs }]}>
        <Icon
          name={complete ? 'success' : 'warning'}
          size={icon.sizeSmall}
          color={complete ? colors.accent : colors.textMuted}
        />
        <Text
          variant="buttonSecondary"
          color={complete ? 'accent' : 'textMuted'}
          style={styles.shrink}
        >
          {state}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  shrink: { flexShrink: 1 },
});
