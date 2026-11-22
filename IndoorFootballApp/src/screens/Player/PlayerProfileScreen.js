// The player's own profile (docs/features/profiles-and-registration.md, section e,
// "Player Profile"). A card with the name, position and area, then every detail; an
// empty optional detail says "Not added" (P26), and phone and email say who can see
// them (P25). The gear opens Settings; Edit profile opens the form. Loads
// GET /players/me whenever the screen comes into view, and on pull to refresh.
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Avatar,
  Button,
  Card,
  Icon,
  IconButton,
  ListRow,
  Pill,
  Screen,
  ScreenHeader,
  SectionHeader,
  Text,
} from '../../components/ui';
import { TeamLoadState } from '../Team/teamCommon';

export const NOT_ADDED = 'Not added';
export const PHONE_HINT = 'Only your teammates can see this';
export const EMAIL_HINT = 'Only you can see this';

const withUnit = (value, unit) =>
  value === null || value === undefined ? NOT_ADDED : `${value} ${unit}`;

export default function PlayerProfileScreen({ navigation }) {
  const { colors, spacing, icon } = useTheme();
  const [me, setMe] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | error | ready
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/players/me');
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

  const profile = me?.playerProfile;

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
              onPress={() => navigation.navigate('PlayerSettings')}
            />
          }
        />

        {status !== 'ready' || !profile ? (
          <TeamLoadState
            status={status}
            onRetry={retry}
            errorMessage="Couldn't load your profile."
          />
        ) : (
          <>
            <Card>
              <View style={[styles.row, { gap: spacing.md }]}>
                <Avatar name={profile.name} size="large" />
                <View style={[styles.words, { gap: spacing.xxs }]}>
                  <Text variant="cardTitle">{profile.name}</Text>
                  <View style={[styles.row, styles.wrap, { gap: spacing.xs }]}>
                    <Pill label={profile.position} />
                    {profile.area ? (
                      <View style={[styles.row, { gap: spacing.xxs }]}>
                        <Icon
                          name="area"
                          size={icon.sizeSmall}
                          color={colors.textMuted}
                        />
                        <Text variant="meta" color="textMuted">
                          {profile.area}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            </Card>

            <Card>
              <SectionHeader title="Details" />
              <ListRow
                icon="position"
                name="Position"
                meta={profile.position}
              />
              <ListRow
                icon="area"
                name="Area"
                meta={profile.area || NOT_ADDED}
              />
              <ListRow
                icon="height"
                name="Height"
                meta={withUnit(profile.height, 'cm')}
              />
              <ListRow
                icon="weight"
                name="Weight"
                meta={withUnit(profile.weight, 'kg')}
              />
              <ListRow
                icon="phone"
                name="Phone"
                meta={profile.phone}
                hint={PHONE_HINT}
              />
              <ListRow
                icon="email"
                name="Email"
                meta={me.email}
                hint={EMAIL_HINT}
                last
              />
            </Card>

            <Button
              title="Edit profile"
              variant="secondary"
              icon="edit"
              onPress={() => navigation.navigate('EditProfile')}
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
  wrap: { flexWrap: 'wrap' },
  words: { flex: 1 },
});
